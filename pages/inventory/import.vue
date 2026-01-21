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

// Manual default values for unmapped fields
const manualDefaults = ref<Record<string, any>>({
  cellar: null,
  producer: '',
  wineName: '',
  color: '',
  region: null,
  appellation: null,
  grapes: '',
  vintage: null,
  format: null,
  quantity: null,
  purchaseDate: '',
  purchasePricePerBottle: null,
  purchaseCurrency: 'EUR',
  purchaseSource: '',
  notes: '',
})

// Reference data for dropdowns
const { data: cellarsData } = await useFetch('/api/cellars')
const { data: regionsData } = await useFetch('/api/regions')
const { data: appellationsData } = await useFetch('/api/appellations')

// Fields that support manual defaults with dropdowns
const _dropdownFields = ['cellar', 'region', 'appellation', 'color', 'format', 'purchaseCurrency']

// Color options for dropdown
const colorOptions = [
  { value: 'red', label: 'Red' },
  { value: 'white', label: 'White' },
  { value: 'rose', label: 'Rosé' },
  { value: 'sparkling', label: 'Sparkling' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'fortified', label: 'Fortified' },
]

// Format options for dropdown
const formatOptions = [
  { id: 1, name: 'Bottle (750ml)' },
  { id: 2, name: 'Magnum (1.5L)' },
]

// Currency options
const currencyOptions = ['EUR', 'USD', 'GBP', 'ZAR', 'CHF']

const requiredFields = ['cellar', 'producer', 'wineName', 'color', 'quantity']
const optionalFields = [
  'region', 'appellation', 'grapes', 'vintage', 'format',
  'purchaseDate', 'purchasePricePerBottle', 'purchaseCurrency', 'purchaseSource', 'notes',
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
const importProgress = ref({ current: 0, total: 0, imported: 0, skipped: 0, errors: [] as any[] })

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
  // Required fields must either be mapped to a column OR have a manual default
  return requiredFields.every(field => {
    const hasMapping = !!columnMapping.value[field]
    const hasManualDefault = manualDefaults.value[field] !== null && manualDefaults.value[field] !== ''
    return hasMapping || hasManualDefault
  })
})

// Convert raw data to mapped rows
function getMappedRows() {
  return rawData.value
    .filter(row => row.some(cell => cell?.trim())) // Skip empty rows
    .map(row => {
      const mapped: any = {}
      for (const [field, header] of Object.entries(columnMapping.value)) {
        if (header) {
          // Field is mapped to a CSV column
          const index = headers.value.indexOf(header)
          if (index !== -1) {
            mapped[field] = row[index]?.trim() || undefined
          }
        } else {
          // Field is not mapped - use manual default if set
          const defaultValue = manualDefaults.value[field]
          if (defaultValue !== null && defaultValue !== '') {
            // For ID-based fields (cellar, region, appellation, format), we need to resolve the name
            if (field === 'cellar') {
              const cellar = cellarsData.value?.find((c: any) => c.id === defaultValue)
              mapped[field] = cellar?.name
            } else if (field === 'region') {
              const region = regionsData.value?.find((r: any) => r.id === defaultValue)
              mapped[field] = region?.name
            } else if (field === 'appellation') {
              const appellation = appellationsData.value?.find((a: any) => a.id === defaultValue)
              mapped[field] = appellation?.name
            } else if (field === 'format') {
              const format = formatOptions.find(f => f.id === defaultValue)
              mapped[field] = format?.name?.split(' ')[0] // Just "Bottle" or "Magnum"
            } else {
              mapped[field] = defaultValue
            }
          }
        }
      }
      return mapped
    })
}

// Validate with chunking
const VALIDATE_CHUNK_SIZE = 50
const validationProgress = ref({ current: 0, total: 0 })

async function validateData() {
  isValidating.value = true
  const allRows = getMappedRows()
  
  validationProgress.value = { current: 0, total: allRows.length }
  validatedRows.value = []
  
  try {
    for (let i = 0; i < allRows.length; i += VALIDATE_CHUNK_SIZE) {
      const chunk = allRows.slice(i, i + VALIDATE_CHUNK_SIZE)
      
      const response = await $fetch('/api/inventory/import/validate', {
        method: 'POST',
        body: { rows: chunk },
      })
      
      const adjustedRows = response.rows.map((row: any) => ({
        ...row,
        rowIndex: row.rowIndex + i,
      }))
      
      validatedRows.value.push(...adjustedRows)
      validationProgress.value.current = Math.min(i + VALIDATE_CHUNK_SIZE, allRows.length)
    }
    
    const validCount = validatedRows.value.filter((r: any) => r.isValid).length
    const invalidCount = validatedRows.value.filter((r: any) => !r.isValid).length
    const duplicateCount = validatedRows.value.filter((r: any) => r.isDuplicate).length
    const warningCount = validatedRows.value.filter((r: any) => r.warnings?.length > 0).length
    
    validationSummary.value = {
      total: validatedRows.value.length,
      valid: validCount,
      invalid: invalidCount,
      duplicates: duplicateCount,
      withWarnings: warningCount,
    }
    
    currentStep.value = 3
  } catch (error: any) {
    console.error('Validation error:', error)
  } finally {
    isValidating.value = false
  }
}

// Import with chunking
const CHUNK_SIZE = 25

async function executeImport() {
  isImporting.value = true
  
  const validRows = validatedRows.value.filter((r: any) => r.isValid && (!r.isDuplicate || !skipDuplicates.value))
  
  importProgress.value = {
    current: 0,
    total: validRows.length,
    imported: 0,
    skipped: 0,
    errors: [],
  }

  try {
    for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
      const chunk = validRows.slice(i, i + CHUNK_SIZE)
      
      try {
        const response = await $fetch('/api/inventory/import/execute', {
          method: 'POST',
          body: {
            rows: chunk,
            skipDuplicates: skipDuplicates.value,
          },
        })
        
        importProgress.value.imported += response.imported
        importProgress.value.skipped += response.skipped
        importProgress.value.errors.push(...(response.errors || []))
      } catch (error: any) {
        const chunkErrors = chunk.map((row: any) => ({
          row: row.rowIndex,
          message: error.data?.message || error.message || 'Chunk import failed',
        }))
        importProgress.value.errors.push(...chunkErrors)
      }
      
      importProgress.value.current = Math.min(i + CHUNK_SIZE, validRows.length)
    }
    
    importResult.value = {
      success: importProgress.value.errors.length === 0,
      imported: importProgress.value.imported,
      skipped: importProgress.value.skipped,
      errors: importProgress.value.errors,
    }
    currentStep.value = 4
  } catch (error: any) {
    console.error('Import error:', error)
    importResult.value = {
      success: false,
      imported: importProgress.value.imported,
      skipped: importProgress.value.skipped,
      errors: [{ row: 0, message: error.message || 'Import failed' }],
    }
    currentStep.value = 4
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
  // Reset manual defaults
  manualDefaults.value = {
    cellar: null,
    producer: '',
    wineName: '',
    color: '',
    region: null,
    appellation: null,
    grapes: '',
    vintage: null,
    format: null,
    quantity: null,
    purchaseDate: '',
    purchasePricePerBottle: null,
    purchaseCurrency: 'EUR',
    purchaseSource: '',
    notes: '',
  }
}
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-muted-900">Import Wines</h1>
      <p class="mt-1 text-sm text-muted-600">
        Import your wine inventory from a CSV file
      </p>
    </div>

    <!-- Progress steps -->
    <div class="mb-8">
      <nav class="flex items-center justify-center">
        <ol class="flex items-center space-x-2 sm:space-x-4">
          <li v-for="(step, index) in steps" :key="step.id" class="flex items-center">
            <span
              class="flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-all duration-200"
              :class="currentStep >= step.id
                ? 'bg-primary text-white'
                : 'bg-muted-200 text-muted-600'"
            >
              {{ step.id }}
            </span>
            <span
              class="ml-2 text-sm font-semibold hidden sm:block"
              :class="currentStep >= step.id ? 'text-primary' : 'text-muted-500'"
            >
              {{ step.name }}
            </span>
            <svg
              v-if="index < steps.length - 1"
              class="w-5 h-5 mx-2 text-muted-300"
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
      <h2 class="text-lg font-semibold text-muted-900 mb-4">Upload CSV File</h2>

      <div class="border-2 border-dashed border-muted-300 rounded-lg p-8 text-center">
        <svg class="mx-auto h-12 w-12 text-muted-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            >
          </label>
        </div>
        <p class="mt-2 text-sm text-muted-500">
          CSV file with headers in the first row
        </p>
      </div>

      <div class="mt-6 p-4 bg-muted-100 rounded-lg border-2 border-muted-200">
        <h3 class="text-sm font-semibold text-muted-900 mb-2">Expected columns:</h3>
        <div class="text-sm text-muted-600">
          <p><strong>Required:</strong> cellar, producer, wine name, color, quantity</p>
          <p><strong>Optional:</strong> region, appellation, grapes, vintage, format, purchase date, price, currency, source, notes</p>
        </div>
      </div>
    </div>

    <!-- Step 2: Column Mapping -->
    <div v-if="currentStep === 2" class="card">
      <h2 class="text-lg font-semibold text-muted-900 mb-4">Map Columns</h2>
      <p class="text-sm text-muted-600 mb-6">
        Match your CSV columns to the wine fields, or set a manual default value for all rows.
        <br >File: <strong>{{ fileName }}</strong> ({{ rawData.length }} rows)
      </p>

      <div class="space-y-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <div v-for="field in requiredFields" :key="field">
            <label class="label">
              {{ fieldLabels[field] }} <span class="text-red-500">*</span>
            </label>
            <div class="flex gap-2">
              <select v-model="columnMapping[field]" class="input flex-1">
                <option value="">-- Select column --</option>
                <option v-for="header in headers" :key="header" :value="header">
                  {{ header }}
                </option>
              </select>
              <!-- Manual default when not mapped -->
              <template v-if="!columnMapping[field]">
                <!-- Cellar dropdown -->
                <select
                  v-if="field === 'cellar'"
                  v-model="manualDefaults[field]"
                  class="input flex-1"
                >
                  <option :value="null">-- Set default --</option>
                  <option v-for="c in cellarsData" :key="c.id" :value="c.id">
                    {{ c.name }}
                  </option>
                </select>
                <!-- Color dropdown -->
                <select
                  v-else-if="field === 'color'"
                  v-model="manualDefaults[field]"
                  class="input flex-1"
                >
                  <option value="">-- Set default --</option>
                  <option v-for="opt in colorOptions" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
                <!-- Quantity input -->
                <input
                  v-else-if="field === 'quantity'"
                  v-model.number="manualDefaults[field]"
                  type="number"
                  min="0"
                  class="input flex-1"
                  placeholder="Default qty"
                >
                <!-- Text input for other fields -->
                <input
                  v-else
                  v-model="manualDefaults[field]"
                  type="text"
                  class="input flex-1"
                  placeholder="Default value"
                >
              </template>
            </div>
            <p v-if="!columnMapping[field] && manualDefaults[field]" class="mt-1 text-xs text-secondary-600">
              Using default for all rows
            </p>
          </div>
        </div>

        <details class="mt-6" open>
          <summary class="cursor-pointer text-sm font-semibold text-muted-700">
            Optional fields
          </summary>
          <div class="mt-4 grid gap-4 sm:grid-cols-2">
            <div v-for="field in optionalFields" :key="field">
              <label class="label">{{ fieldLabels[field] }}</label>
              <div class="flex gap-2">
                <select v-model="columnMapping[field]" class="input flex-1">
                  <option value="">-- Not mapped --</option>
                  <option v-for="header in headers" :key="header" :value="header">
                    {{ header }}
                  </option>
                </select>
                <!-- Manual default when not mapped -->
                <template v-if="!columnMapping[field]">
                  <!-- Region dropdown -->
                  <select
                    v-if="field === 'region'"
                    v-model="manualDefaults[field]"
                    class="input flex-1"
                  >
                    <option :value="null">-- Set default --</option>
                    <option v-for="r in regionsData" :key="r.id" :value="r.id">
                      {{ r.name }}
                    </option>
                  </select>
                  <!-- Appellation dropdown -->
                  <select
                    v-else-if="field === 'appellation'"
                    v-model="manualDefaults[field]"
                    class="input flex-1"
                  >
                    <option :value="null">-- Set default --</option>
                    <option v-for="a in appellationsData" :key="a.id" :value="a.id">
                      {{ a.name }}
                    </option>
                  </select>
                  <!-- Format dropdown -->
                  <select
                    v-else-if="field === 'format'"
                    v-model="manualDefaults[field]"
                    class="input flex-1"
                  >
                    <option :value="null">-- Set default --</option>
                    <option v-for="f in formatOptions" :key="f.id" :value="f.id">
                      {{ f.name }}
                    </option>
                  </select>
                  <!-- Currency dropdown -->
                  <select
                    v-else-if="field === 'purchaseCurrency'"
                    v-model="manualDefaults[field]"
                    class="input flex-1"
                  >
                    <option v-for="curr in currencyOptions" :key="curr" :value="curr">
                      {{ curr }}
                    </option>
                  </select>
                  <!-- Vintage input -->
                  <input
                    v-else-if="field === 'vintage'"
                    v-model.number="manualDefaults[field]"
                    type="number"
                    min="1900"
                    max="2100"
                    class="input flex-1"
                    placeholder="Default vintage"
                  >
                  <!-- Price input -->
                  <input
                    v-else-if="field === 'purchasePricePerBottle'"
                    v-model.number="manualDefaults[field]"
                    type="number"
                    min="0"
                    step="0.01"
                    class="input flex-1"
                    placeholder="Default price"
                  >
                  <!-- Date input -->
                  <input
                    v-else-if="field === 'purchaseDate'"
                    v-model="manualDefaults[field]"
                    type="date"
                    class="input flex-1"
                  >
                  <!-- Text input for other fields -->
                  <input
                    v-else
                    v-model="manualDefaults[field]"
                    type="text"
                    class="input flex-1"
                    placeholder="Default value"
                  >
                </template>
              </div>
              <p v-if="!columnMapping[field] && manualDefaults[field]" class="mt-1 text-xs text-secondary-600">
                Using default for all rows
              </p>
            </div>
          </div>
        </details>
      </div>

      <!-- Progress bar during validation -->
      <div v-if="isValidating" class="mt-6 p-4 bg-primary-50 rounded-lg border-2 border-primary-200">
        <div class="flex justify-between text-sm font-medium text-primary-700 mb-2">
          <span>Validating rows...</span>
          <span>{{ validationProgress.current }} / {{ validationProgress.total }}</span>
        </div>
        <div class="w-full bg-primary-200 rounded-full h-3">
          <div
            class="bg-primary-600 h-3 rounded-full transition-all duration-300"
            :style="{ width: `${validationProgress.total > 0 ? (validationProgress.current / validationProgress.total) * 100 : 0}%` }"
          />
        </div>
      </div>

      <div class="mt-6 flex justify-between">
        <button type="button" class="btn-secondary" :disabled="isValidating" @click="currentStep = 1">
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
      <h2 class="text-lg font-semibold text-muted-900 mb-4">Preview & Validate</h2>

      <!-- Summary -->
      <div v-if="validationSummary" class="grid gap-4 sm:grid-cols-4 mb-6">
        <div class="p-3 bg-muted-100 rounded-lg border-2 border-muted-200">
          <p class="text-2xl font-bold text-muted-900">{{ validationSummary.total }}</p>
          <p class="text-sm font-semibold text-muted-600">Total rows</p>
        </div>
        <div class="p-3 bg-secondary-50 rounded-lg border-2 border-secondary-200">
          <p class="text-2xl font-bold text-secondary-700">{{ validationSummary.valid }}</p>
          <p class="text-sm font-semibold text-secondary-600">Valid</p>
        </div>
        <div class="p-3 bg-red-50 rounded-lg border-2 border-red-200">
          <p class="text-2xl font-bold text-red-700">{{ validationSummary.invalid }}</p>
          <p class="text-sm font-semibold text-red-600">Invalid</p>
        </div>
        <div class="p-3 bg-accent-50 rounded-lg border-2 border-accent-200">
          <p class="text-2xl font-bold text-accent-700">{{ validationSummary.duplicates }}</p>
          <p class="text-sm font-semibold text-accent-600">Duplicates</p>
        </div>
      </div>

      <!-- Options -->
      <div class="mb-6">
        <label class="flex items-center">
          <input
            v-model="skipDuplicates"
            type="checkbox"
            class="w-4 h-4 text-primary border-2 border-muted-300 rounded focus:ring-primary focus:ring-offset-2"
          >
          <span class="ml-2 text-sm font-medium text-muted-700">Skip duplicate entries</span>
        </label>
      </div>

      <!-- Row preview -->
      <div class="overflow-x-auto max-h-96 border-2 border-muted-200 rounded-lg">
        <table class="min-w-full divide-y divide-muted-200 text-sm">
          <thead class="bg-muted-100 sticky top-0">
            <tr>
              <th class="px-3 py-2 text-left text-xs font-bold text-muted-600 uppercase">Row</th>
              <th class="px-3 py-2 text-left text-xs font-bold text-muted-600 uppercase">Status</th>
              <th class="px-3 py-2 text-left text-xs font-bold text-muted-600 uppercase">Wine</th>
              <th class="px-3 py-2 text-left text-xs font-bold text-muted-600 uppercase">Producer</th>
              <th class="px-3 py-2 text-left text-xs font-bold text-muted-600 uppercase">Vintage</th>
              <th class="px-3 py-2 text-left text-xs font-bold text-muted-600 uppercase">Qty</th>
              <th class="px-3 py-2 text-left text-xs font-bold text-muted-600 uppercase">Issues</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-muted-200">
            <tr
              v-for="row in validatedRows"
              :key="row.rowIndex"
              :class="{ 'bg-red-50': !row.isValid, 'bg-accent-50': row.isDuplicate && row.isValid }"
            >
              <td class="px-3 py-2 whitespace-nowrap font-medium">{{ row.rowIndex }}</td>
              <td class="px-3 py-2 whitespace-nowrap">
                <span
                  v-if="!row.isValid"
                  class="px-2 py-0.5 text-xs font-semibold rounded bg-red-100 text-red-700"
                >
                  Invalid
                </span>
                <span
                  v-else-if="row.isDuplicate"
                  class="px-2 py-0.5 text-xs font-semibold rounded bg-accent-100 text-accent-700"
                >
                  Duplicate
                </span>
                <span
                  v-else
                  class="px-2 py-0.5 text-xs font-semibold rounded bg-secondary-100 text-secondary-700"
                >
                  OK
                </span>
              </td>
              <td class="px-3 py-2">{{ row.wineName }}</td>
              <td class="px-3 py-2">{{ row.producer }}</td>
              <td class="px-3 py-2">{{ row.vintage || 'NV' }}</td>
              <td class="px-3 py-2">{{ row.quantity }}</td>
              <td class="px-3 py-2 text-xs">
                <span v-if="row.errors.length" class="text-red-600 font-medium">{{ row.errors.join(', ') }}</span>
                <span v-else-if="row.warnings.length" class="text-accent-600 font-medium">{{ row.warnings.join(', ') }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Progress bar during import -->
      <div v-if="isImporting" class="mt-6 p-4 bg-primary-50 rounded-lg border-2 border-primary-200">
        <div class="flex justify-between text-sm font-medium text-primary-700 mb-2">
          <span>Importing wines...</span>
          <span>{{ importProgress.current }} / {{ importProgress.total }}</span>
        </div>
        <div class="w-full bg-primary-200 rounded-full h-3">
          <div
            class="bg-primary-600 h-3 rounded-full transition-all duration-300"
            :style="{ width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%` }"
          />
        </div>
        <div class="mt-2 flex gap-4 text-xs text-primary-600">
          <span>Imported: {{ importProgress.imported }}</span>
          <span>Skipped: {{ importProgress.skipped }}</span>
          <span v-if="importProgress.errors.length">Errors: {{ importProgress.errors.length }}</span>
        </div>
      </div>

      <div class="mt-6 flex justify-between">
        <button type="button" class="btn-secondary" :disabled="isImporting" @click="currentStep = 2">
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
        <svg class="mx-auto h-16 w-16 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 class="mt-4 text-xl font-bold text-muted-900">Import Complete!</h2>
        <p class="mt-2 text-muted-600">
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
        <h2 class="mt-4 text-xl font-bold text-muted-900">Import Failed</h2>
        <p class="mt-2 text-muted-600">
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
