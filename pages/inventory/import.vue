<script setup lang="ts">
const { t } = useI18n()
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

definePageMeta({
  middleware: 'auth',
})

// Steps
const currentStep = ref(1)
const steps = computed(() => [
  { id: 1, name: t('import.stepUpload') }, // TODO: add i18n key
  { id: 2, name: t('import.stepMapColumns') }, // TODO: add i18n key
  { id: 3, name: t('import.stepPreview') }, // TODO: add i18n key
  { id: 4, name: t('import.stepImport') }, // TODO: add i18n key
])

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
const { data: cellarsData, refresh: refreshCellars } = await useFetch('/api/cellars')
const { data: regionsData } = await useFetch('/api/regions')
const { data: appellationsData } = await useFetch('/api/appellations')

// Cellar check
const showCreateCellarModal = ref(false)
const hasCellars = computed(() => (cellarsData.value?.length ?? 0) > 0)

onMounted(() => {
  if (!hasCellars.value) {
    showCreateCellarModal.value = true
  }
})

async function handleCellarsCreated() {
  await refreshCellars()
}

// Fields that support manual defaults with dropdowns
const _dropdownFields = ['cellar', 'region', 'appellation', 'color', 'format', 'purchaseCurrency']

// Color options for dropdown
const colorOptions = computed(() => [
  { value: 'red', label: t('colors.red') },
  { value: 'white', label: t('colors.white') },
  { value: 'rose', label: t('colors.rose') },
  { value: 'sparkling', label: t('colors.sparkling') },
  { value: 'dessert', label: t('colors.dessert') },
  { value: 'fortified', label: t('colors.fortified') },
])

// Format options - fetched from API
const { data: formatsData } = await useFetch('/api/formats')

// Currency options
const currencyOptions = ['EUR', 'USD', 'GBP', 'ZAR', 'CHF']

const requiredFields = ['cellar', 'producer', 'wineName', 'color', 'quantity']
const optionalFields = [
  'region', 'appellation', 'grapes', 'vintage', 'format',
  'purchaseDate', 'purchasePricePerBottle', 'purchaseCurrency', 'purchaseSource', 'notes',
]

const fieldLabels = computed<Record<string, string>>(() => ({
  cellar: t('inventory.cellar'),
  producer: t('inventory.producer'),
  wineName: t('addWineModal.wineName'),
  color: t('inventory.color'),
  region: t('inventory.region'),
  appellation: t('inventory.appellation'),
  grapes: t('inventory.grapes'),
  vintage: t('inventory.vintage'),
  format: t('inventory.format'),
  quantity: t('inventory.quantity'),
  purchaseDate: t('inventory.purchaseDate'),
  purchasePricePerBottle: t('inventory.pricePerBottle'),
  purchaseCurrency: t('import.currency'), // TODO: add i18n key
  purchaseSource: t('inventory.purchaseSource'),
  notes: t('inventory.notes'),
}))

// Step 3: Validation
const validatedRows = ref<any[]>([])
const validationSummary = ref<any>(null)
const isValidating = ref(false)
const skipDuplicates = ref(true)
const validationProgress = ref({ current: 0, total: 0 })

// Reference data for validation (fetched once)
const importReferenceData = ref<any>(null)
const isLoadingReferenceData = ref(false)

// Step 4: Import
const importResult = ref<any>(null)
const isImporting = ref(false)
const importProgress = ref({ current: 0, total: 0, imported: 0, skipped: 0, errors: [] as any[] })

// Toast notifications
const toasts = ref<{ id: number; message: string; type: 'success' | 'error' | 'warning' | 'info' }[]>([])
let toastId = 0

function showToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
  const id = ++toastId
  toasts.value.push({ id, message, type })
}

function removeToast(id: number) {
  toasts.value = toasts.value.filter(t => t.id !== id)
}

function parseExcelFile(file: File): Promise<{ headers: string[]; data: string[][] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as string[][]
        
        if (jsonData.length > 0) {
          resolve({
            headers: jsonData[0].map(h => String(h ?? '')),
            data: jsonData.slice(1).map(row => row.map(cell => String(cell ?? ''))),
          })
        } else {
          reject(new Error(t('import.excelEmpty'))) // TODO: add i18n key
        }
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error(t('import.failedReadFile'))) // TODO: add i18n key
    reader.readAsArrayBuffer(file)
  })
}

function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  fileName.value = file.name
  const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')

  if (isExcel) {
    parseExcelFile(file)
      .then((result) => {
        headers.value = result.headers
        rawData.value = result.data
        autoMapColumns()
        currentStep.value = 2
        showToast(t('import.loadedRows', { count: rawData.value.length, file: file.name }), 'success') // TODO: add i18n key
      })
      .catch((error) => {
        console.error('Excel parse error:', error)
        showToast(t('import.failedParseExcel', { message: error.message }), 'error') // TODO: add i18n key
      })
  } else {
    Papa.parse(file, {
      complete: (results) => {
        if (results.data.length > 0) {
          headers.value = results.data[0] as string[]
          rawData.value = results.data.slice(1) as string[][]
          autoMapColumns()
          currentStep.value = 2
          showToast(t('import.loadedRows', { count: rawData.value.length, file: file.name }), 'success') // TODO: add i18n key
        } else {
          showToast(t('import.csvEmpty'), 'error') // TODO: add i18n key
        }
      },
      error: (error) => {
        console.error('CSV parse error:', error)
        showToast(t('import.failedParseCsv', { message: error.message }), 'error') // TODO: add i18n key
      },
    })
  }
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
              const format = formatsData.value?.find((f: any) => f.id === defaultValue)
              mapped[field] = format?.name
            } else {
              mapped[field] = defaultValue
            }
          }
        }
      }
      return mapped
    })
}

// Color normalization map
const colorMap: Record<string, string> = {
  red: 'red', rouge: 'red',
  white: 'white', blanc: 'white',
  rose: 'rose', rosé: 'rose', pink: 'rose',
  sparkling: 'sparkling', champagne: 'sparkling', effervescent: 'sparkling',
  dessert: 'dessert', sweet: 'dessert', liquoreux: 'dessert',
  fortified: 'fortified', porto: 'fortified', port: 'fortified', sherry: 'fortified',
}

function normalizeColor(color: string): string | null {
  return colorMap[color?.toLowerCase().trim()] || null
}

function generateImportHash(row: any): string {
  const normalized = [
    row.producer?.toLowerCase().trim(),
    row.wineName?.toLowerCase().trim(),
    row.vintage?.toString() || 'nv',
    row.format?.toLowerCase().trim() || 'standard',
    row.cellar?.toLowerCase().trim(),
  ].join('|')
  return normalized
}

async function validateData() {
  isValidating.value = true
  validationProgress.value = { current: 0, total: 0 }
  
  try {
    if (!importReferenceData.value) {
      isLoadingReferenceData.value = true
      importReferenceData.value = await $fetch('/api/inventory/import/reference-data')
      isLoadingReferenceData.value = false
    }
    
    const refData = importReferenceData.value
    const hashSet = new Set(refData.existingHashes)
    const allRows = getMappedRows()
    
    validationProgress.value = { current: 0, total: allRows.length }
    validatedRows.value = []
    
    for (let i = 0; i < allRows.length; i++) {
      const row = allRows[i]
      const errors: string[] = []
      const warnings: string[] = []
      
      const importHash = generateImportHash(row)
      const isDuplicate = hashSet.has(importHash)
      
      if (isDuplicate) {
        warnings.push(t('import.duplicateWarning')) // TODO: add i18n key
      }
      
      if (!row.cellar) errors.push(t('import.cellarRequired')) // TODO: add i18n key
      if (!row.producer) errors.push(t('import.producerRequired')) // TODO: add i18n key
      if (!row.wineName) errors.push(t('import.wineNameRequired')) // TODO: add i18n key
      if (!row.color) errors.push(t('import.colorRequired')) // TODO: add i18n key
      if (!row.quantity || Number(row.quantity) < 1) errors.push(t('import.quantityRequired')) // TODO: add i18n key
      
      const cellar = refData.cellars.find((c: any) => c.name.toLowerCase() === row.cellar?.toLowerCase().trim())
      if (!cellar && row.cellar) {
        errors.push(t('import.cellarNotFound', { name: row.cellar })) // TODO: add i18n key
      }
      
      const normalizedColor = normalizeColor(row.color)
      if (!normalizedColor && row.color) {
        errors.push(t('import.invalidColor', { color: row.color })) // TODO: add i18n key
      }
      
      let regionId: number | undefined
      if (row.region) {
        const region = refData.regions.find((r: any) => r.name.toLowerCase() === row.region.toLowerCase().trim())
        if (region) regionId = region.id
      }
      
      let appellationId: number | undefined
      if (row.appellation) {
        const appellation = refData.appellations.find((a: any) => a.name.toLowerCase() === row.appellation.toLowerCase().trim())
        if (appellation) appellationId = appellation.id
      }
      
      let formatId: number | undefined
      const formatName = row.format?.toLowerCase().trim() || 'standard'
      const format = refData.formats.find((f: any) =>
        f.name.toLowerCase() === formatName ||
        (formatName === '75cl' && f.volumeMl === 750) ||
        (formatName === '750ml' && f.volumeMl === 750) ||
        (formatName === '150cl' && f.volumeMl === 1500) ||
        (formatName === '1500ml' && f.volumeMl === 1500)
      )
      if (format) {
        formatId = format.id
      } else {
        const standard = refData.formats.find((f: any) => f.volumeMl === 750)
        if (standard) {
          formatId = standard.id
          if (row.format && row.format.toLowerCase() !== 'standard') {
            warnings.push(t('import.formatNotFound', { format: row.format })) // TODO: add i18n key
          }
        } else {
          errors.push(t('import.formatResolveError')) // TODO: add i18n key
        }
      }
      
      const grapeIds: number[] = []
      if (row.grapes) {
        const grapeNames = row.grapes.split(';').map((g: string) => g.trim()).filter(Boolean)
        for (const grapeName of grapeNames) {
          const grape = refData.grapes.find((g: any) => g.name.toLowerCase() === grapeName.toLowerCase())
          if (grape) grapeIds.push(grape.id)
        }
      }
      
      let vintage: number | undefined
      if (row.vintage && row.vintage !== 'NV' && row.vintage !== 'nv' && row.vintage.toString().trim() !== '') {
        const v = Number(row.vintage)
        if (isNaN(v) || v < 1900 || v > 2100) {
          warnings.push(t('import.invalidVintage', { vintage: row.vintage })) // TODO: add i18n key
        } else {
          vintage = v
        }
      }
      
      validatedRows.value.push({
        ...row,
        rowIndex: i + 1,
        isValid: errors.length === 0,
        errors,
        warnings,
        cellarId: cellar?.id,
        regionId,
        appellationId,
        formatId,
        grapeIds,
        importHash,
        isDuplicate,
        color: normalizedColor || row.color,
        vintage,
        quantity: Number(row.quantity) || 0,
      })
      
      if (i % 50 === 0) {
        validationProgress.value.current = i
        await new Promise(r => setTimeout(r, 0))
      }
    }
    
    validationProgress.value.current = allRows.length
    
    const validCount = validatedRows.value.filter((r: any) => r.isValid).length
    const invalidCount = validatedRows.value.filter((r: any) => !r.isValid).length
    const duplicateCount = validatedRows.value.filter((r: any) => r.isDuplicate).length
    const warningCount = validatedRows.value.filter((r: any) => r.warnings?.length > 0).length
    const totalBottles = validatedRows.value.reduce((sum: number, r: any) => sum + (Number(r.quantity) || 0), 0)
    
    validationSummary.value = {
      total: validatedRows.value.length,
      totalBottles,
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
    const response = await $fetch('/api/inventory/import/execute', {
      method: 'POST',
      body: {
        rows: validRows,
        skipDuplicates: skipDuplicates.value,
      },
    })
    
    importResult.value = {
      success: response.errors.length === 0,
      imported: response.imported,
      skipped: response.skipped,
      errors: response.errors || [],
    }
    
    if (response.imported > 0) {
      showToast(t('import.importSuccess', { count: response.imported }), 'success') // TODO: add i18n key
    }
    if (response.errors.length > 0) {
      showToast(t('import.importRowsFailed', { count: response.errors.length }), 'warning') // TODO: add i18n key
    }
    
    currentStep.value = 4
  } catch (error: unknown) {
    const err = error as { data?: { message?: string }; message?: string }
    console.error('Import error:', error)
    const errorMessage = err.data?.message || err.message || t('import.importFailed') // TODO: add i18n key
    showToast(errorMessage, 'error')
    importResult.value = {
      success: false,
      imported: 0,
      skipped: 0,
      errors: [{ row: 0, message: errorMessage }],
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
      <h1 class="text-2xl font-bold text-muted-900">{{ $t('import.title') }}</h1>
      <p class="mt-1 text-sm text-muted-600">
        {{ $t('import.subtitle') }}
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
      <h2 class="text-lg font-semibold text-muted-900 mb-4">{{ $t('import.uploadFile') }}</h2>

      <div class="border-2 border-dashed border-muted-300 rounded-lg p-8 text-center">
        <svg class="mx-auto h-12 w-12 text-muted-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <div class="mt-4">
          <label class="cursor-pointer">
            <span class="btn-primary">{{ $t('import.selectFile') }}</span>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              class="hidden"
              @change="handleFileUpload"
            >
          </label>
        </div>
        <p class="mt-2 text-sm text-muted-500">
          {{ $t('import.fileHint') }}
        </p>
      </div>

      <div class="mt-6 p-4 bg-muted-100 rounded-lg border-2 border-muted-200">
        <h3 class="text-sm font-semibold text-muted-900 mb-2">{{ $t('import.expectedColumns') }}</h3>
        <div class="text-sm text-muted-600">
          <p><strong>{{ $t('import.required') }}:</strong> {{ $t('import.requiredColumns') }}</p>
          <p><strong>{{ $t('import.optional') }}:</strong> {{ $t('import.optionalColumns') }}</p>
        </div>
      </div>
    </div>

    <!-- Step 2: Column Mapping -->
    <div v-if="currentStep === 2" class="card">
      <h2 class="text-lg font-semibold text-muted-900 mb-4">{{ $t('import.mapColumns') }}</h2>
      <p class="text-sm text-muted-600 mb-6">
        {{ $t('import.mapColumnsDesc') }}
        <br >{{ $t('import.file') }}: <strong>{{ fileName }}</strong> ({{ $t('import.rowCount', { count: rawData.length }) }})
      </p>

      <div class="space-y-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <div v-for="field in requiredFields" :key="field">
            <label class="label">
              {{ fieldLabels[field] }} <span class="text-red-500">*</span>
            </label>
            <div class="flex gap-2">
              <select v-model="columnMapping[field]" class="input flex-1">
                <option value="">{{ $t('import.selectColumn') }}</option>
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
                  <option :value="null">{{ $t('import.setDefault') }}</option>
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
                  <option value="">{{ $t('import.setDefault') }}</option>
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
                  :placeholder="$t('import.defaultQty')"
                >
                <!-- Text input for other fields -->
                <input
                  v-else
                  v-model="manualDefaults[field]"
                  type="text"
                  class="input flex-1"
                  :placeholder="$t('import.defaultValue')"
                >
              </template>
            </div>
            <p v-if="!columnMapping[field] && manualDefaults[field]" class="mt-1 text-xs text-secondary-600">
              {{ $t('import.usingDefault') }}
            </p>
          </div>
        </div>

        <details class="mt-6" open>
          <summary class="cursor-pointer text-sm font-semibold text-muted-700">
            {{ $t('import.optionalFields') }}
          </summary>
          <div class="mt-4 grid gap-4 sm:grid-cols-2">
            <div v-for="field in optionalFields" :key="field">
              <label class="label">{{ fieldLabels[field] }}</label>
              <div class="flex gap-2">
                <select v-model="columnMapping[field]" class="input flex-1">
                  <option value="">{{ $t('import.notMapped') }}</option>
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
                    <option :value="null">{{ $t('import.setDefault') }}</option>
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
                    <option :value="null">{{ $t('import.setDefault') }}</option>
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
                    <option :value="null">{{ $t('import.setDefault') }}</option>
                    <option v-for="f in formatsData" :key="f.id" :value="f.id">
                      {{ f.name }} ({{ f.volumeMl }}ml)
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
                    :placeholder="$t('import.defaultVintage')"
                  >
                  <!-- Price input -->
                  <input
                    v-else-if="field === 'purchasePricePerBottle'"
                    v-model.number="manualDefaults[field]"
                    type="number"
                    min="0"
                    step="0.01"
                    class="input flex-1"
                    :placeholder="$t('import.defaultPrice')"
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
                  :placeholder="$t('import.defaultValue')"
                >
              </template>
            </div>
              <p v-if="!columnMapping[field] && manualDefaults[field]" class="mt-1 text-xs text-secondary-600">
                {{ $t('import.usingDefault') }}
              </p>
            </div>
          </div>
        </details>
      </div>

      <!-- Progress bar during validation -->
      <div v-if="isValidating" class="mt-6 p-4 bg-primary-50 rounded-lg border-2 border-primary-200">
        <div class="flex justify-between text-sm font-medium text-primary-700 mb-2">
          <span>{{ $t('import.validatingRows') }}</span>
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
          {{ $t('import.back') }}
        </button>
        <button
          type="button"
          class="btn-primary"
          :disabled="!mappingValid || isValidating"
          @click="validateData"
        >
          {{ isValidating ? $t('import.validating') : $t('import.validatePreview') }}
        </button>
      </div>
    </div>

    <!-- Step 3: Preview -->
    <div v-if="currentStep === 3" class="card">
      <h2 class="text-lg font-semibold text-muted-900 mb-4">{{ $t('import.previewValidate') }}</h2>

      <!-- Summary -->
      <div v-if="validationSummary" class="grid gap-4 sm:grid-cols-4 mb-6">
        <div class="p-3 bg-muted-100 rounded-lg border-2 border-muted-200">
          <p class="text-2xl font-bold text-muted-900">{{ validationSummary.totalBottles }}</p>
          <p class="text-sm font-semibold text-muted-600">{{ $t('import.totalBottles') }}</p>
        </div>
        <div class="p-3 bg-secondary-50 rounded-lg border-2 border-secondary-200">
          <p class="text-2xl font-bold text-secondary-700">{{ validationSummary.valid }}</p>
          <p class="text-sm font-semibold text-secondary-600">{{ $t('import.validRows') }}</p>
        </div>
        <div class="p-3 bg-red-50 rounded-lg border-2 border-red-200">
          <p class="text-2xl font-bold text-red-700">{{ validationSummary.invalid }}</p>
          <p class="text-sm font-semibold text-red-600">{{ $t('import.invalidRows') }}</p>
        </div>
        <div class="p-3 bg-accent-50 rounded-lg border-2 border-accent-200">
          <p class="text-2xl font-bold text-accent-700">{{ validationSummary.duplicates }}</p>
          <p class="text-sm font-semibold text-accent-600">{{ $t('import.duplicates') }}</p>
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
          <span class="ml-2 text-sm font-medium text-muted-700">{{ $t('import.skipDuplicates') }}</span>
        </label>
      </div>

      <!-- Row preview -->
      <div class="overflow-x-auto max-h-96 border-2 border-muted-200 rounded-lg">
        <table class="min-w-full divide-y divide-muted-200 text-sm">
          <thead class="bg-muted-100 sticky top-0">
            <tr>
              <th class="px-3 py-2 text-left text-xs font-bold text-muted-600 uppercase">{{ $t('import.row') }}</th>
              <th class="px-3 py-2 text-left text-xs font-bold text-muted-600 uppercase">{{ $t('import.status') }}</th>
              <th class="px-3 py-2 text-left text-xs font-bold text-muted-600 uppercase">{{ $t('import.wine') }}</th>
              <th class="px-3 py-2 text-left text-xs font-bold text-muted-600 uppercase">{{ $t('inventory.producer') }}</th>
              <th class="px-3 py-2 text-left text-xs font-bold text-muted-600 uppercase">{{ $t('inventory.vintage') }}</th>
              <th class="px-3 py-2 text-left text-xs font-bold text-muted-600 uppercase">{{ $t('import.qty') }}</th>
              <th class="px-3 py-2 text-left text-xs font-bold text-muted-600 uppercase">{{ $t('import.issues') }}</th>
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
                  {{ $t('import.invalid') }}
                </span>
                <span
                  v-else-if="row.isDuplicate"
                  class="px-2 py-0.5 text-xs font-semibold rounded bg-accent-100 text-accent-700"
                >
                  {{ $t('import.duplicate') }}
                </span>
                <span
                  v-else
                  class="px-2 py-0.5 text-xs font-semibold rounded bg-secondary-100 text-secondary-700"
                >
                  {{ $t('import.ok') }}
                </span>
              </td>
              <td class="px-3 py-2">{{ row.wineName }}</td>
              <td class="px-3 py-2">{{ row.producer }}</td>
              <td class="px-3 py-2">{{ row.vintage || $t('common.nv') }}</td>
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
          <span>{{ $t('import.importingWines') }}</span>
          <span>{{ importProgress.current }} / {{ importProgress.total }}</span>
        </div>
        <div class="w-full bg-primary-200 rounded-full h-3">
          <div
            class="bg-primary-600 h-3 rounded-full transition-all duration-300"
            :style="{ width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%` }"
          />
        </div>
        <div class="mt-2 flex gap-4 text-xs text-primary-600">
          <span>{{ $t('import.imported') }}: {{ importProgress.imported }}</span>
          <span>{{ $t('import.skipped') }}: {{ importProgress.skipped }}</span>
          <span v-if="importProgress.errors.length">{{ $t('import.errors') }}: {{ importProgress.errors.length }}</span>
        </div>
      </div>

      <div class="mt-6 flex justify-between">
        <button type="button" class="btn-secondary" :disabled="isImporting" @click="currentStep = 2">
          {{ $t('import.back') }}
        </button>
        <button
          type="button"
          class="btn-primary"
          :disabled="validationSummary?.valid === 0 || isImporting"
          @click="executeImport"
        >
          {{ isImporting ? $t('import.importing') : $t('import.importCount', { count: validationSummary?.valid || 0 }) }}
        </button>
      </div>
    </div>

    <!-- Step 4: Result -->
    <div v-if="currentStep === 4" class="card text-center py-12">
      <div v-if="importResult?.success || importResult?.imported > 0">
        <svg class="mx-auto h-16 w-16 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 class="mt-4 text-xl font-bold text-muted-900">{{ $t('import.importComplete') }}</h2>
        <p class="mt-2 text-muted-600">
          {{ $t('import.importedWines', { count: importResult.imported }) }}
          <span v-if="importResult.skipped > 0">
            {{ $t('import.skippedDuplicates', { count: importResult.skipped }) }}
          </span>
        </p>
      </div>
      <div v-else>
        <svg class="mx-auto h-16 w-16 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 class="mt-4 text-xl font-bold text-muted-900">{{ $t('import.importFailed') }}</h2>
        <p class="mt-2 text-muted-600">
          {{ importResult?.errors?.[0]?.message || $t('import.errorOccurred') }}
        </p>
      </div>

      <div class="mt-8 flex justify-center gap-4">
        <NuxtLink to="/inventory" class="btn-primary">
          {{ $t('import.viewInventory') }}
        </NuxtLink>
        <button type="button" class="btn-secondary" @click="reset">
          {{ $t('import.importMore') }}
        </button>
      </div>
    </div>

    <!-- Create Cellar Modal -->
    <CreateCellarModal
      v-model="showCreateCellarModal"
      @created="handleCellarsCreated"
    />

    <!-- Toast notifications -->
    <Teleport to="body">
      <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        <Toast
          v-for="toast in toasts"
          :key="toast.id"
          :message="toast.message"
          :type="toast.type"
          @close="removeToast(toast.id)"
        />
      </div>
    </Teleport>
  </div>
</template>
