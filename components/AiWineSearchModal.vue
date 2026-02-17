<script setup lang="ts">
// TODO: i18n keys for all hardcoded strings

const props = defineProps<{
  modelValue: boolean
  searchText: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'addExisting': [wineId: number]
  'addNew': [parsed: ParsedWine]
}>()

interface ParsedWine {
  producer: string
  wineName: string
  vintage: number | null
  color: string
  region: string | null
  appellation: string | null
}

interface WineMatch {
  wine: { id: number; name: string; color: string }
  producer: { id: number; name: string }
  region: { id: number; name: string } | null
  score: number
}

// State
const loading = ref(false)
const error = ref('')
const parsed = ref<ParsedWine | null>(null)
const matches = ref<WineMatch[]>([])
const currentMatchIndex = ref(0)
const step = ref<'loading' | 'match' | 'no-match' | 'inventory' | 'error'>('loading')

// Inventory form (for adding to existing wine)
const selectedWineId = ref<number | null>(null)
const { data: cellars } = await useFetch('/api/cellars')
const { data: formats } = await useFetch('/api/formats')

const inventoryForm = ref({
  cellarId: undefined as number | undefined,
  formatId: undefined as number | undefined,
  vintage: undefined as number | undefined,
  quantity: 1,
  purchaseDate: '',
  purchasePricePerBottle: '',
  purchaseCurrency: 'EUR',
  purchaseSource: '',
})

const isSubmitting = ref(false)

// Show AddWineModal with prefilled data
const showAddWineModal = ref(false)

function closeModal() {
  emit('update:modelValue', false)
  // Reset state
  step.value = 'loading'
  parsed.value = null
  matches.value = []
  currentMatchIndex.value = 0
  error.value = ''
  selectedWineId.value = null
}

async function doSearch() {
  loading.value = true
  error.value = ''
  step.value = 'loading'

  try {
    const result = await $fetch<{ parsed: ParsedWine; matches: WineMatch[] }>('/api/wines/ai-search', {
      method: 'POST',
      body: { text: props.searchText },
    })

    parsed.value = result.parsed
    matches.value = result.matches

    if (result.matches.length > 0) {
      currentMatchIndex.value = 0
      step.value = 'match'
    } else {
      step.value = 'no-match'
    }
  } catch (e: any) {
    error.value = e?.data?.message || 'Failed to parse wine. Please try again.'
    step.value = 'error'
  } finally {
    loading.value = false
  }
}

function handleYes(match: WineMatch) {
  selectedWineId.value = match.wine.id
  // Pre-fill vintage from parsed data
  inventoryForm.value.vintage = parsed.value?.vintage || undefined
  // Set defaults
  if (cellars.value?.length) {
    inventoryForm.value.cellarId = cellars.value[0].id
  }
  if (formats.value?.length) {
    const standard = formats.value.find((f: any) => f.volumeMl === 750)
    if (standard) inventoryForm.value.formatId = standard.id
  }
  step.value = 'inventory'
}

function handleNotThisOne() {
  if (currentMatchIndex.value < matches.value.length - 1) {
    currentMatchIndex.value++
  } else {
    // No more matches, fall back to add new
    step.value = 'no-match'
  }
}

function handleAddNew() {
  if (parsed.value) {
    emit('addNew', parsed.value)
  }
  closeModal()
}

async function handleSubmitInventory() {
  if (!selectedWineId.value) return
  isSubmitting.value = true
  error.value = ''

  try {
    await $fetch('/api/inventory', {
      method: 'POST',
      body: {
        wineId: selectedWineId.value,
        cellarId: inventoryForm.value.cellarId,
        formatId: inventoryForm.value.formatId,
        vintage: inventoryForm.value.vintage,
        quantity: inventoryForm.value.quantity,
        purchaseDate: inventoryForm.value.purchaseDate || undefined,
        purchasePricePerBottle: inventoryForm.value.purchasePricePerBottle || undefined,
        purchaseCurrency: inventoryForm.value.purchaseCurrency,
        purchaseSource: inventoryForm.value.purchaseSource || undefined,
      },
    })

    emit('addExisting', selectedWineId.value)
    closeModal()
  } catch (e: any) {
    error.value = e?.data?.message || 'Failed to add to inventory.'
  } finally {
    isSubmitting.value = false
  }
}

const currentMatch = computed(() => matches.value[currentMatchIndex.value])

const colorLabels: Record<string, string> = {
  red: 'Red', white: 'White', rose: 'Rosé', sparkling: 'Sparkling', dessert: 'Dessert', fortified: 'Fortified',
}

const currencyOptions = [
  { value: 'EUR', label: 'EUR' },
  { value: 'USD', label: 'USD' },
  { value: 'GBP', label: 'GBP' },
  { value: 'ZAR', label: 'ZAR' },
  { value: 'CHF', label: 'CHF' },
]

// Trigger search when modal opens
watch(() => props.modelValue, (isOpen) => {
  if (isOpen && props.searchText) {
    doSearch()
  }
})

// Handle escape key
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.modelValue) {
    closeModal()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 overflow-y-auto"
      >
        <!-- Backdrop -->
        <div
          class="fixed inset-0 bg-muted-900/50"
          @click="closeModal"
        />

        <!-- Modal -->
        <div class="relative min-h-screen flex items-center justify-center p-4">
          <Transition
            enter-active-class="transition ease-out duration-200"
            enter-from-class="opacity-0 scale-95"
            enter-to-class="opacity-100 scale-100"
            leave-active-class="transition ease-in duration-150"
            leave-from-class="opacity-100 scale-100"
            leave-to-class="opacity-0 scale-95"
          >
            <div
              v-if="modelValue"
              class="relative bg-white rounded-xl border-2 border-muted-200 w-full max-w-md"
              @click.stop
            >
              <!-- Header -->
              <div class="bg-white border-b border-muted-200 px-6 py-4 flex items-center justify-between">
                <!-- TODO: i18n -->
                <h2 class="text-xl font-semibold text-muted-900">Add Wine with AI</h2>
                <button
                  type="button"
                  class="text-muted-400 hover:text-muted-600 transition-transform hover:scale-105"
                  @click="closeModal"
                >
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <!-- Content -->
              <div class="p-6">
                <!-- Search text display -->
                <div class="mb-4 px-3 py-2 bg-muted-50 rounded-lg border border-muted-200">
                  <p class="text-sm text-muted-500">You searched for:</p>
                  <p class="font-medium text-muted-900">{{ searchText }}</p>
                </div>

                <!-- Loading State -->
                <div v-if="step === 'loading'" class="text-center py-8">
                  <svg class="animate-spin h-8 w-8 text-primary mx-auto mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <!-- TODO: i18n -->
                  <p class="text-muted-600 font-medium">Parsing your wine...</p>
                  <p class="text-sm text-muted-400 mt-1">Searching your cellar for matches</p>
                </div>

                <!-- Error State -->
                <div v-else-if="step === 'error'" class="space-y-4">
                  <div class="p-3 text-sm text-red-700 bg-red-50 rounded-lg">
                    {{ error }}
                  </div>
                  <div class="flex justify-end gap-3">
                    <button type="button" class="btn-secondary" @click="closeModal">Cancel</button>
                    <button type="button" class="btn-primary" @click="doSearch">Try Again</button>
                  </div>
                </div>

                <!-- Match Found -->
                <div v-else-if="step === 'match'" class="space-y-4">
                  <p class="text-sm font-semibold text-muted-700">Here's what we found:</p>

                  <!-- Existing matches -->
                  <div class="space-y-2 max-h-64 overflow-y-auto">
                    <button
                      v-for="(match, i) in matches"
                      :key="i"
                      type="button"
                      class="w-full text-left bg-muted-50 rounded-lg p-4 border-2 border-muted-200 hover:border-primary-400 hover:bg-primary-50/30 transition-colors cursor-pointer"
                      @click="handleYes(match)"
                    >
                      <div class="flex items-center justify-between">
                        <div>
                          <h3 class="font-semibold text-muted-900">{{ match.wine.name }}</h3>
                          <p class="text-sm text-muted-600 mt-1">{{ match.producer.name }}</p>
                        </div>
                        <div class="flex items-center gap-2 flex-shrink-0">
                          <span class="text-xs text-muted-400 bg-muted-100 px-2 py-0.5 rounded-full">In cellar</span>
                          <svg class="w-5 h-5 text-muted-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                      <div class="flex flex-wrap gap-2 mt-2">
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                          {{ colorLabels[match.wine.color] || match.wine.color }}
                        </span>
                        <span v-if="match.region" class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted-100 text-muted-700">
                          {{ match.region.name }}
                        </span>
                      </div>
                    </button>
                  </div>

                  <!-- Divider -->
                  <div class="flex items-center gap-3">
                    <div class="flex-1 border-t border-muted-200" />
                    <span class="text-xs text-muted-400">or</span>
                    <div class="flex-1 border-t border-muted-200" />
                  </div>

                  <!-- Add as new wine option -->
                  <button
                    type="button"
                    class="w-full text-left bg-white rounded-lg p-4 border-2 border-dashed border-muted-300 hover:border-primary-400 hover:bg-primary-50/30 transition-colors cursor-pointer"
                    @click="handleAddNew"
                  >
                    <div class="flex items-center justify-between">
                      <div>
                        <h3 class="font-semibold text-muted-900">Add as new wine</h3>
                        <p class="text-sm text-muted-500 mt-0.5">{{ parsed?.wineName }} — {{ parsed?.producer }}</p>
                      </div>
                      <svg class="w-5 h-5 text-primary-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                  </button>

                  <button type="button" class="text-sm text-muted-500 hover:text-muted-700" @click="closeModal">Cancel</button>
                </div>

                <!-- No Match / AI Parsed -->
                <div v-else-if="step === 'no-match' && parsed" class="space-y-4">
                  <p class="text-sm font-semibold text-muted-700">Here's what we found:</p>

                  <!-- AI parsed result — clickable -->
                  <button
                    type="button"
                    class="w-full text-left bg-muted-50 rounded-lg p-4 border-2 border-muted-200 hover:border-primary-400 hover:bg-primary-50/30 transition-colors cursor-pointer"
                    @click="handleAddNew"
                  >
                    <div class="flex items-center justify-between">
                      <div>
                        <h3 class="font-semibold text-muted-900">{{ parsed.wineName }}</h3>
                        <p class="text-sm text-muted-600 mt-1">{{ parsed.producer }}</p>
                      </div>
                      <svg class="w-5 h-5 text-muted-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <div class="flex flex-wrap gap-2 mt-2">
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                        {{ colorLabels[parsed.color] || parsed.color }}
                      </span>
                      <span v-if="parsed.region" class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted-100 text-muted-700">
                        {{ parsed.region }}
                      </span>
                      <span v-if="parsed.vintage" class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted-100 text-muted-700">
                        {{ parsed.vintage }}
                      </span>
                      <span v-if="parsed.appellation" class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-secondary-100 text-secondary-700">
                        {{ parsed.appellation }}
                      </span>
                    </div>
                    <p class="text-xs text-primary-600 font-medium mt-3">Tap to add this wine →</p>
                  </button>

                  <button type="button" class="text-sm text-muted-500 hover:text-muted-700" @click="closeModal">Cancel</button>
                </div>

                <!-- Inventory Form (adding to existing wine) -->
                <div v-else-if="step === 'inventory'" class="space-y-4">
                  <!-- TODO: i18n -->
                  <p class="text-sm font-semibold text-muted-700">Add to your cellar</p>

                  <div v-if="error" class="p-3 text-sm text-red-700 bg-red-50 rounded-lg">
                    {{ error }}
                  </div>

                  <div class="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label class="label font-semibold">Cellar <span class="text-red-500">*</span></label>
                      <select v-model="inventoryForm.cellarId" required class="input">
                        <option v-for="c in cellars" :key="c.id" :value="c.id">{{ c.name }}</option>
                      </select>
                    </div>

                    <div>
                      <label class="label font-semibold">Vintage</label>
                      <input v-model.number="inventoryForm.vintage" type="number" min="1900" max="2100" class="input" placeholder="NV">
                    </div>

                    <div>
                      <label class="label font-semibold">Format <span class="text-red-500">*</span></label>
                      <select v-model="inventoryForm.formatId" required class="input">
                        <option v-for="f in formats" :key="f.id" :value="f.id">{{ f.name }}</option>
                      </select>
                    </div>

                    <div>
                      <label class="label font-semibold">Quantity <span class="text-red-500">*</span></label>
                      <input v-model.number="inventoryForm.quantity" type="number" min="1" required class="input">
                    </div>

                    <div>
                      <label class="label font-semibold">Purchase Date</label>
                      <input v-model="inventoryForm.purchaseDate" type="date" class="input">
                    </div>

                    <div>
                      <label class="label font-semibold">Price per Bottle</label>
                      <div class="flex gap-2">
                        <input v-model="inventoryForm.purchasePricePerBottle" type="number" step="0.01" min="0" class="input flex-1" placeholder="0.00">
                        <select v-model="inventoryForm.purchaseCurrency" class="input w-20">
                          <option v-for="opt in currencyOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                        </select>
                      </div>
                    </div>

                    <div class="sm:col-span-2">
                      <label class="label font-semibold">Source</label>
                      <input v-model="inventoryForm.purchaseSource" type="text" class="input" placeholder="e.g., Wine merchant">
                    </div>
                  </div>

                  <div class="flex justify-end gap-3 pt-4 border-t border-muted-200">
                    <button type="button" class="btn-secondary" @click="step = 'match'; error = ''">Back</button>
                    <button
                      type="button"
                      :disabled="isSubmitting || !inventoryForm.cellarId || !inventoryForm.formatId"
                      class="btn-primary"
                      @click="handleSubmitInventory"
                    >
                      {{ isSubmitting ? 'Adding...' : 'Add to Cellar' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
