<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

const { user } = useAuth()

const { data: statsData, pending, refresh: refreshStats } = await useFetch('/api/reports/stats')

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-EU', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const hasWines = computed(() => (statsData.value?.totals?.bottles || 0) > 0)

const showAllRegions = ref(false)
const showAllVintages = ref(false)
const showAllGrapes = ref(false)

// Consume Wine CTA state
interface InventoryLot {
  id: number
  wineId: number
  wineName: string
  producerName: string
  vintage: number | null
  quantity: number
  cellarName: string
}

const consumeSearchQuery = ref('')
const consumeSearchResults = ref<InventoryLot[]>([])
const isSearching = ref(false)
const searchDebounce = ref<ReturnType<typeof setTimeout> | null>(null)
const showConsumeDropdown = ref(false)

const selectedLotToConsume = ref<InventoryLot | null>(null)
const showConsumeModal = ref(false)
const consumeQuantity = ref(1)
const consumeTastingNote = ref({
  score: '' as string | number,
  comment: '',
  pairing: '',
})
const isConsuming = ref(false)
const consumeError = ref('')
const consumeSuccess = ref(false)

const handleConsumeSearchInput = (value: string) => {
  consumeSearchQuery.value = value
  if (searchDebounce.value) clearTimeout(searchDebounce.value)

  if (!value.trim()) {
    consumeSearchResults.value = []
    showConsumeDropdown.value = false
    return
  }

  searchDebounce.value = setTimeout(async () => {
    isSearching.value = true
    try {
      const response = await $fetch<{ lots: InventoryLot[] }>('/api/inventory', {
        query: {
          search: value,
          inStock: 'true',
          limit: 10,
        },
      })
      consumeSearchResults.value = response.lots || []
      showConsumeDropdown.value = true
    } catch (e) {
      console.error('Search failed', e)
      consumeSearchResults.value = []
    } finally {
      isSearching.value = false
    }
  }, 300)
}

const selectWineToConsume = (lot: InventoryLot) => {
  selectedLotToConsume.value = lot
  consumeQuantity.value = 1
  consumeTastingNote.value = { score: '', comment: '', pairing: '' }
  consumeError.value = ''
  consumeSuccess.value = false
  showConsumeDropdown.value = false
  consumeSearchQuery.value = ''
  consumeSearchResults.value = []
  showConsumeModal.value = true
}

const closeConsumeModal = () => {
  showConsumeModal.value = false
  selectedLotToConsume.value = null
}

const handleConsume = async () => {
  if (!selectedLotToConsume.value) return

  consumeError.value = ''
  isConsuming.value = true

  try {
    const payload: {
      quantity: number
      tastingNote?: { score: number; comment: string; pairing: string }
    } = {
      quantity: consumeQuantity.value,
    }

    const hasNotes = consumeTastingNote.value.score !== '' ||
      consumeTastingNote.value.comment.trim() !== '' ||
      consumeTastingNote.value.pairing.trim() !== ''

    if (hasNotes) {
      payload.tastingNote = {
        score: Number(consumeTastingNote.value.score) || 0,
        comment: consumeTastingNote.value.comment,
        pairing: consumeTastingNote.value.pairing,
      }
    }

    await $fetch(`/api/inventory/${selectedLotToConsume.value.id}/consume`, {
      method: 'POST',
      body: payload,
    })

    consumeSuccess.value = true
    await refreshStats()

    setTimeout(() => {
      closeConsumeModal()
    }, 1500)
  } catch (e: any) {
    consumeError.value = e.data?.message || 'Failed to consume wine. Please try again.'
  } finally {
    isConsuming.value = false
  }
}

const maxConsumeQuantity = computed(() => selectedLotToConsume.value?.quantity || 1)

const handleConsumeKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && showConsumeModal.value) {
    closeConsumeModal()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleConsumeKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleConsumeKeydown)
})

const getColorLabel = (color: string) => {
  const labels: Record<string, string> = {
    red: 'Red',
    white: 'White',
    rose: 'Rosé',
    sparkling: 'Sparkling',
    dessert: 'Dessert',
    fortified: 'Fortified',
  }
  return labels[color] || color
}

const getColorHex = (color: string) => {
  const colors: Record<string, string> = {
    red: '#ef4444',
    white: '#fcd34d',
    rose: '#f472b6',
    sparkling: '#facc15',
    dessert: '#fb923c',
    fortified: '#a855f7',
  }
  return colors[color] || '#9ca3af'
}

const cellarColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']
const regionColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']
const vintageColors = ['#8B5CF6', '#A855F7', '#C084FC', '#D8B4FE', '#E9D5FF']
const grapeColors = ['#10B981', '#34D399', '#6EE7B7', '#A7F3D0', '#D1FAE5']

const colorChartData = computed(() => {
  if (!statsData.value?.byColor) return []
  const total = statsData.value.totals.bottles
  const max = Math.max(...statsData.value.byColor.map(item => Number(item.bottles)))
  return statsData.value.byColor.map((item) => ({
    label: getColorLabel(item.color),
    color: getColorHex(item.color),
    bottles: Number(item.bottles),
    percent: Math.round((Number(item.bottles) / total) * 100),
    width: (Number(item.bottles) / max) * 100,
  }))
})

const cellarChartData = computed(() => {
  if (!statsData.value?.byCellar) return []
  const total = statsData.value.totals.bottles
  const max = Math.max(...statsData.value.byCellar.map(item => Number(item.bottles)))
  return statsData.value.byCellar.map((item, i) => ({
    label: item.cellarName,
    color: cellarColors[i % cellarColors.length],
    bottles: Number(item.bottles),
    percent: Math.round((Number(item.bottles) / total) * 100),
    width: (Number(item.bottles) / max) * 100,
  }))
})

const regionChartData = computed(() => {
  if (!statsData.value?.byRegion) return []
  const data = showAllRegions.value ? statsData.value.byRegion : statsData.value.byRegion.slice(0, 5)
  const allData = statsData.value.byRegion
  const total = allData.reduce((sum, r) => sum + Number(r.bottles), 0)
  const max = Math.max(...allData.map(item => Number(item.bottles)))
  return data.map((item, i) => ({
    label: item.regionName,
    color: regionColors[i % regionColors.length],
    bottles: Number(item.bottles),
    percent: Math.round((Number(item.bottles) / total) * 100),
    width: (Number(item.bottles) / max) * 100,
  }))
})

const hasMoreRegions = computed(() => (statsData.value?.byRegion?.length || 0) > 5)

const vintageChartData = computed(() => {
  if (!statsData.value?.byVintage) return []
  const data = showAllVintages.value ? statsData.value.byVintage : statsData.value.byVintage.slice(0, 5)
  const allData = statsData.value.byVintage
  const total = allData.reduce((sum, v) => sum + Number(v.bottles), 0)
  const max = Math.max(...allData.map(item => Number(item.bottles)))
  return data.map((item, i) => ({
    label: String(item.vintage),
    color: vintageColors[i % vintageColors.length],
    bottles: Number(item.bottles),
    percent: Math.round((Number(item.bottles) / total) * 100),
    width: (Number(item.bottles) / max) * 100,
  }))
})

const hasMoreVintages = computed(() => (statsData.value?.byVintage?.length || 0) > 5)

const grapeChartData = computed(() => {
  if (!statsData.value?.byGrape) return []
  const data = showAllGrapes.value ? statsData.value.byGrape : statsData.value.byGrape.slice(0, 5)
  const allData = statsData.value.byGrape
  const total = allData.reduce((sum, g) => sum + Number(g.bottles), 0)
  const max = Math.max(...allData.map(item => Number(item.bottles)))
  return data.map((item, i) => ({
    label: item.grapeName,
    color: grapeColors[i % grapeColors.length],
    bottles: Number(item.bottles),
    percent: Math.round((Number(item.bottles) / total) * 100),
    width: (Number(item.bottles) / max) * 100,
  }))
})

const hasMoreGrapes = computed(() => (statsData.value?.byGrape?.length || 0) > 5)
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-muted-900">
        Welcome back{{ user?.name ? `, ${user.name}` : '' }}
      </h1>
      <p class="mt-1 text-muted-600">
        Here's an overview of your wine cellar
      </p>
    </div>

    <!-- Loading state -->
    <div v-if="pending" class="text-center py-12">
      <p class="text-muted-500 font-medium">Loading stats...</p>
    </div>

    <!-- Empty state -->
    <div v-else-if="!hasWines" class="card text-center py-12">
      <svg class="mx-auto h-12 w-12 text-muted-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
      <h3 class="mt-4 text-lg font-semibold text-muted-900">No wines yet</h3>
      <p class="mt-2 text-sm text-muted-500">
        Get started by adding wines to your cellar or importing from a CSV file.
      </p>
      <div class="mt-6 flex justify-center gap-4">
        <NuxtLink to="/inventory/add" class="btn-primary">
          Add Wine
        </NuxtLink>
        <NuxtLink to="/inventory/import" class="btn-secondary">
          Import CSV
        </NuxtLink>
      </div>
    </div>

    <!-- Dashboard content -->
    <template v-else>
      <!-- Consume Wine CTA -->
      <div class="card mb-8 p-6 bg-gradient-to-r from-primary-50 to-secondary-50 border-primary-200">
        <div class="flex flex-col sm:flex-row sm:items-center gap-4">
          <div class="flex-1">
            <h2 class="text-lg font-bold text-muted-900">Open a bottle tonight?</h2>
            <p class="mt-1 text-sm text-muted-600">Search your cellar and record your tasting experience</p>
          </div>
          <div class="relative w-full sm:w-80">
            <div class="relative">
              <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                :value="consumeSearchQuery"
                placeholder="Search wine, producer, vintage..."
                class="input pl-10 pr-4"
                @input="handleConsumeSearchInput(($event.target as HTMLInputElement).value)"
                @focus="consumeSearchResults.length > 0 && (showConsumeDropdown = true)"
                @blur="setTimeout(() => showConsumeDropdown = false, 200)"
              >
              <div v-if="isSearching" class="absolute right-3 top-1/2 -translate-y-1/2">
                <svg class="animate-spin h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            </div>

            <!-- Search Results Dropdown -->
            <Transition
              enter-active-class="transition ease-out duration-100"
              enter-from-class="opacity-0 scale-95"
              enter-to-class="opacity-100 scale-100"
              leave-active-class="transition ease-in duration-75"
              leave-from-class="opacity-100 scale-100"
              leave-to-class="opacity-0 scale-95"
            >
              <div
                v-if="showConsumeDropdown && consumeSearchQuery.trim()"
                class="absolute z-20 mt-1 w-full bg-white rounded-xl border-2 border-muted-200 max-h-64 overflow-y-auto"
              >
                <div v-if="consumeSearchResults.length === 0 && !isSearching" class="p-4 text-center text-sm text-muted-500">
                  No wines found
                </div>
                <button
                  v-for="lot in consumeSearchResults"
                  :key="lot.id"
                  type="button"
                  class="w-full text-left px-4 py-3 hover:bg-muted-50 border-b border-muted-100 last:border-b-0 transition-colors"
                  @mousedown.prevent="selectWineToConsume(lot)"
                >
                  <div class="font-medium text-muted-900">{{ lot.wineName }}</div>
                  <div class="text-sm text-muted-500 mt-0.5">
                    {{ lot.producerName }}
                    <span v-if="lot.vintage" class="mx-1">-</span>
                    <span v-if="lot.vintage">{{ lot.vintage }}</span>
                    <span class="mx-1">-</span>
                    <span class="text-muted-400">{{ lot.quantity }} bottle{{ lot.quantity > 1 ? 's' : '' }} in {{ lot.cellarName }}</span>
                  </div>
                </button>
              </div>
            </Transition>
          </div>
        </div>
      </div>

      <!-- Stats grid -->
      <div class="grid gap-4 mb-8 sm:grid-cols-2 lg:grid-cols-4">
        <div class="card">
          <p class="text-sm font-semibold text-muted-500">Total Bottles</p>
          <p class="mt-1 text-3xl font-bold text-muted-900">{{ statsData?.totals?.bottles || 0 }}</p>
        </div>
        <div class="card">
          <p class="text-sm font-semibold text-muted-500">Total Lots</p>
          <p class="mt-1 text-3xl font-bold text-muted-900">{{ statsData?.totals?.lots || 0 }}</p>
        </div>
        <div class="card">
          <p class="text-sm font-semibold text-muted-500">Ready to Drink</p>
          <p class="mt-1 text-3xl font-bold text-secondary">{{ statsData?.readyToDrink || 0 }}</p>
        </div>
        <div class="card">
          <p class="text-sm font-semibold text-muted-500">Purchase Value</p>
          <p class="mt-1 text-3xl font-bold text-primary">{{ formatCurrency(statsData?.totals?.estimatedValue || 0) }}</p>
        </div>
      </div>

      <!-- Charts grid - compact 2x2 layout -->
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <!-- By Cellar -->
        <div class="card p-4">
          <h3 class="text-sm font-semibold text-muted-500 mb-3">By Cellar</h3>
          <div class="space-y-2">
            <div v-for="item in cellarChartData" :key="item.label" class="group">
              <div class="flex justify-between text-xs mb-1">
                <span class="text-muted-700 font-medium truncate">{{ item.label }}</span>
                <span class="text-muted-500 ml-2">{{ item.bottles }}</span>
              </div>
              <div class="h-2 bg-muted-100 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all" :style="{ width: `${item.width}%`, backgroundColor: item.color }" />
              </div>
            </div>
          </div>
        </div>

        <!-- By Color -->
        <div class="card p-4">
          <h3 class="text-sm font-semibold text-muted-500 mb-3">By Color</h3>
          <div class="space-y-2">
            <div v-for="item in colorChartData" :key="item.label" class="group">
              <div class="flex justify-between text-xs mb-1">
                <span class="text-muted-700 font-medium">{{ item.label }}</span>
                <span class="text-muted-500">{{ item.bottles }}</span>
              </div>
              <div class="h-2 bg-muted-100 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all" :style="{ width: `${item.width}%`, backgroundColor: item.color }" />
              </div>
            </div>
          </div>
        </div>

        <!-- By Region -->
        <div class="card p-4">
          <h3 class="text-sm font-semibold text-muted-500 mb-3">Top Regions</h3>
          <div class="space-y-2">
            <div v-for="item in regionChartData" :key="item.label" class="group">
              <div class="flex justify-between text-xs mb-1">
                <span class="text-muted-700 font-medium truncate">{{ item.label }}</span>
                <span class="text-muted-500 ml-2">{{ item.bottles }}</span>
              </div>
              <div class="h-2 bg-muted-100 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all" :style="{ width: `${item.width}%`, backgroundColor: item.color }" />
              </div>
            </div>
          </div>
          <button
            v-if="hasMoreRegions"
            class="mt-3 text-xs text-primary-600 hover:text-primary-700 font-medium"
            @click="showAllRegions = !showAllRegions"
          >
            {{ showAllRegions ? 'Show less' : 'See all regions' }}
          </button>
        </div>

        <!-- By Vintage -->
        <div v-if="vintageChartData.length > 0" class="card p-4">
          <h3 class="text-sm font-semibold text-muted-500 mb-3">Top Vintages</h3>
          <div class="space-y-2">
            <div v-for="item in vintageChartData" :key="item.label" class="group">
              <div class="flex justify-between text-xs mb-1">
                <span class="text-muted-700 font-medium">{{ item.label }}</span>
                <span class="text-muted-500">{{ item.bottles }}</span>
              </div>
              <div class="h-2 bg-muted-100 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all" :style="{ width: `${item.width}%`, backgroundColor: item.color }" />
              </div>
            </div>
          </div>
          <button
            v-if="hasMoreVintages"
            class="mt-3 text-xs text-primary-600 hover:text-primary-700 font-medium"
            @click="showAllVintages = !showAllVintages"
          >
            {{ showAllVintages ? 'Show less' : 'See all vintages' }}
          </button>
        </div>
      </div>

      <!-- By Grape (separate row if exists) -->
      <div v-if="grapeChartData.length > 0" class="card p-4 mt-4">
        <h3 class="text-sm font-semibold text-muted-500 mb-3">Top Grape Varieties</h3>
        <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <div v-for="item in grapeChartData" :key="item.label" class="group">
            <div class="flex justify-between text-xs mb-1">
              <span class="text-muted-700 font-medium truncate">{{ item.label }}</span>
              <span class="text-muted-500 ml-2">{{ item.bottles }}</span>
            </div>
            <div class="h-2 bg-muted-100 rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all" :style="{ width: `${item.width}%`, backgroundColor: item.color }" />
            </div>
          </div>
        </div>
        <button
          v-if="hasMoreGrapes"
          class="mt-3 text-xs text-primary-600 hover:text-primary-700 font-medium"
          @click="showAllGrapes = !showAllGrapes"
        >
          {{ showAllGrapes ? 'Show less' : 'See all varieties' }}
        </button>
      </div>
    </template>

    <!-- Consume Wine Modal -->
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
          v-if="showConsumeModal"
          class="fixed inset-0 z-50 overflow-y-auto"
        >
          <!-- Backdrop -->
          <div
            class="fixed inset-0 bg-muted-900/50"
            @click="closeConsumeModal"
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
                v-if="showConsumeModal && selectedLotToConsume"
                class="relative bg-white rounded-xl border-2 border-muted-200 w-full max-w-md"
                @click.stop
              >
                <!-- Header -->
                <div class="bg-white border-b border-muted-200 px-6 py-4 flex items-center justify-between">
                  <h2 class="text-xl font-semibold text-muted-900">Consume Wine</h2>
                  <button
                    type="button"
                    class="text-muted-400 hover:text-muted-600 transition-transform hover:scale-105"
                    @click="closeConsumeModal"
                  >
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <!-- Content -->
                <div class="p-6 space-y-6">
                  <!-- Success Message -->
                  <div v-if="consumeSuccess" class="p-4 bg-secondary-50 border-2 border-secondary-200 rounded-lg text-center">
                    <svg class="mx-auto h-10 w-10 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <p class="mt-2 font-semibold text-secondary-700">Wine consumed successfully!</p>
                  </div>

                  <template v-else>
                    <!-- Error Message -->
                    <div v-if="consumeError" class="p-3 text-sm text-red-700 bg-red-50 rounded-lg">
                      {{ consumeError }}
                    </div>

                    <!-- Wine Details -->
                    <div class="bg-muted-50 rounded-lg p-4 border border-muted-200">
                      <h3 class="font-semibold text-muted-900">{{ selectedLotToConsume.wineName }}</h3>
                      <p class="text-sm text-muted-600 mt-1">{{ selectedLotToConsume.producerName }}</p>
                      <div class="flex gap-4 mt-2 text-sm text-muted-500">
                        <span v-if="selectedLotToConsume.vintage">{{ selectedLotToConsume.vintage }}</span>
                        <span>{{ selectedLotToConsume.cellarName }}</span>
                        <span>{{ selectedLotToConsume.quantity }} bottle{{ selectedLotToConsume.quantity > 1 ? 's' : '' }} available</span>
                      </div>
                    </div>

                    <!-- Quantity -->
                    <div>
                      <label class="label font-semibold">Bottles to consume</label>
                      <div class="flex items-center gap-3">
                        <button
                          type="button"
                          class="w-10 h-10 rounded-lg border-2 border-muted-300 bg-white text-muted-700 hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                          :disabled="consumeQuantity <= 1"
                          @click="consumeQuantity = Math.max(1, consumeQuantity - 1)"
                        >
                          <svg class="w-5 h-5 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
                          </svg>
                        </button>
                        <input
                          v-model.number="consumeQuantity"
                          type="number"
                          min="1"
                          :max="maxConsumeQuantity"
                          class="input w-20 text-center"
                        >
                        <button
                          type="button"
                          class="w-10 h-10 rounded-lg border-2 border-muted-300 bg-white text-muted-700 hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                          :disabled="consumeQuantity >= maxConsumeQuantity"
                          @click="consumeQuantity = Math.min(maxConsumeQuantity, consumeQuantity + 1)"
                        >
                          <svg class="w-5 h-5 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <!-- Tasting Notes -->
                    <div class="space-y-4">
                      <h3 class="text-sm font-semibold text-muted-900">Tasting Notes (optional)</h3>

                      <div>
                        <label class="label font-semibold">Score (0-100)</label>
                        <input
                          v-model.number="consumeTastingNote.score"
                          type="number"
                          min="0"
                          max="100"
                          class="input w-24"
                          placeholder="85"
                        >
                      </div>

                      <div>
                        <label class="label font-semibold">Comment</label>
                        <textarea
                          v-model="consumeTastingNote.comment"
                          rows="3"
                          class="input"
                          placeholder="Describe your tasting experience..."
                        />
                      </div>

                      <div>
                        <label class="label font-semibold">Pairing</label>
                        <input
                          v-model="consumeTastingNote.pairing"
                          type="text"
                          class="input"
                          placeholder="e.g., Grilled steak, aged cheese..."
                        >
                      </div>
                    </div>

                    <!-- Actions -->
                    <div class="flex justify-end gap-3 pt-4 border-t border-muted-200">
                      <button
                        type="button"
                        class="btn-secondary transition-transform hover:scale-105"
                        @click="closeConsumeModal"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        :disabled="isConsuming || consumeQuantity < 1 || consumeQuantity > maxConsumeQuantity"
                        class="btn-primary transition-transform hover:scale-105"
                        @click="handleConsume"
                      >
                        {{ isConsuming ? 'Consuming...' : 'Consume' }}
                      </button>
                    </div>
                  </template>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
