<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

const { user } = useAuth()
const { t } = useI18n({ useScope: 'global' })

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

const aiInput = ref('')
const showAiSearchModal = ref(false)
const showAddWineModal = ref(false)
const showPairingModal = ref(false)
const showConsumeSearch = ref(false)
const showAddSearch = ref(false)

const handleAiAdd = () => {
  if (!aiInput.value.trim()) return
  showAiSearchModal.value = true
}

const addWinePrefill = ref<any>(null)

const handleAiAddNew = (parsed: any) => {
  addWinePrefill.value = {
    wineName: parsed.wineName || '',
    producer: parsed.producer || '',
    vintage: parsed.vintage || null,
    color: parsed.color || '',
    region: parsed.region || '',
    appellation: parsed.appellation || '',
  }
  showAddWineModal.value = true
  aiInput.value = ''
}

const handleAiAddExisting = (_wineId: number) => {
  refreshStats()
  aiInput.value = ''
}

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
    filterQuery: { color: item.color },
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
    filterQuery: { cellar: item.cellarId },
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
    filterQuery: { region: item.regionId },
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
    filterQuery: { vintage: item.vintage },
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
    filterQuery: { grape: item.grapeId },
  }))
})

const hasMoreGrapes = computed(() => (statsData.value?.byGrape?.length || 0) > 5)
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-muted-900">
        {{ $t('home.welcome') }}{{ user?.name ? `, ${user.name}` : '' }}
      </h1>
      <p class="mt-1 text-muted-600">
        {{ $t('home.overview') }}
      </p>
    </div>

    <!-- Loading state -->
    <div v-if="pending" class="text-center py-12">
      <p class="text-muted-500 font-medium">{{ $t('home.loadingStats') }}</p>
    </div>

    <!-- Empty state -->
    <div v-else-if="!hasWines" class="card text-center py-12">
      <svg class="mx-auto h-12 w-12 text-muted-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
      <h3 class="mt-4 text-lg font-semibold text-muted-900">{{ $t('home.noWinesYet') }}</h3>
      <p class="mt-2 text-sm text-muted-500">
        {{ $t('home.noWinesDesc') }}
      </p>
      <div class="mt-6 flex justify-center gap-4">
        <NuxtLink to="/inventory/add" class="btn-primary">
          {{ $t('home.addWine') }}
        </NuxtLink>
        <NuxtLink to="/inventory/import" class="btn-secondary">
          {{ $t('home.importCsv') }}
        </NuxtLink>
      </div>
    </div>

    <!-- Dashboard content -->
    <template v-else>
      <!-- Hero greeting -->
      <div class="-mx-4 -mt-6 lg:-mx-8 px-4 lg:px-8 pt-8 pb-6 mb-6 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 text-white">
        <h1 class="text-2xl font-bold">
          {{ $t('home.hello', { name: user?.name || user?.email?.split('@')[0] || '' }) }} 👋
        </h1>
        <p class="mt-1 text-primary-200 text-sm">{{ $t('home.welcomeBack') }}</p>

        <!-- Bottle count -->
        <div class="mt-5 bg-white/15 backdrop-blur-sm rounded-xl p-4 inline-block">
          <p class="text-primary-200 text-xs font-medium">{{ $t('home.totalBottles') }}</p>
          <p class="text-3xl font-bold mt-1">{{ statsData?.totals?.bottles || 0 }}</p>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="mb-8">
        <h2 class="text-lg font-bold text-muted-900 mb-4">{{ $t('home.quickActions') }}</h2>
        <div class="grid grid-cols-3 gap-3">
          <!-- Open a Bottle -->
          <button
            type="button"
            class="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border-2 border-muted-200 hover:border-primary-300 hover:bg-primary-50/30 transition-all"
            @click="showConsumeSearch = true"
          >
            <div class="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
              <svg class="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span class="text-xs font-semibold text-muted-700 text-center">{{ $t('home.openBottle') }}</span>
          </button>

          <!-- Add a Wine -->
          <button
            type="button"
            class="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border-2 border-muted-200 hover:border-secondary-300 hover:bg-secondary-50/30 transition-all"
            @click="showAddSearch = true"
          >
            <div class="w-12 h-12 rounded-full bg-secondary-100 flex items-center justify-center">
              <svg class="w-6 h-6 text-secondary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <span class="text-xs font-semibold text-muted-700 text-center">{{ $t('home.addAWine') }}</span>
          </button>

          <!-- Get Inspiration -->
          <button
            type="button"
            class="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border-2 border-muted-200 hover:border-accent-300 hover:bg-accent-50/30 transition-all"
            @click="showPairingModal = true"
          >
            <div class="w-12 h-12 rounded-full bg-accent-100 flex items-center justify-center">
              <svg class="w-6 h-6 text-accent-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <span class="text-xs font-semibold text-muted-700 text-center">{{ $t('home.getInspiration') }}</span>
          </button>
        </div>
      </div>

      <!-- Consume Search Modal -->
      <Teleport to="body">
        <Transition
          enter-active-class="transition ease-out duration-200"
          enter-from-class="opacity-0"
          enter-to-class="opacity-100"
          leave-active-class="transition ease-in duration-150"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <div v-if="showConsumeSearch" class="fixed inset-0 z-50 overflow-y-auto">
            <div class="fixed inset-0 bg-muted-900/50" @click="showConsumeSearch = false" />
            <div class="relative min-h-screen flex items-start justify-center p-4 pt-20">
              <div class="relative bg-white rounded-xl border-2 border-muted-200 w-full max-w-md" @click.stop>
                <div class="p-4">
                  <div class="flex items-center justify-between mb-4">
                    <h2 class="text-lg font-bold text-muted-900">{{ $t('home.openBottle') }}</h2>
                    <button type="button" class="text-muted-400 hover:text-muted-600" @click="showConsumeSearch = false">
                      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <div class="relative">
                    <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      :value="consumeSearchQuery"
                      :placeholder="$t('home.searchPlaceholder')"
                      class="input pl-10 pr-4 w-full"
                      autofocus
                      @input="handleConsumeSearchInput(($event.target as HTMLInputElement).value)"
                    >
                  </div>
                  <!-- Results -->
                  <div v-if="consumeSearchQuery.trim()" class="mt-3 max-h-64 overflow-y-auto">
                    <div v-if="isSearching" class="text-center py-4">
                      <svg class="animate-spin h-5 w-5 text-primary mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    </div>
                    <div v-else-if="consumeSearchResults.length === 0" class="text-center py-4 text-sm text-muted-500">
                      {{ $t('home.noWinesFound') }}
                    </div>
                    <button
                      v-for="lot in consumeSearchResults"
                      :key="lot.id"
                      type="button"
                      class="w-full text-left px-3 py-3 hover:bg-muted-50 rounded-lg transition-colors"
                      @click="selectWineToConsume(lot); showConsumeSearch = false"
                    >
                      <div class="font-medium text-muted-900">{{ lot.wineName }}</div>
                      <div class="text-sm text-muted-500 mt-0.5">
                        {{ lot.producerName }}
                        <span v-if="lot.vintage" class="mx-1">·</span>
                        <span v-if="lot.vintage">{{ lot.vintage }}</span>
                        <span class="mx-1">·</span>
                        <span class="text-muted-400">{{ lot.quantity }} btl</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>

      <!-- Add Wine Search Modal -->
      <Teleport to="body">
        <Transition
          enter-active-class="transition ease-out duration-200"
          enter-from-class="opacity-0"
          enter-to-class="opacity-100"
          leave-active-class="transition ease-in duration-150"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <div v-if="showAddSearch" class="fixed inset-0 z-50 overflow-y-auto">
            <div class="fixed inset-0 bg-muted-900/50" @click="showAddSearch = false" />
            <div class="relative min-h-screen flex items-start justify-center p-4 pt-20">
              <div class="relative bg-white rounded-xl border-2 border-muted-200 w-full max-w-md" @click.stop>
                <div class="p-4">
                  <div class="flex items-center justify-between mb-4">
                    <h2 class="text-lg font-bold text-muted-900">{{ $t('home.addAWine') }}</h2>
                    <button type="button" class="text-muted-400 hover:text-muted-600" @click="showAddSearch = false">
                      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <div class="relative">
                    <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      v-model="aiInput"
                      type="text"
                      :placeholder="$t('home.aiPlaceholder')"
                      class="input pl-10 pr-4 w-full"
                      autofocus
                      @keydown.enter="handleAiAdd(); showAddSearch = false"
                    />
                  </div>
                  <p class="mt-3 text-xs text-muted-400 text-center">
                    Or <NuxtLink to="/inventory/add" class="text-primary-600 hover:text-primary-700 font-medium" @click="showAddSearch = false">add manually</NuxtLink>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>

      <!-- Charts grid - compact 2x2 layout -->
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <!-- By Cellar -->
        <div class="card p-4">
          <h3 class="text-sm font-semibold text-muted-500 mb-3">{{ $t('home.byCellar') }}</h3>
          <div class="space-y-2">
            <NuxtLink v-for="item in cellarChartData" :key="item.label" :to="{ path: '/inventory', query: item.filterQuery }" class="block group cursor-pointer hover:bg-muted-50 -mx-2 px-2 py-1 rounded-lg transition-colors">
              <div class="flex justify-between text-xs mb-1">
                <span class="text-muted-700 font-medium truncate group-hover:text-primary-600 transition-colors">{{ item.label }}</span>
                <span class="text-muted-500 ml-2">{{ item.bottles }}</span>
              </div>
              <div class="h-2 bg-muted-100 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all" :style="{ width: `${item.width}%`, backgroundColor: item.color }" />
              </div>
            </NuxtLink>
          </div>
        </div>

        <!-- By Color -->
        <div class="card p-4">
          <h3 class="text-sm font-semibold text-muted-500 mb-3">{{ $t('home.byColor') }}</h3>
          <div class="space-y-2">
            <NuxtLink v-for="item in colorChartData" :key="item.label" :to="{ path: '/inventory', query: item.filterQuery }" class="block group cursor-pointer hover:bg-muted-50 -mx-2 px-2 py-1 rounded-lg transition-colors">
              <div class="flex justify-between text-xs mb-1">
                <span class="text-muted-700 font-medium group-hover:text-primary-600 transition-colors">{{ item.label }}</span>
                <span class="text-muted-500">{{ item.bottles }}</span>
              </div>
              <div class="h-2 bg-muted-100 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all" :style="{ width: `${item.width}%`, backgroundColor: item.color }" />
              </div>
            </NuxtLink>
          </div>
        </div>

        <!-- By Region -->
        <div class="card p-4">
          <h3 class="text-sm font-semibold text-muted-500 mb-3">{{ $t('home.topRegions') }}</h3>
          <div class="space-y-2">
            <NuxtLink v-for="item in regionChartData" :key="item.label" :to="{ path: '/inventory', query: item.filterQuery }" class="block group cursor-pointer hover:bg-muted-50 -mx-2 px-2 py-1 rounded-lg transition-colors">
              <div class="flex justify-between text-xs mb-1">
                <span class="text-muted-700 font-medium truncate group-hover:text-primary-600 transition-colors">{{ item.label }}</span>
                <span class="text-muted-500 ml-2">{{ item.bottles }}</span>
              </div>
              <div class="h-2 bg-muted-100 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all" :style="{ width: `${item.width}%`, backgroundColor: item.color }" />
              </div>
            </NuxtLink>
          </div>
           <button
             v-if="hasMoreRegions"
             class="mt-3 text-xs text-primary-600 hover:text-primary-700 font-medium"
             @click="showAllRegions = !showAllRegions"
           >
             {{ showAllRegions ? $t('home.showLess') : $t('home.seeAllRegions') }}
           </button>
        </div>

        <!-- By Vintage -->
        <div v-if="vintageChartData.length > 0" class="card p-4">
          <h3 class="text-sm font-semibold text-muted-500 mb-3">{{ $t('home.topVintages') }}</h3>
          <div class="space-y-2">
            <NuxtLink v-for="item in vintageChartData" :key="item.label" :to="{ path: '/inventory', query: item.filterQuery }" class="block group cursor-pointer hover:bg-muted-50 -mx-2 px-2 py-1 rounded-lg transition-colors">
              <div class="flex justify-between text-xs mb-1">
                <span class="text-muted-700 font-medium group-hover:text-primary-600 transition-colors">{{ item.label }}</span>
                <span class="text-muted-500">{{ item.bottles }}</span>
              </div>
              <div class="h-2 bg-muted-100 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all" :style="{ width: `${item.width}%`, backgroundColor: item.color }" />
              </div>
            </NuxtLink>
          </div>
           <button
             v-if="hasMoreVintages"
             class="mt-3 text-xs text-primary-600 hover:text-primary-700 font-medium"
             @click="showAllVintages = !showAllVintages"
           >
             {{ showAllVintages ? $t('home.showLess') : $t('home.seeAllVintages') }}
           </button>
        </div>
      </div>

      <!-- By Grape (separate row if exists) -->
      <div v-if="grapeChartData.length > 0" class="card p-4 mt-4">
        <h3 class="text-sm font-semibold text-muted-500 mb-3">{{ $t('home.topGrapes') }}</h3>
        <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <NuxtLink v-for="item in grapeChartData" :key="item.label" :to="{ path: '/inventory', query: item.filterQuery }" class="block group cursor-pointer hover:bg-muted-50 -mx-2 px-2 py-1 rounded-lg transition-colors">
            <div class="flex justify-between text-xs mb-1">
              <span class="text-muted-700 font-medium truncate group-hover:text-primary-600 transition-colors">{{ item.label }}</span>
              <span class="text-muted-500 ml-2">{{ item.bottles }}</span>
            </div>
            <div class="h-2 bg-muted-100 rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all" :style="{ width: `${item.width}%`, backgroundColor: item.color }" />
            </div>
          </NuxtLink>
        </div>
         <button
           v-if="hasMoreGrapes"
           class="mt-3 text-xs text-primary-600 hover:text-primary-700 font-medium"
           @click="showAllGrapes = !showAllGrapes"
         >
           {{ showAllGrapes ? $t('home.showLess') : $t('home.seeAllVarieties') }}
         </button>
      </div>
    </template>

    <!-- AI Wine Search Modal -->
    <AiWineSearchModal
      v-model="showAiSearchModal"
      :initial-query="aiInput"
      @add-new="handleAiAddNew"
      @add-existing="handleWineAdded"
    />

    <!-- Add Wine Modal (for manual/prefilled add) -->
    <AddWineModal
      v-model="showAddWineModal"
      :prefill="addWinePrefill"
      @success="handleWineAdded"
      @close="addWinePrefill = null"
    />

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
                  <h2 class="text-xl font-semibold text-muted-900">{{ $t('home.consumeWine') }}</h2>
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
                     <p class="mt-2 font-semibold text-secondary-700">{{ $t('home.consumeSuccess') }}</p>
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
                       <label class="label font-semibold">{{ $t('home.bottlesToConsume') }}</label>
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
                       <h3 class="text-sm font-semibold text-muted-900">{{ $t('home.tastingNotesOptional') }}</h3>

                       <div>
                         <label class="label font-semibold">{{ $t('home.score') }}</label>
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
                         <label class="label font-semibold">{{ $t('home.comment') }}</label>
                         <textarea
                           v-model="consumeTastingNote.comment"
                           rows="3"
                           class="input"
                           placeholder="Describe your tasting experience..."
                         />
                       </div>

                       <div>
                         <label class="label font-semibold">{{ $t('home.pairing') }}</label>
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
                         {{ $t('common.cancel') }}
                       </button>
                       <button
                         type="button"
                         :disabled="isConsuming || consumeQuantity < 1 || consumeQuantity > maxConsumeQuantity"
                         class="btn-primary transition-transform hover:scale-105"
                         @click="handleConsume"
                       >
                         {{ isConsuming ? $t('home.consuming') : $t('home.consume') }}
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

    <!-- AI Wine Search Modal -->
    <AiWineSearchModal
      v-model="showAiSearchModal"
      :search-text="aiInput"
      @add-existing="handleAiAddExisting"
      @add-new="handleAiAddNew"
    />

    <!-- Pairing Chat Modal (Get Inspiration) -->
    <PairingChatModal v-model="showPairingModal" />
  </div>
</template>
