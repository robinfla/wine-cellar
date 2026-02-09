<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

const route = useRoute()
const router = useRouter()

interface LayoutConfig {
  disabledCells?: string[]
  rowLabels?: 'numbers' | 'letters'
  colLabels?: 'numbers' | 'letters'
  startFromBottom?: boolean
}

interface Bottle {
  id: number
  wineId: number
  wineName: string
  producerName: string
  vintage: number | null
  color: string
  position: string | null
  quantity: number
}

interface PositionedBottle extends Omit<Bottle, 'position'> {
  position: string
}

interface Cellar {
  id: number
  name: string
  countryCode: string
  isVirtual: boolean
  notes: string | null
  rows: number | null
  columns: number | null
  layoutConfig: LayoutConfig | null
  bottleCount: number
  bottles: Bottle[]
}

const { data: cellar, pending, error, refresh } = await useFetch<Cellar>(`/api/cellars/${route.params.id}`, {
  key: `cellar-${route.params.id}`,
})

const showLayoutModal = ref(false)
const isSavingLayout = ref(false)
const selectedBottle = ref<Bottle | null>(null)
const showAssignModal = ref(false)
const selectedPositions = ref<string[]>([])
const isAssigning = ref(false)
const bottleSearchQuery = ref('')

// Toast notifications
const toasts = ref<{ id: number; message: string; type: 'success' | 'error' | 'warning' | 'info' }[]>([])
let toastId = 0

const addToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
  const id = ++toastId
  toasts.value.push({ id, message, type })
  setTimeout(() => {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }, 5000)
}

const removeToast = (id: number) => {
  toasts.value = toasts.value.filter(t => t.id !== id)
}

const hasLayout = computed(() => cellar.value?.rows && cellar.value?.columns)

const positionedBottles = computed((): PositionedBottle[] => {
  if (!cellar.value?.bottles) return []
  return cellar.value.bottles.filter((b): b is PositionedBottle => b.position !== null)
})

const unpositionedBottles = computed(() => {
  if (!cellar.value?.bottles) return []
  return cellar.value.bottles.filter(b => !b.position)
})

const filteredUnpositionedBottles = computed(() => {
  const query = bottleSearchQuery.value.toLowerCase().trim()
  if (!query) return unpositionedBottles.value
  return unpositionedBottles.value.filter(b =>
    b.wineName.toLowerCase().includes(query) ||
    b.producerName.toLowerCase().includes(query) ||
    (b.vintage && b.vintage.toString().includes(query))
  )
})

async function saveLayout(layout: { rows: number; columns: number; layoutConfig: LayoutConfig }) {
  if (!cellar.value) return
  
  isSavingLayout.value = true
  try {
    await $fetch(`/api/cellars/${cellar.value.id}`, {
      method: 'PATCH',
      body: {
        rows: layout.rows,
        columns: layout.columns,
        layoutConfig: layout.layoutConfig,
      },
    })
    await refresh()
    showLayoutModal.value = false
  } catch (e) {
    console.error('Failed to save layout:', e)
  } finally {
    isSavingLayout.value = false
  }
}

function handleSelectBottle(bottle: Bottle) {
  selectedBottle.value = bottle
}

function handleSelectPosition(position: string) {
  const index = selectedPositions.value.indexOf(position)
  if (index === -1) {
    selectedPositions.value = [...selectedPositions.value, position]
  } else {
    selectedPositions.value = selectedPositions.value.filter(p => p !== position)
  }
}

function openAssignModal() {
  if (selectedPositions.value.length > 0) {
    bottleSearchQuery.value = ''
    showAssignModal.value = true
  }
}

function clearSelection() {
  selectedPositions.value = []
  showAssignModal.value = false
  bottleSearchQuery.value = ''
}

async function assignBottleToPositions(bottle: Bottle) {
  if (selectedPositions.value.length === 0) return
  
  // Check if bottle has enough quantity for all positions
  if (bottle.quantity < selectedPositions.value.length) {
    addToast(`Not enough bottles (have ${bottle.quantity}, need ${selectedPositions.value.length})`, 'error')
    return
  }
  
  isAssigning.value = true
  try {
    // Assign the bottle to all selected positions by setting binLocation as comma-separated
    const result = await $fetch(`/api/inventory/${bottle.id}`, {
      method: 'PATCH',
      body: {
        binLocation: selectedPositions.value.join(','),
      },
    })
    
    // Force refresh by clearing Nuxt data cache
    clearNuxtData(`cellar-${route.params.id}`)
    await refresh()
    
    const positionLabels = selectedPositions.value.map(p => getPositionLabel(p)).join(', ')
    addToast(`Assigned ${bottle.wineName} to ${positionLabels}`, 'success')
    clearSelection()
  } catch (e: any) {
    console.error('Failed to assign bottle:', e)
    addToast(e?.data?.message || 'Failed to assign bottle', 'error')
  } finally {
    isAssigning.value = false
  }
}

function getPositionLabel(position: string) {
  if (!cellar.value?.layoutConfig) return position
  
  const [rowStr, colStr] = position.split('-')
  const row = parseInt(rowStr, 10)
  const col = parseInt(colStr, 10)
  
  const rowLabels = cellar.value.layoutConfig.rowLabels || 'letters'
  const colLabels = cellar.value.layoutConfig.colLabels || 'numbers'
  const startFromBottom = cellar.value.layoutConfig.startFromBottom ?? true
  
  const actualRow = startFromBottom ? (cellar.value.rows || 0) - row : row + 1
  const rowLabel = rowLabels === 'letters' ? String.fromCharCode(64 + actualRow) : actualRow.toString()
  const colLabel = colLabels === 'letters' ? String.fromCharCode(65 + col) : (col + 1).toString()
  
  return `${rowLabel}${colLabel}`
}

function goToWine(bottle: Bottle) {
  router.push(`/inventory?wine=${bottle.wineId}`)
}
</script>

<template>
  <div>
    <div class="mb-6">
      <NuxtLink
        to="/cellars"
        class="inline-flex items-center gap-1 text-sm text-muted-500 hover:text-muted-700 mb-2"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        {{ $t('cellars.backToCellars') }}
      </NuxtLink>
      
      <div v-if="pending" class="animate-pulse">
        <div class="h-8 w-48 bg-muted-200 rounded mb-2" />
        <div class="h-4 w-32 bg-muted-100 rounded" />
      </div>
      
      <div v-else-if="error" class="text-red-600">
        {{ $t('cellars.failedToLoad') }}
      </div>
      
      <div v-else-if="cellar" class="flex items-start justify-between">
        <div>
          <h1 class="text-2xl font-bold text-muted-900">{{ cellar.name }}</h1>
          <p class="mt-1 text-sm text-muted-600">
            {{ cellar.countryCode }}
            <span v-if="cellar.isVirtual" class="ml-2 text-xs font-semibold bg-muted-200 text-muted-700 px-2 py-0.5 rounded">{{ $t('cellars.virtual') }}</span>
            <span class="ml-2 text-xs font-semibold bg-primary-100 text-primary-700 px-2 py-0.5 rounded">{{ cellar.bottleCount }} {{ $t('common.bottles') }}</span>
          </p>
        </div>
        <button
          class="btn-primary"
          @click="showLayoutModal = true"
        >
          {{ hasLayout ? $t('cellars.editLayout') : $t('cellars.designLayout') }}
        </button>
      </div>
    </div>

    <div v-if="cellar && !pending">
      <div v-if="hasLayout" class="card mb-6">
        <h2 class="text-lg font-display font-bold text-muted-900 mb-4">{{ $t('cellars.cellarLayout') }}</h2>
        <CellarLayoutView
          :rows="cellar.rows!"
          :columns="cellar.columns!"
          :layout-config="cellar.layoutConfig"
          :bottles="positionedBottles"
          :selectable="unpositionedBottles.length > 0"
          :selected-positions="selectedPositions"
          @select-bottle="handleSelectBottle"
          @select-position="handleSelectPosition"
        />
        
        <div v-if="selectedPositions.length > 0" class="mt-4 flex items-center justify-between p-3 bg-primary-50 border border-primary-200 rounded-lg">
          <div class="text-sm text-primary-800">
            <span class="font-semibold">{{ selectedPositions.length }}</span> {{ $t('cellars.positionsSelected') }}
            <span class="text-primary-600 ml-2">
              ({{ selectedPositions.map(p => getPositionLabel(p)).join(', ') }})
            </span>
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              class="btn-secondary text-sm py-1.5 px-3"
              @click="clearSelection"
            >
              {{ $t('cellars.clear') }}
            </button>
            <button
              type="button"
              class="btn-primary text-sm py-1.5 px-3"
              @click="openAssignModal"
            >
              {{ $t('cellars.assignBottle') }}
            </button>
          </div>
        </div>
      </div>

      <div v-else class="card mb-6 text-center py-8">
        <svg class="mx-auto h-12 w-12 text-muted-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
        <h3 class="text-lg font-semibold text-muted-900 mb-2">{{ $t('cellars.noLayout') }}</h3>
        <p class="text-sm text-muted-500 mb-4">
          {{ $t('cellars.noLayoutDesc') }}
        </p>
        <button
          class="btn-primary"
          @click="showLayoutModal = true"
        >
          {{ $t('cellars.designLayout') }}
        </button>
      </div>

      <div v-if="unpositionedBottles.length > 0" class="card">
        <h2 class="text-lg font-display font-bold text-muted-900 mb-4">
          {{ $t('cellars.unpositioned') }}
          <span class="text-sm font-normal text-muted-500 ml-2">{{ unpositionedBottles.length }} {{ $t('common.bottles') }}</span>
        </h2>
        <p class="text-sm text-muted-500 mb-4">
          {{ $t('cellars.unpositionedDesc') }}
        </p>
        <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="bottle in unpositionedBottles"
            :key="bottle.id"
            class="p-3 bg-muted-50 rounded-lg border border-muted-200 cursor-pointer hover:border-primary-300 transition-colors"
            @click="goToWine(bottle)"
          >
            <div class="flex items-center gap-2">
              <span
                class="w-4 h-4 rounded-full flex-shrink-0"
                :class="{
                  'bg-red-600': bottle.color === 'red',
                  'bg-amber-100 border border-amber-300': bottle.color === 'white',
                  'bg-pink-300': bottle.color === 'rose',
                  'bg-amber-50 border border-amber-200': bottle.color === 'sparkling',
                  'bg-amber-400': bottle.color === 'dessert',
                  'bg-amber-700': bottle.color === 'fortified',
                }"
              />
              <div class="min-w-0 flex-1">
                <p class="font-medium text-muted-900 truncate">{{ bottle.wineName }}</p>
                <p class="text-xs text-muted-500 truncate">
                  {{ bottle.producerName }} {{ bottle.vintage || $t('common.nv') }}
                </p>
              </div>
              <span class="text-xs font-semibold text-muted-600 bg-muted-200 px-2 py-0.5 rounded">
                x{{ bottle.quantity }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showLayoutModal && cellar"
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          @click.self="showLayoutModal = false"
        >
          <div class="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
            <CellarLayoutBuilder
              :model-value="cellar.rows && cellar.columns ? {
                rows: cellar.rows,
                columns: cellar.columns,
                layoutConfig: cellar.layoutConfig || {},
              } : null"
              :cellar-name="cellar.name"
              @save="saveLayout"
              @cancel="showLayoutModal = false"
            />
          </div>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="selectedBottle"
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          @click.self="selectedBottle = null"
        >
          <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div class="flex items-start gap-4">
              <span
                class="w-12 h-12 rounded-full flex-shrink-0"
                :class="{
                  'bg-red-600': selectedBottle.color === 'red',
                  'bg-amber-100 border-2 border-amber-300': selectedBottle.color === 'white',
                  'bg-pink-300': selectedBottle.color === 'rose',
                  'bg-amber-50 border-2 border-amber-200': selectedBottle.color === 'sparkling',
                  'bg-amber-400': selectedBottle.color === 'dessert',
                  'bg-amber-700': selectedBottle.color === 'fortified',
                }"
              />
              <div class="flex-1 min-w-0">
                <h3 class="text-lg font-bold text-muted-900">{{ selectedBottle.wineName }}</h3>
                <p class="text-sm text-muted-600">{{ selectedBottle.producerName }}</p>
                <p class="text-sm text-muted-500">{{ selectedBottle.vintage || $t('common.nv') }}</p>
                <p v-if="selectedBottle.position" class="text-xs text-muted-400 mt-2">
                  {{ $t('cellars.position') }}: {{ getPositionLabel(selectedBottle.position) }}
                </p>
              </div>
            </div>
            <div class="mt-6 flex gap-3">
              <button
                class="flex-1 btn-secondary"
                @click="selectedBottle = null"
              >
                {{ $t('common.close') }}
              </button>
              <button
                class="flex-1 btn-primary"
                @click="goToWine(selectedBottle)"
              >
                {{ $t('cellars.viewInInventory') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showAssignModal && selectedPositions.length > 0"
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          @click.self="clearSelection"
        >
          <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 class="text-lg font-bold text-muted-900 mb-1">
              {{ $t('cellars.assignTo', { count: selectedPositions.length }) }}
            </h3>
            <p class="text-sm text-muted-500 mb-4">
              {{ $t('cellars.positions') }}: <span class="font-semibold">{{ selectedPositions.map(p => getPositionLabel(p)).join(', ') }}</span>
            </p>
            
            <div class="mb-3">
              <div class="relative">
                <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  v-model="bottleSearchQuery"
                  type="text"
                  :placeholder="$t('cellars.searchWines')"
                  class="w-full pl-10 pr-4 py-2 border border-muted-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div v-if="isAssigning" class="text-center py-8">
              <svg class="animate-spin h-8 w-8 mx-auto text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p class="mt-2 text-sm text-muted-600">{{ $t('cellars.assigningBottle') }}</p>
            </div>
            
            <div v-else-if="unpositionedBottles.length === 0" class="text-center py-4 text-muted-500">
              {{ $t('cellars.noUnpositioned') }}
            </div>
            
            <div v-else-if="filteredUnpositionedBottles.length === 0" class="text-center py-4 text-muted-500">
              {{ $t('cellars.noBottlesMatch') }}
            </div>
            
            <div v-else class="space-y-2 max-h-64 overflow-y-auto">
              <button
                v-for="bottle in filteredUnpositionedBottles"
                :key="bottle.id"
                type="button"
                class="w-full p-3 bg-muted-50 rounded-lg border border-muted-200 hover:border-primary-300 hover:bg-primary-50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="isAssigning || bottle.quantity < selectedPositions.length"
                :title="bottle.quantity < selectedPositions.length ? $t('cellars.onlyBottlesAvailable', { count: bottle.quantity }) : ''"
                @click="assignBottleToPositions(bottle)"
              >
                <div class="flex items-center gap-3">
                  <span
                    class="w-8 h-8 rounded-full flex-shrink-0"
                    :class="{
                      'bg-red-600': bottle.color === 'red',
                      'bg-amber-100 border border-amber-300': bottle.color === 'white',
                      'bg-pink-300': bottle.color === 'rose',
                      'bg-amber-50 border border-amber-200': bottle.color === 'sparkling',
                      'bg-amber-400': bottle.color === 'dessert',
                      'bg-amber-700': bottle.color === 'fortified',
                    }"
                  />
                  <div class="min-w-0 flex-1">
                    <p class="font-medium text-muted-900 truncate">{{ bottle.wineName }}</p>
                    <p class="text-xs text-muted-500 truncate">
                      {{ bottle.producerName }} {{ bottle.vintage || $t('common.nv') }}
                    </p>
                  </div>
                  <span 
                    class="text-xs font-semibold px-2 py-0.5 rounded"
                    :class="bottle.quantity < selectedPositions.length ? 'bg-red-100 text-red-700' : 'bg-muted-200 text-muted-600'"
                  >
                    x{{ bottle.quantity }}
                  </span>
                </div>
              </button>
            </div>
            
            <div class="mt-4 pt-4 border-t border-muted-200">
              <button
                class="w-full btn-secondary"
                :disabled="isAssigning"
                @click="clearSelection"
              >
                {{ $t('common.cancel') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Toast notifications -->
    <div class="fixed bottom-4 right-4 z-50 space-y-2">
      <Toast
        v-for="toast in toasts"
        :key="toast.id"
        :message="toast.message"
        :type="toast.type"
        @close="removeToast(toast.id)"
      />
    </div>
  </div>
</template>
