<script setup lang="ts">
import Papa from 'papaparse'

definePageMeta({
  middleware: 'auth',
})

// Steps
const currentStep = ref(1)
const steps = [
  { id: 1, name: 'Upload' },
  { id: 2, name: 'Map Columns' },
  { id: 3, name: 'Preview' },
  { id: 4, name: 'Import' },
]

// Step 1: File upload
const rawData = ref<string[][]>([])
const headers = ref<string[]>([])
const fileName = ref('')

// Step 2: Column mapping
const columnMapping = ref<Record<string, string>>({
  cellar: '',
  producer: '',
  wineName: '',
  color: '',
  region: '',
  appellation: '',
  grapes: '',
  vintage: '',
  format: '',
  quantity: '',
  purchaseDate: '',
  purchasePricePerBottle: '',
  purchaseCurrency: '',
  purchaseSource: '',
  notes: '',
})

const requiredFields = ['cellar', 'producer', 'wineName', 'color', 'quantity']
const optionalFields = [
  'region', 'appellation', 'grapes', 'vintage', 'format',
  'purchaseDate', 'purchasePricePerBottle', 'purchaseCurrency', 'purchaseSource', 'notes'
]

const fieldLabels: Record<string, string> = {
  cellar: 'Cellar',
  producer: 'Producer',
  wineName: 'Wine Name',
  color: 'Color',
  region: 'Region',
  appellation: 'Appellation',
  grapes: 'Grapes',
  vintage: 'Vintage',
  format: 'Format',
  quantity: 'Quantity',
  purchaseDate: 'Purchase Date',
  purchasePricePerBottle: 'Price per Bottle',
  purchaseCurrency: 'Currency',
  purchaseSource: 'Purchase Source',
  notes: 'Notes',
}

// Step 3: Validation
const validatedRows = ref<any[]>([])
const validationSummary = ref<any>(null)
const isValidating = ref(false)
const skipDuplicates = ref(true)

// Step 4: Import
const importResult = ref<any>(null)
const isImporting = ref(false)

// File handling
function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  fileName.value = file.name

  Papa.parse(file, {
    complete: (results) => {
      if (results.data.length > 0) {
        headers.value = results.data[0] as string[]
        rawData.value = results.data.slice(1) as string[][]

        // Auto-map columns based on header names
        autoMapColumns()
        currentStep.value = 2
      }
    },
    error: (error) => {
      console.error('CSV parse error:', error)
    },
  })
}

function autoMapColumns() {
  const headerLower = headers.value.map(h => h.toLowerCase().trim())

  const autoMappings: Record<string, string[]> = {
    cellar: ['cellar', 'cave', 'location'],
    producer: ['producer', 'producteur', 'domaine', 'chateau', 'château', 'winery'],
    wineName: ['wine', 'wine name', 'nom', 'cuvée', 'cuvee', 'name'],
    color: ['color', 'couleur', 'type'],
    region: ['region', 'région'],
    appellation: ['appellation', 'aoc', 'aop'],
    grapes: ['grape', 'grapes', 'cépage', 'cépages', 'varietal'],
    vintage: ['vintage', 'millésime', 'millesime', 'year', 'année'],
    format: ['format', 'size', 'bottle', 'taille'],
    quantity: ['quantity', 'qty', 'quantité', 'nb', 'bottles', 'count'],
    purchaseDate: ['purchase date', 'date', 'achat'],
    purchasePricePerBottle: ['price', 'prix', 'cost', 'unit price'],
    purchaseCurrency: ['currency', 'devise'],
    purchaseSource: ['source', 'vendor', 'merchant', 'fournisseur'],
    notes: ['notes', 'comment', 'comments', 'remarques'],
  }

  for (const [field, aliases] of Object.entries(autoMappings)) {
    const matchIndex = headerLower.findIndex(h => aliases.includes(h))
    if (matchIndex !== -1) {
      columnMapping.value[field] = headers.value[matchIndex]
    }
  }
}

const mappingValid = computed(() => {
  return requiredFields.every(field => columnMapping.value[field])
})

// Convert raw data to mapped rows
function getMappedRows() {
  return rawData.value
    .filter(row => row.some(cell => cell?.trim())) // Skip empty rows
    .map(row => {
      const mapped: any = {}
      for (const [field, header] of Object.entries(columnMapping.value)) {
        if (header) {
          const index = headers.value.indexOf(header)
          if (index !== -1) {
            mapped[field] = row[index]?.trim() || undefined
          }
        }
      }
      return mapped
    })
}

// Validate
async function validateData() {
  isValidating.value = true
  try {
    const rows = getMappedRows()
    const response = await $fetch('/api/inventory/import/validate', {
      method: 'POST',
      body: { rows },
    })
    validatedRows.value = response.rows
    validationSummary.value = response.summary
    currentStep.value = 3
  } catch (error: any) {
    console.error('Validation error:', error)
  } finally {
    isValidating.value = false
  }
}

// Import
async function executeImport() {
  isImporting.value = true
  try {
    const response = await $fetch('/api/inventory/import/execute', {
      method: 'POST',
      body: {
        rows: validatedRows.value,
        skipDuplicates: skipDuplicates.value,
      },
    })
    importResult.value = response
    currentStep.value = 4
  } catch (error: any) {
    console.error('Import error:', error)
  } finally {
    isImporting.value = false
  }
}

function reset() {
  currentStep.value = 1
  rawData.value = []
  headers.value = []
  fileName.value = ''
  validatedRows.value = []
  validationSummary.value = null
  importResult.value = null
  for (const key of Object.keys(columnMapping.value)) {
    columnMapping.value[key] = ''
  }
}
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Import Wines</h1>
      <p class="mt-1 text-sm text-gray-600">
        Import your wine inventory from a CSV file
      </p>
    </div>

    <!-- Progress steps -->
    <div class="mb-8">
      <nav class="flex items-center justify-center">
        <ol class="flex items-center space-x-2 sm:space-x-4">
          <li v-for="(step, index) in steps" :key="step.id" class="flex items-center">
            <span
              class="flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium"
              :class="currentStep >= step.id
                ? 'bg-wine-600 text-white'
                : 'bg-gray-200 text-gray-600'"
            >
              {{ step.id }}
            </span>
            <span
              class="ml-2 text-sm font-medium hidden sm:block"
              :class="currentStep >= step.id ? 'text-wine-600' : 'text-gray-500'"
            >
              {{ step.name }}
            </span>
            <svg
              v-if="index < steps.length - 1"
              class="w-5 h-5 mx-2 text-gray-300"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
            </svg>
          </li>
        </ol>
      </nav>
    </div>

    <!-- Step 1: Upload -->
    <div v-if="currentStep === 1" class="card">
      <h2 class="text-lg font-medium text-gray-900 mb-4">Upload CSV File</h2>

      <div class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <div class="mt-4">
          <label class="cursor-pointer">
            <span class="btn-primary">Select CSV file</span>
            <input
              type="file"
              accept=".csv"
              class="hidden"
              @change="handleFileUpload"
            />
          </label>
        </div>
        <p class="mt-2 text-sm text-gray-500">
          CSV file with headers in the first row
        </p>
      </div>

      <div class="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 class="text-sm font-medium text-gray-900 mb-2">Expected columns:</h3>
        <div class="text-sm text-gray-600">
          <p><strong>Required:</strong> cellar, producer, wine name, color, quantity</p>
          <p><strong>Optional:</strong> region, appellation, grapes, vintage, format, purchase date, price, currency, source, notes</p>
        </div>
      </div>
    </div>

    <!-- Step 2: Column Mapping -->
    <div v-if="currentStep === 2" class="card">
      <h2 class="text-lg font-medium text-gray-900 mb-4">Map Columns</h2>
      <p class="text-sm text-gray-600 mb-6">
        Match your CSV columns to the wine fields. File: <strong>{{ fileName }}</strong> ({{ rawData.length }} rows)
      </p>

      <div class="space-y-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <div v-for="field in requiredFields" :key="field">
            <label class="label">
              {{ fieldLabels[field] }} <span class="text-red-500">*</span>
            </label>
            <select v-model="columnMapping[field]" class="input">
              <option value="">-- Select column --</option>
              <option v-for="header in headers" :key="header" :value="header">
                {{ header }}
              </option>
            </select>
          </div>
        </div>

        <details class="mt-6">
          <summary class="cursor-pointer text-sm font-medium text-gray-700">
            Optional fields
          </summary>
          <div class="mt-4 grid gap-4 sm:grid-cols-2">
            <div v-for="field in optionalFields" :key="field">
              <label class="label">{{ fieldLabels[field] }}</label>
              <select v-model="columnMapping[field]" class="input">
                <option value="">-- Not mapped --</option>
                <option v-for="header in headers" :key="header" :value="header">
                  {{ header }}
                </option>
              </select>
            </div>
          </div>
        </details>
      </div>

      <div class="mt-6 flex justify-between">
        <button type="button" class="btn-secondary" @click="currentStep = 1">
          Back
        </button>
        <button
          type="button"
          class="btn-primary"
          :disabled="!mappingValid || isValidating"
          @click="validateData"
        >
          {{ isValidating ? 'Validating...' : 'Validate & Preview' }}
        </button>
      </div>
    </div>

    <!-- Step 3: Preview -->
    <div v-if="currentStep === 3" class="card">
      <h2 class="text-lg font-medium text-gray-900 mb-4">Preview & Validate</h2>

      <!-- Summary -->
      <div v-if="validationSummary" class="grid gap-4 sm:grid-cols-4 mb-6">
        <div class="p-3 bg-gray-50 rounded-lg">
          <p class="text-2xl font-bold text-gray-900">{{ validationSummary.total }}</p>
          <p class="text-sm text-gray-600">Total rows</p>
        </div>
        <div class="p-3 bg-green-50 rounded-lg">
          <p class="text-2xl font-bold text-green-700">{{ validationSummary.valid }}</p>
          <p class="text-sm text-green-600">Valid</p>
        </div>
        <div class="p-3 bg-red-50 rounded-lg">
          <p class="text-2xl font-bold text-red-700">{{ validationSummary.invalid }}</p>
          <p class="text-sm text-red-600">Invalid</p>
        </div>
        <div class="p-3 bg-amber-50 rounded-lg">
          <p class="text-2xl font-bold text-amber-700">{{ validationSummary.duplicates }}</p>
          <p class="text-sm text-amber-600">Duplicates</p>
        </div>
      </div>

      <!-- Options -->
      <div class="mb-6">
        <label class="flex items-center">
          <input
            v-model="skipDuplicates"
            type="checkbox"
            class="w-4 h-4 text-wine-600 border-gray-300 rounded focus:ring-wine-500"
          />
          <span class="ml-2 text-sm text-gray-700">Skip duplicate entries</span>
        </label>
      </div>

      <!-- Row preview -->
      <div class="overflow-x-auto max-h-96">
        <table class="min-w-full divide-y divide-gray-200 text-sm">
          <thead class="bg-gray-50 sticky top-0">
            <tr>
              <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Row</th>
              <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Wine</th>
              <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Producer</th>
              <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Vintage</th>
              <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
              <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Issues</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr
              v-for="row in validatedRows"
              :key="row.rowIndex"
              :class="{ 'bg-red-50': !row.isValid, 'bg-amber-50': row.isDuplicate && row.isValid }"
            >
              <td class="px-3 py-2 whitespace-nowrap">{{ row.rowIndex }}</td>
              <td class="px-3 py-2 whitespace-nowrap">
                <span
                  v-if="!row.isValid"
                  class="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-800"
                >
                  Invalid
                </span>
                <span
                  v-else-if="row.isDuplicate"
                  class="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-800"
                >
                  Duplicate
                </span>
                <span
                  v-else
                  class="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800"
                >
                  OK
                </span>
              </td>
              <td class="px-3 py-2">{{ row.wineName }}</td>
              <td class="px-3 py-2">{{ row.producer }}</td>
              <td class="px-3 py-2">{{ row.vintage || 'NV' }}</td>
              <td class="px-3 py-2">{{ row.quantity }}</td>
              <td class="px-3 py-2 text-xs">
                <span v-if="row.errors.length" class="text-red-600">{{ row.errors.join(', ') }}</span>
                <span v-else-if="row.warnings.length" class="text-amber-600">{{ row.warnings.join(', ') }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-6 flex justify-between">
        <button type="button" class="btn-secondary" @click="currentStep = 2">
          Back
        </button>
        <button
          type="button"
          class="btn-primary"
          :disabled="validationSummary?.valid === 0 || isImporting"
          @click="executeImport"
        >
          {{ isImporting ? 'Importing...' : `Import ${validationSummary?.valid || 0} wines` }}
        </button>
      </div>
    </div>

    <!-- Step 4: Result -->
    <div v-if="currentStep === 4" class="card text-center py-12">
      <div v-if="importResult?.success || importResult?.imported > 0">
        <svg class="mx-auto h-16 w-16 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 class="mt-4 text-xl font-bold text-gray-900">Import Complete!</h2>
        <p class="mt-2 text-gray-600">
          Successfully imported <strong>{{ importResult.imported }}</strong> wines.
          <span v-if="importResult.skipped > 0">
            Skipped {{ importResult.skipped }} duplicates.
          </span>
        </p>
      </div>
      <div v-else>
        <svg class="mx-auto h-16 w-16 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 class="mt-4 text-xl font-bold text-gray-900">Import Failed</h2>
        <p class="mt-2 text-gray-600">
          {{ importResult?.errors?.[0]?.message || 'An error occurred during import.' }}
        </p>
      </div>

      <div class="mt-8 flex justify-center gap-4">
        <NuxtLink to="/inventory" class="btn-primary">
          View Inventory
        </NuxtLink>
        <button type="button" class="btn-secondary" @click="reset">
          Import More
        </button>
      </div>
    </div>
  </div>
</template>
