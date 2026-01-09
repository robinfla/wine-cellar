<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

const router = useRouter()

// Fetch reference data
const { data: cellars } = await useFetch('/api/cellars')
const { data: regions } = await useFetch('/api/regions')
const { data: formats } = await useFetch('/api/formats')
const { data: grapesList } = await useFetch('/api/grapes')

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

// Reset appellation when region changes
watch(() => form.value.regionId, () => {
  form.value.appellationId = undefined
})

const isSubmitting = ref(false)
const error = ref('')

const colorOptions = [
  { value: 'red', label: 'Red' },
  { value: 'white', label: 'White' },
  { value: 'rose', label: 'Rosé' },
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

    // Create inventory lot
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

    router.push('/inventory')
  } catch (e: any) {
    error.value = e.data?.message || 'Failed to add wine. Please try again.'
  } finally {
    isSubmitting.value = false
  }
}

// Set defaults
onMounted(() => {
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
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Add Wine</h1>
      <p class="mt-1 text-sm text-gray-600">
        Add a new wine to your inventory
      </p>
    </div>

    <form @submit.prevent="handleSubmit" class="space-y-6">
      <div v-if="error" class="p-3 text-sm text-red-700 bg-red-50 rounded-lg">
        {{ error }}
      </div>

      <!-- Wine Information -->
      <div class="card">
        <h2 class="text-lg font-medium text-gray-900 mb-4">Wine Information</h2>

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="sm:col-span-2">
            <label class="label">Producer <span class="text-red-500">*</span></label>
            <input
              v-model="form.producer"
              type="text"
              required
              class="input"
              placeholder="e.g., Château Margaux"
            />
          </div>

          <div class="sm:col-span-2">
            <label class="label">Wine Name <span class="text-red-500">*</span></label>
            <input
              v-model="form.wineName"
              type="text"
              required
              class="input"
              placeholder="e.g., Grand Vin"
            />
          </div>

          <div>
            <label class="label">Color <span class="text-red-500">*</span></label>
            <select v-model="form.color" required class="input">
              <option v-for="opt in colorOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>

          <div>
            <label class="label">Vintage</label>
            <input
              v-model.number="form.vintage"
              type="number"
              min="1900"
              max="2100"
              class="input"
              placeholder="e.g., 2019 (leave empty for NV)"
            />
          </div>

          <div>
            <label class="label">Region</label>
            <select v-model="form.regionId" class="input">
              <option :value="undefined">-- Select region --</option>
              <option v-for="r in regions" :key="r.id" :value="r.id">
                {{ r.name }} ({{ r.countryCode }})
              </option>
            </select>
          </div>

          <div>
            <label class="label">Appellation</label>
            <select v-model="form.appellationId" class="input" :disabled="!form.regionId">
              <option :value="undefined">-- Select appellation --</option>
              <option v-for="a in appellations" :key="a.id" :value="a.id">
                {{ a.name }}
              </option>
            </select>
          </div>

          <div class="sm:col-span-2">
            <label class="label">Grapes</label>
            <div class="flex flex-wrap gap-2 p-3 border border-gray-300 rounded-lg max-h-32 overflow-y-auto">
              <label
                v-for="grape in grapesList"
                :key="grape.id"
                class="inline-flex items-center"
              >
                <input
                  v-model="selectedGrapes"
                  type="checkbox"
                  :value="grape.id"
                  class="w-4 h-4 text-wine-600 border-gray-300 rounded focus:ring-wine-500"
                />
                <span class="ml-1.5 text-sm text-gray-700">{{ grape.name }}</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Inventory Information -->
      <div class="card">
        <h2 class="text-lg font-medium text-gray-900 mb-4">Inventory</h2>

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="label">Cellar <span class="text-red-500">*</span></label>
            <select v-model="form.cellarId" required class="input">
              <option v-for="c in cellars" :key="c.id" :value="c.id">
                {{ c.name }}
              </option>
            </select>
          </div>

          <div>
            <label class="label">Format <span class="text-red-500">*</span></label>
            <select v-model="form.formatId" required class="input">
              <option v-for="f in formats" :key="f.id" :value="f.id">
                {{ f.name }} ({{ f.volumeMl }}ml)
              </option>
            </select>
          </div>

          <div>
            <label class="label">Quantity <span class="text-red-500">*</span></label>
            <input
              v-model.number="form.quantity"
              type="number"
              min="1"
              required
              class="input"
            />
          </div>
        </div>
      </div>

      <!-- Purchase Information -->
      <div class="card">
        <h2 class="text-lg font-medium text-gray-900 mb-4">Purchase Information</h2>

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="label">Purchase Date</label>
            <input
              v-model="form.purchaseDate"
              type="date"
              class="input"
            />
          </div>

          <div>
            <label class="label">Price per Bottle</label>
            <div class="flex gap-2">
              <input
                v-model="form.purchasePricePerBottle"
                type="number"
                step="0.01"
                min="0"
                class="input flex-1"
                placeholder="0.00"
              />
              <select v-model="form.purchaseCurrency" class="input w-24">
                <option v-for="opt in currencyOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>
          </div>

          <div class="sm:col-span-2">
            <label class="label">Purchase Source</label>
            <input
              v-model="form.purchaseSource"
              type="text"
              class="input"
              placeholder="e.g., Wine merchant, Direct from producer"
            />
          </div>

          <div class="sm:col-span-2">
            <label class="label">Notes</label>
            <textarea
              v-model="form.notes"
              rows="3"
              class="input"
              placeholder="Any additional notes..."
            />
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex justify-end gap-4">
        <NuxtLink to="/inventory" class="btn-secondary">
          Cancel
        </NuxtLink>
        <button
          type="submit"
          :disabled="isSubmitting"
          class="btn-primary"
        >
          {{ isSubmitting ? 'Adding...' : 'Add Wine' }}
        </button>
      </div>
    </form>
  </div>
</template>
