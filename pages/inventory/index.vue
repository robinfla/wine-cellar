<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

const route = useRoute()
const router = useRouter()

// Filter state
const search = ref(route.query.search as string || '')
const cellarId = ref(route.query.cellar ? Number(route.query.cellar) : undefined)
const color = ref(route.query.color as string || '')
const inStock = ref(route.query.inStock !== 'false')

// Fetch cellars for filter
const { data: cellars } = await useFetch('/api/cellars')

// Fetch inventory
const { data: inventory, refresh, pending } = await useFetch('/api/inventory', {
  query: computed(() => ({
    search: search.value || undefined,
    cellarId: cellarId.value || undefined,
    color: color.value || undefined,
    inStock: inStock.value,
    limit: 50,
  })),
})

// Update URL when filters change
watch([search, cellarId, color, inStock], () => {
  router.replace({
    query: {
      ...(search.value && { search: search.value }),
      ...(cellarId.value && { cellar: cellarId.value }),
      ...(color.value && { color: color.value }),
      ...(inStock.value === false && { inStock: 'false' }),
    },
  })
})

const colorOptions = [
  { value: '', label: 'All colors' },
  { value: 'red', label: 'Red' },
  { value: 'white', label: 'White' },
  { value: 'rose', label: 'Rosé' },
  { value: 'sparkling', label: 'Sparkling' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'fortified', label: 'Fortified' },
]

const getColorClass = (c: string) => {
  const classes: Record<string, string> = {
    red: 'bg-red-100 text-red-800',
    white: 'bg-amber-50 text-amber-800',
    rose: 'bg-pink-100 text-pink-800',
    sparkling: 'bg-yellow-100 text-yellow-800',
    dessert: 'bg-orange-100 text-orange-800',
    fortified: 'bg-purple-100 text-purple-800',
  }
  return classes[c] || 'bg-gray-100 text-gray-800'
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Inventory</h1>
        <p class="mt-1 text-sm text-gray-600">
          {{ inventory?.totalBottles || 0 }} bottles across {{ inventory?.total || 0 }} lots
        </p>
      </div>
      <NuxtLink to="/inventory/add" class="btn-primary">
        Add Wine
      </NuxtLink>
    </div>

    <!-- Filters -->
    <div class="card mb-6">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label class="label">Search</label>
          <input
            v-model="search"
            type="text"
            class="input"
            placeholder="Wine name..."
          />
        </div>

        <div>
          <label class="label">Cellar</label>
          <select v-model="cellarId" class="input">
            <option :value="undefined">All cellars</option>
            <option v-for="c in cellars" :key="c.id" :value="c.id">
              {{ c.name }}
            </option>
          </select>
        </div>

        <div>
          <label class="label">Color</label>
          <select v-model="color" class="input">
            <option v-for="opt in colorOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>

        <div class="flex items-end">
          <label class="flex items-center">
            <input
              v-model="inStock"
              type="checkbox"
              class="w-4 h-4 text-wine-600 border-gray-300 rounded focus:ring-wine-500"
            />
            <span class="ml-2 text-sm text-gray-700">In stock only</span>
          </label>
        </div>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="pending" class="text-center py-12">
      <p class="text-gray-500">Loading inventory...</p>
    </div>

    <!-- Empty state -->
    <div v-else-if="!inventory?.lots?.length" class="card text-center py-12">
      <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
      <h3 class="mt-4 text-lg font-medium text-gray-900">No wines found</h3>
      <p class="mt-2 text-sm text-gray-500">
        {{ search || cellarId || color ? 'Try adjusting your filters.' : 'Get started by adding wines to your cellar.' }}
      </p>
      <div v-if="!search && !cellarId && !color" class="mt-6">
        <NuxtLink to="/inventory/add" class="btn-primary">
          Add Wine
        </NuxtLink>
      </div>
    </div>

    <!-- Inventory list -->
    <div v-else class="space-y-4">
      <NuxtLink
        v-for="lot in inventory.lots"
        :key="lot.id"
        :to="`/inventory/${lot.id}`"
        class="card block hover:border-wine-300 transition-colors"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                :class="getColorClass(lot.wineColor)"
              >
                {{ lot.wineColor }}
              </span>
              <span v-if="lot.vintage" class="text-sm text-gray-500">
                {{ lot.vintage }}
              </span>
            </div>
            <h3 class="mt-1 text-base font-medium text-gray-900 truncate">
              {{ lot.wineName }}
            </h3>
            <p class="mt-0.5 text-sm text-gray-600 truncate">
              {{ lot.producerName }}
              <span v-if="lot.appellationName"> &middot; {{ lot.appellationName }}</span>
            </p>
            <p class="mt-1 text-xs text-gray-500">
              {{ lot.cellarName }} &middot; {{ lot.formatName }}
            </p>
          </div>
          <div class="text-right ml-4">
            <p class="text-2xl font-semibold text-gray-900">{{ lot.quantity }}</p>
            <p class="text-xs text-gray-500">bottles</p>
          </div>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
