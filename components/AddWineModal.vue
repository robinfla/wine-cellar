<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
  defaultProducer?: string
  wineOnly?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'success': [wineId: number]
}>()

// Fetch reference data
const { data: cellars } = await useFetch('/api/cellars')
const { data: regions, refresh: refreshRegions } = await useFetch('/api/regions')
const { data: formats } = await useFetch('/api/formats')
const { data: grapesList } = await useFetch('/api/grapes')

// Create new entry state
const showNewRegion = ref(false)
const showNewAppellation = ref(false)
const newRegionName = ref('')
const newAppellationName = ref('')
const isCreatingRegion = ref(false)
const isCreatingAppellation = ref(false)

// Form state
const form = ref({
  // Wine info
  producer: '',
  wineName: '',
  color: 'red',
  regionId: undefined as number | undefined,
  appellationId: undefined as number | undefined,

  // Inventory info
  cellarId: undefined as number | undefined,
  formatId: undefined as number | undefined,
  vintage: undefined as number | undefined,
  quantity: 1,

  // Purchase info
  purchaseDate: '',
  purchasePricePerBottle: '',
  purchaseCurrency: 'EUR',
  purchaseSource: '',
  notes: '',
})

const selectedGrapes = ref<number[]>([])

// Fetch appellations based on selected region
const { data: appellations, refresh: refreshAppellations } = await useFetch('/api/appellations', {
  query: computed(() => ({
    regionId: form.value.regionId || undefined,
  })),
  watch: [() => form.value.regionId],
})

// Create new region
async function createRegion() {
  if (!newRegionName.value.trim()) return
  isCreatingRegion.value = true
  try {
    const newRegion = await $fetch<{ id: number; name: string }>('/api/regions', {
      method: 'POST',
      body: { name: newRegionName.value.trim(), countryCode: 'FR' },
    })
    await refreshRegions()
    form.value.regionId = newRegion.id
    newRegionName.value = ''
    showNewRegion.value = false
  } catch (e) {
    console.error('Failed to create region', e)
  } finally {
    isCreatingRegion.value = false
  }
}

// Create new appellation
async function createAppellation() {
  if (!newAppellationName.value.trim()) return
  isCreatingAppellation.value = true
  try {
    const newAppellation = await $fetch<{ id: number; name: string }>('/api/appellations', {
      method: 'POST',
      body: { name: newAppellationName.value.trim(), regionId: form.value.regionId },
    })
    await refreshAppellations()
    form.value.appellationId = newAppellation.id
    newAppellationName.value = ''
    showNewAppellation.value = false
  } catch (e) {
    console.error('Failed to create appellation', e)
  } finally {
    isCreatingAppellation.value = false
  }
}

// Reset appellation when region changes
watch(() => form.value.regionId, () => {
  form.value.appellationId = undefined
})

const isSubmitting = ref(false)
const error = ref('')

const colorOptions = [
  { value: 'red', label: 'Red' },
  { value: 'white', label: 'White' },
  { value: 'rose', label: 'Rose' },
  { value: 'sparkling', label: 'Sparkling' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'fortified', label: 'Fortified' },
]

const currencyOptions = [
  { value: 'EUR', label: 'EUR' },
  { value: 'USD', label: 'USD' },
  { value: 'GBP', label: 'GBP' },
  { value: 'ZAR', label: 'ZAR' },
  { value: 'CHF', label: 'CHF' },
]

function closeModal() {
  emit('update:modelValue', false)
}

function resetForm() {
  form.value = {
    producer: '',
    wineName: '',
    color: 'red',
    regionId: undefined,
    appellationId: undefined,
    cellarId: cellars.value?.length ? cellars.value[0].id : undefined,
    formatId: formats.value?.find(f => f.volumeMl === 750)?.id,
    vintage: undefined,
    quantity: 1,
    purchaseDate: '',
    purchasePricePerBottle: '',
    purchaseCurrency: 'EUR',
    purchaseSource: '',
    notes: '',
  }
  selectedGrapes.value = []
  error.value = ''
  showNewRegion.value = false
  showNewAppellation.value = false
  newRegionName.value = ''
  newAppellationName.value = ''
}

async function handleSubmit() {
  error.value = ''
  isSubmitting.value = true

  try {
    // First, create or find producer
    const producer = await $fetch('/api/producers', {
      method: 'POST',
      body: {
        name: form.value.producer,
        regionId: form.value.regionId,
      },
    })

    // Create wine
    const wine = await $fetch('/api/wines', {
      method: 'POST',
      body: {
        name: form.value.wineName,
        producerId: producer.id,
        color: form.value.color,
        appellationId: form.value.appellationId,
        grapeIds: selectedGrapes.value.map(id => ({ grapeId: id })),
      },
    })

    // Create inventory lot (skip if wineOnly mode)
    if (!props.wineOnly) {
      await $fetch('/api/inventory', {
        method: 'POST',
        body: {
          wineId: wine.id,
          cellarId: form.value.cellarId,
          formatId: form.value.formatId,
          vintage: form.value.vintage,
          quantity: form.value.quantity,
          purchaseDate: form.value.purchaseDate || undefined,
          purchasePricePerBottle: form.value.purchasePricePerBottle || undefined,
          purchaseCurrency: form.value.purchaseCurrency,
          purchaseSource: form.value.purchaseSource || undefined,
          notes: form.value.notes || undefined,
        },
      })
    }

    emit('success', wine.id)
    closeModal()
    resetForm()
  } catch (e: any) {
    error.value = e.data?.message || 'Failed to add wine. Please try again.'
  } finally {
    isSubmitting.value = false
  }
}

// Handle escape key
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.modelValue) {
    closeModal()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  // Set defaults
  if (cellars.value?.length) {
    form.value.cellarId = cellars.value[0].id
  }
  if (formats.value?.length) {
    const standard = formats.value.find(f => f.volumeMl === 750)
    if (standard) {
      form.value.formatId = standard.id
    }
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

// Reset form when modal opens
watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    resetForm()
    // Pre-fill producer if provided
    if (props.defaultProducer) {
      form.value.producer = props.defaultProducer
    }
  }
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
              class="relative bg-white rounded-xl border-2 border-muted-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              @click.stop
            >
              <!-- Header -->
              <div class="bg-white border-b border-muted-200 px-6 py-4 flex items-center justify-between">
                <h2 class="text-xl font-semibold text-muted-900">Add Wine</h2>
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

              <!-- Form -->
              <form class="p-6 space-y-6" @submit.prevent="handleSubmit">
                <div v-if="error" class="p-3 text-sm text-red-700 bg-red-50 rounded-lg">
                  {{ error }}
                </div>

                <!-- Wine Information -->
                <div>
                  <h3 class="text-sm font-semibold text-muted-900 mb-3">Wine Information</h3>
                  <div class="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label class="label font-semibold">Producer <span class="text-red-500">*</span></label>
                      <input
                        v-model="form.producer"
                        type="text"
                        required
                        class="input focus:ring-primary"
                        placeholder="e.g., Chateau Margaux"
                      >
                    </div>

                    <div>
                      <label class="label font-semibold">Wine Name <span class="text-red-500">*</span></label>
                      <input
                        v-model="form.wineName"
                        type="text"
                        required
                        class="input focus:ring-primary"
                        placeholder="e.g., Grand Vin"
                      >
                    </div>

                    <div>
                      <label class="label font-semibold">Color <span class="text-red-500">*</span></label>
                      <select v-model="form.color" required class="input focus:ring-primary">
                        <option v-for="opt in colorOptions" :key="opt.value" :value="opt.value">
                          {{ opt.label }}
                        </option>
                      </select>
                    </div>

                    <div>
                      <label class="label font-semibold">Region</label>
                      <div v-if="showNewRegion" class="flex gap-2">
                        <input
                          v-model="newRegionName"
                          type="text"
                          class="input flex-1 focus:ring-primary"
                          placeholder="New region name"
                          @keydown.enter.prevent="createRegion"
                        >
                        <button
                          type="button"
                          class="px-2 text-green-600 hover:text-green-700 transition-transform hover:scale-105"
                          :disabled="isCreatingRegion"
                          @click="createRegion"
                        >
                          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          class="px-2 text-muted-400 hover:text-muted-600 transition-transform hover:scale-105"
                          @click="showNewRegion = false; newRegionName = ''"
                        >
                          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div v-else class="flex gap-2">
                        <select v-model="form.regionId" class="input flex-1 focus:ring-primary">
                          <option :value="undefined">-- Select region --</option>
                          <option v-for="r in regions" :key="r.id" :value="r.id">
                            {{ r.name }}
                          </option>
                        </select>
                        <button
                          type="button"
                          class="px-2 text-primary-600 hover:text-primary-700 transition-transform hover:scale-105"
                          title="Add new region"
                          @click="showNewRegion = true"
                        >
                          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label class="label font-semibold">Appellation</label>
                      <div v-if="showNewAppellation" class="flex gap-2">
                        <input
                          v-model="newAppellationName"
                          type="text"
                          class="input flex-1 focus:ring-primary"
                          placeholder="New appellation name"
                          @keydown.enter.prevent="createAppellation"
                        >
                        <button
                          type="button"
                          class="px-2 text-green-600 hover:text-green-700 transition-transform hover:scale-105"
                          :disabled="isCreatingAppellation"
                          @click="createAppellation"
                        >
                          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          class="px-2 text-muted-400 hover:text-muted-600 transition-transform hover:scale-105"
                          @click="showNewAppellation = false; newAppellationName = ''"
                        >
                          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div v-else class="flex gap-2">
                        <select v-model="form.appellationId" class="input flex-1 focus:ring-primary" :disabled="!form.regionId">
                          <option :value="undefined">-- Select appellation --</option>
                          <option v-for="a in appellations" :key="a.id" :value="a.id">
                            {{ a.name }}
                          </option>
                        </select>
                        <button
                          type="button"
                          class="px-2 text-primary-600 hover:text-primary-700 disabled:opacity-50 transition-transform hover:scale-105"
                          title="Add new appellation"
                          :disabled="!form.regionId"
                          @click="showNewAppellation = true"
                        >
                          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label class="label font-semibold">Grapes</label>
                      <GrapeMultiSelect
                        v-model="selectedGrapes"
                        :grapes="grapesList || []"
                      />
                    </div>
                  </div>
                </div>

                <!-- Inventory Information -->
                <div v-if="!wineOnly">
                  <h3 class="text-sm font-semibold text-muted-900 mb-3">Inventory</h3>
                  <div class="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label class="label font-semibold">Cellar <span class="text-red-500">*</span></label>
                      <select v-model="form.cellarId" required class="input focus:ring-primary">
                        <option v-for="c in cellars" :key="c.id" :value="c.id">
                          {{ c.name }}
                        </option>
                      </select>
                    </div>

                    <div>
                      <label class="label font-semibold">Vintage</label>
                      <input
                        v-model.number="form.vintage"
                        type="number"
                        min="1900"
                        max="2100"
                        class="input focus:ring-primary"
                        placeholder="NV"
                      >
                    </div>

                    <div>
                      <label class="label font-semibold">Format <span class="text-red-500">*</span></label>
                      <select v-model="form.formatId" required class="input focus:ring-primary">
                        <option v-for="f in formats" :key="f.id" :value="f.id">
                          {{ f.name }}
                        </option>
                      </select>
                    </div>

                    <div>
                      <label class="label font-semibold">Quantity <span class="text-red-500">*</span></label>
                      <input
                        v-model.number="form.quantity"
                        type="number"
                        min="1"
                        required
                        class="input focus:ring-primary"
                      >
                    </div>
                  </div>
                </div>

                <!-- Purchase Information -->
                <div v-if="!wineOnly">
                  <h3 class="text-sm font-semibold text-muted-900 mb-3">Purchase Information</h3>
                  <div class="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label class="label font-semibold">Purchase Date</label>
                      <input
                        v-model="form.purchaseDate"
                        type="date"
                        class="input focus:ring-primary"
                      >
                    </div>

                    <div>
                      <label class="label font-semibold">Price per Bottle</label>
                      <div class="flex gap-2">
                        <input
                          v-model="form.purchasePricePerBottle"
                          type="number"
                          step="0.01"
                          min="0"
                          class="input flex-1 focus:ring-primary"
                          placeholder="0.00"
                        >
                        <select v-model="form.purchaseCurrency" class="input w-20 focus:ring-primary">
                          <option v-for="opt in currencyOptions" :key="opt.value" :value="opt.value">
                            {{ opt.label }}
                          </option>
                        </select>
                      </div>
                    </div>

                    <div class="sm:col-span-2">
                      <label class="label font-semibold">Purchase Source</label>
                      <input
                        v-model="form.purchaseSource"
                        type="text"
                        class="input focus:ring-primary"
                        placeholder="e.g., Wine merchant"
                      >
                    </div>

                    <div class="sm:col-span-2">
                      <label class="label font-semibold">Notes</label>
                      <textarea
                        v-model="form.notes"
                        rows="2"
                        class="input focus:ring-primary"
                        placeholder="Any additional notes..."
                      />
                    </div>
                  </div>
                </div>

                <!-- Actions -->
                <div class="flex justify-end gap-3 pt-4 border-t border-muted-200">
                  <button
                    type="button"
                    class="btn-secondary transition-transform hover:scale-105"
                    @click="closeModal"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    :disabled="isSubmitting"
                    class="btn-primary transition-transform hover:scale-105"
                  >
                    {{ isSubmitting ? 'Adding...' : 'Add Wine' }}
                  </button>
                </div>
              </form>
            </div>
          </Transition>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
