<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

const router = useRouter()
const route = useRoute()

// UI state
const showFilters = ref(false)
const showAddMenu = ref(false)
const selectedLot = ref<any>(null)
const showAddWineModal = ref(false)
const searchQuery = ref('')
const searchDebounce = ref<ReturnType<typeof setTimeout> | null>(null)

// Tasting notes state
const tastingNotes = ref<any[]>([])
const newTastingNote = ref({ score: '' as string | number, comment: '' })
const isAddingNote = ref(false)

// Editing state
const editingField = ref<string | null>(null)
const editValues = ref({
  purchaseDate: '',
  purchasePricePerBottle: '',
  wineName: '',
  producerId: null as number | null,
  vintage: null as number | null,
  appellationId: null as number | null,
  regionId: null as number | null,
})
const isUpdating = ref(false)
const showDeleteConfirm = ref(false)
const showDeleteAllConfirm = ref(false)
const isDeletingAll = ref(false)

// Reference data for dropdowns
const { data: producers } = await useFetch('/api/producers')
const { data: appellations } = await useFetch('/api/appellations')
const { data: regionsData } = await useFetch('/api/regions')

// Drinking window state
const drinkFromYear = ref<number | null>(null)
const drinkUntilYear = ref<number | null>(null)
const isSavingDrinkWindow = ref(false)

// Format options
const formatOptions = [
  { id: 1, name: 'Bottle', volumeMl: 750 },
  { id: 2, name: 'Magnum', volumeMl: 1500 },
]

// Filter state
const maturityFilter = ref(route.query.maturity as string || '')
const producerId = ref(route.query.producer ? Number(route.query.producer) : undefined)
const regionId = ref(route.query.region ? Number(route.query.region) : undefined)
const color = ref(route.query.color as string || '')
const vintage = ref(route.query.vintage ? Number(route.query.vintage) : undefined)
const cellarId = ref(route.query.cellar ? Number(route.query.cellar) : undefined)

// Pagination
const page = ref(route.query.page ? Number(route.query.page) : 1)
const limit = 50

// Fetch filter options
const { data: filterOptions } = await useFetch('/api/inventory/filters')

// Debounced search value
const debouncedSearch = ref('')

function handleSearchInput(value: string) {
  searchQuery.value = value
  if (searchDebounce.value) clearTimeout(searchDebounce.value)
  searchDebounce.value = setTimeout(() => {
    debouncedSearch.value = value
    page.value = 1
  }, 300)
}

// Fetch inventory
const { data: inventory, pending, refresh: refreshInventory } = await useFetch('/api/inventory', {
  query: computed(() => ({
    search: debouncedSearch.value || undefined,
    maturity: maturityFilter.value || undefined,
    producerId: producerId.value || undefined,
    regionId: regionId.value || undefined,
    color: color.value || undefined,
    vintage: vintage.value || undefined,
    cellarId: cellarId.value || undefined,
    limit,
    offset: (page.value - 1) * limit,
  })),
})

// Update URL when filters change
watch(
  [maturityFilter, producerId, regionId, color, vintage, cellarId, page],
  () => {
    router.replace({
      query: {
        ...(maturityFilter.value && { maturity: maturityFilter.value }),
        ...(producerId.value && { producer: producerId.value }),
        ...(regionId.value && { region: regionId.value }),
        ...(color.value && { color: color.value }),
        ...(vintage.value && { vintage: vintage.value }),
        ...(cellarId.value && { cellar: cellarId.value }),
        ...(page.value > 1 && { page: page.value }),
      },
    })
  },
)

// Maturity tabs
const maturityTabs = [
  { value: '', label: 'All' },
  { value: 'ready', label: 'Ready to Drink' },
  { value: 'past', label: 'Past Prime' },
  { value: 'young', label: 'To Age' },
]

// Color options
const colorOptions = [
  { value: '', label: 'All colors' },
  { value: 'red', label: 'Red' },
  { value: 'white', label: 'White' },
  { value: 'rose', label: 'Rosé' },
  { value: 'sparkling', label: 'Sparkling' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'fortified', label: 'Fortified' },
]

const getColorDot = (c: string) => {
  const colors: Record<string, string> = {
    red: 'bg-red-500',
    white: 'bg-amber-200',
    rose: 'bg-pink-400',
    sparkling: 'bg-yellow-300',
    dessert: 'bg-orange-400',
    fortified: 'bg-purple-500',
  }
  return colors[c] || 'bg-muted-400'
}

const _getColorLabel = (c: string) => {
  const labels: Record<string, string> = {
    red: 'Red',
    white: 'White',
    rose: 'Rosé',
    sparkling: 'Sparkling',
    dessert: 'Dessert',
    fortified: 'Fortified',
  }
  return labels[c] || c
}

const getMaturityStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    peak: 'bg-secondary-100 text-secondary-700',
    ready: 'bg-secondary-100 text-secondary-700',
    approaching: 'bg-primary-100 text-primary-700',
    declining: 'bg-accent-100 text-accent-700',
    too_early: 'bg-muted-200 text-muted-700',
    past: 'bg-red-100 text-red-700',
    unknown: 'bg-muted-200 text-muted-700',
  }
  return colors[status] || colors.unknown
}

const getMaturityStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    peak: 'At Peak',
    ready: 'Ready',
    approaching: 'Approaching',
    declining: 'Declining',
    too_early: 'Too Early',
    past: 'Past Prime',
    unknown: 'Unknown',
  }
  return labels[status] || status
}

const formatCurrency = (value: string | number | null, currency = 'EUR') => {
  if (!value) return '-'
  return new Intl.NumberFormat('en-EU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(Number(value))
}

const formatDate = (date: string | Date | null) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// Pagination
const totalPages = computed(() => Math.ceil((inventory.value?.total || 0) / limit))
const canPrev = computed(() => page.value > 1)
const canNext = computed(() => page.value < totalPages.value)

function selectLot(lot: any) {
  selectedLot.value = lot
}

function closePanel() {
  selectedLot.value = null
}

// Check if any filters are active
const hasActiveFilters = computed(() =>
  producerId.value || regionId.value || color.value || vintage.value || cellarId.value,
)

// Clear all filters
function clearFilters() {
  producerId.value = undefined
  regionId.value = undefined
  color.value = ''
  vintage.value = undefined
  cellarId.value = undefined
}

// Close add menu when clicking outside
function closeAddMenu() {
  showAddMenu.value = false
}

// Tasting notes functions
async function fetchTastingNotes(lotId: number) {
  try {
    tastingNotes.value = await $fetch(`/api/inventory/${lotId}/tasting-notes`)
  } catch {
    tastingNotes.value = []
  }
}

async function addTastingNote() {
  if (!selectedLot.value) return
  isAddingNote.value = true
  try {
    await $fetch(`/api/inventory/${selectedLot.value.id}/tasting-notes`, {
      method: 'POST',
      body: {
        score: newTastingNote.value.score ? Number(newTastingNote.value.score) : null,
        comment: newTastingNote.value.comment || null,
      },
    })
    newTastingNote.value = { score: '', comment: '' }
    await fetchTastingNotes(selectedLot.value.id)
  } catch (e) {
    console.error('Failed to add tasting note', e)
  } finally {
    isAddingNote.value = false
  }
}

async function deleteTastingNote(noteId: number) {
  try {
    await $fetch(`/api/tasting-notes/${noteId}`, { method: 'DELETE' })
    tastingNotes.value = tastingNotes.value.filter(n => n.id !== noteId)
  } catch (e) {
    console.error('Failed to delete tasting note', e)
  }
}

// Refresh inventory after adding wine
async function handleWineAdded() {
  await refreshInventory()
}

// Watch selected lot to fetch tasting notes and initialize drinking window
watch(selectedLot, async (lot) => {
  if (lot) {
    await fetchTastingNotes(lot.id)
    // Initialize drinking window from maturity data
    drinkFromYear.value = lot.maturity?.drinkFrom ?? null
    drinkUntilYear.value = lot.maturity?.drinkUntil ?? null
  } else {
    tastingNotes.value = []
    drinkFromYear.value = null
    drinkUntilYear.value = null
  }
})

const formatTastingDate = (date: string | Date) => {
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// Quantity control functions
async function _updateQuantity(delta: number) {
  if (!selectedLot.value) return
  const newQty = selectedLot.value.quantity + delta
  if (newQty < 0) return

  isUpdating.value = true
  try {
    await $fetch(`/api/inventory/${selectedLot.value.id}`, {
      method: 'PATCH',
      body: { quantity: newQty },
    })
    selectedLot.value.quantity = newQty
    // Update the lot in the inventory list without full refresh
    if (inventory.value?.lots) {
      const lot = inventory.value.lots.find(l => l.id === selectedLot.value?.id)
      if (lot) lot.quantity = newQty
    }
  } catch (e) {
    console.error('Failed to update quantity', e)
  } finally {
    isUpdating.value = false
  }
}

// Save quantity directly from input
async function saveQuantity() {
  if (!selectedLot.value) return
  const newQty = Math.max(0, selectedLot.value.quantity)

  isUpdating.value = true
  try {
    await $fetch(`/api/inventory/${selectedLot.value.id}`, {
      method: 'PATCH',
      body: { quantity: newQty },
    })
    selectedLot.value.quantity = newQty
    if (inventory.value?.lots) {
      const lot = inventory.value.lots.find(l => l.id === selectedLot.value?.id)
      if (lot) lot.quantity = newQty
    }
  } catch (e) {
    console.error('Failed to save quantity', e)
  } finally {
    isUpdating.value = false
  }
}

// Save format change
async function saveFormat(event: Event) {
  if (!selectedLot.value) return
  const select = event.target as HTMLSelectElement
  const newFormatId = Number(select.value)
  const format = formatOptions.find(f => f.id === newFormatId)
  if (!format) return

  isUpdating.value = true
  try {
    await $fetch(`/api/inventory/${selectedLot.value.id}`, {
      method: 'PATCH',
      body: { formatId: newFormatId },
    })
    selectedLot.value.formatId = newFormatId
    selectedLot.value.formatName = format.name
    if (inventory.value?.lots) {
      const lot = inventory.value.lots.find(l => l.id === selectedLot.value?.id)
      if (lot) {
        lot.formatId = newFormatId
        lot.formatName = format.name
      }
    }
  } catch (e) {
    console.error('Failed to save format', e)
  } finally {
    isUpdating.value = false
  }
}

// Save drinking window
async function saveDrinkingWindow() {
  if (!selectedLot.value) return

  isSavingDrinkWindow.value = true
  try {
    await $fetch(`/api/inventory/${selectedLot.value.id}/maturity`, {
      method: 'PATCH',
      body: {
        drinkFromYear: drinkFromYear.value,
        drinkUntilYear: drinkUntilYear.value,
      },
    })
    // Update local maturity data
    if (selectedLot.value.maturity) {
      selectedLot.value.maturity.drinkFrom = drinkFromYear.value
      selectedLot.value.maturity.drinkUntil = drinkUntilYear.value
    }
  } catch (e) {
    console.error('Failed to save drinking window', e)
  } finally {
    isSavingDrinkWindow.value = false
  }
}

// Inline editing functions
function startEditing(field: string) {
  editingField.value = field
  if (field === 'purchaseDate') {
    editValues.value.purchaseDate = selectedLot.value.purchaseDate
      ? new Date(selectedLot.value.purchaseDate).toISOString().split('T')[0]
      : ''
  } else if (field === 'purchasePricePerBottle') {
    editValues.value.purchasePricePerBottle = selectedLot.value.purchasePricePerBottle || ''
  } else if (field === 'wineName') {
    editValues.value.wineName = selectedLot.value.wineName || ''
  } else if (field === 'producer') {
    editValues.value.producerId = selectedLot.value.producerId || null
  } else if (field === 'vintage') {
    editValues.value.vintage = selectedLot.value.vintage || null
  } else if (field === 'appellation') {
    editValues.value.appellationId = selectedLot.value.appellationId || null
  } else if (field === 'region') {
    editValues.value.regionId = selectedLot.value.wineRegionId || selectedLot.value.regionId || null
  }
}

async function saveField(field: string) {
  if (!selectedLot.value) return
  isUpdating.value = true
  try {
    // Wine-level fields use wine PATCH endpoint
    if (field === 'wineName' || field === 'producer' || field === 'appellation' || field === 'region') {
      const body: Record<string, any> = {}
      if (field === 'wineName') {
        body.name = editValues.value.wineName
        selectedLot.value.wineName = editValues.value.wineName
      } else if (field === 'producer') {
        body.producerId = editValues.value.producerId
        selectedLot.value.producerId = editValues.value.producerId
        // Update producer name in local state
        const producer = producers.value?.find((p: any) => p.id === editValues.value.producerId)
        if (producer) {
          selectedLot.value.producerName = producer.name
          // Only update region from producer if wine doesn't have its own region
          if (!selectedLot.value.wineRegionId) {
            selectedLot.value.regionName = producer.regionName || null
          }
        }
      } else if (field === 'appellation') {
        body.appellationId = editValues.value.appellationId
        selectedLot.value.appellationId = editValues.value.appellationId
        // Update appellation name in local state
        const appellation = appellations.value?.find((a: any) => a.id === editValues.value.appellationId)
        selectedLot.value.appellationName = appellation?.name || null
      } else if (field === 'region') {
        body.regionId = editValues.value.regionId
        selectedLot.value.wineRegionId = editValues.value.regionId
        selectedLot.value.regionId = editValues.value.regionId
        // Update region name in local state
        const region = regionsData.value?.find((r: any) => r.id === editValues.value.regionId)
        selectedLot.value.regionName = region?.name || null
      }
      await $fetch(`/api/wines/${selectedLot.value.wineId}`, {
        method: 'PATCH',
        body,
      })
      // Update list view
      if (inventory.value?.lots) {
        const lot = inventory.value.lots.find((l: any) => l.id === selectedLot.value?.id)
        if (lot) {
          if (field === 'wineName') lot.wineName = selectedLot.value.wineName
          if (field === 'producer') {
            lot.producerName = selectedLot.value.producerName
            // Only update region from producer if wine doesn't have its own region
            if (!lot.wineRegionId) {
              lot.regionName = selectedLot.value.regionName
            }
          }
          if (field === 'appellation') lot.appellationName = selectedLot.value.appellationName
          if (field === 'region') {
            lot.regionName = selectedLot.value.regionName
            lot.wineRegionId = selectedLot.value.wineRegionId
            lot.regionId = selectedLot.value.regionId
          }
        }
      }
    }
    // Lot-level fields use inventory PATCH endpoint
    else if (field === 'vintage') {
      const body = { vintage: editValues.value.vintage }
      await $fetch(`/api/inventory/${selectedLot.value.id}`, {
        method: 'PATCH',
        body,
      })
      selectedLot.value.vintage = editValues.value.vintage
      // Update list view
      if (inventory.value?.lots) {
        const lot = inventory.value.lots.find((l: any) => l.id === selectedLot.value?.id)
        if (lot) lot.vintage = editValues.value.vintage
      }
    }
    else {
      const body: Record<string, any> = {}
      if (field === 'purchaseDate') {
        body.purchaseDate = editValues.value.purchaseDate || null
        selectedLot.value.purchaseDate = editValues.value.purchaseDate || null
      } else if (field === 'purchasePricePerBottle') {
        body.purchasePricePerBottle = editValues.value.purchasePricePerBottle || null
        selectedLot.value.purchasePricePerBottle = editValues.value.purchasePricePerBottle || null
      }
      await $fetch(`/api/inventory/${selectedLot.value.id}`, {
        method: 'PATCH',
        body,
      })
    }
    editingField.value = null
  } catch (e) {
    console.error('Failed to save field', e)
  } finally {
    isUpdating.value = false
  }
}

function cancelEditing() {
  editingField.value = null
}

// Delete lot function
async function deleteLot() {
  if (!selectedLot.value) return
  isUpdating.value = true
  try {
    await $fetch(`/api/inventory/${selectedLot.value.id}`, { method: 'DELETE' })
    closePanel()
    await refreshInventory()
  } catch (e) {
    console.error('Failed to delete lot', e)
  } finally {
    isUpdating.value = false
    showDeleteConfirm.value = false
  }
}

// Delete all wines function
async function deleteAllWines() {
  isDeletingAll.value = true
  try {
    await $fetch('/api/inventory/delete-all', {
      method: 'POST',
      body: { confirm: true },
    })
    closePanel()
    await refreshInventory()
  } catch (e) {
    console.error('Failed to delete all wines', e)
  } finally {
    isDeletingAll.value = false
    showDeleteAllConfirm.value = false
  }
}

// Close panel on escape key
onMounted(() => {
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closePanel()
  }
  window.addEventListener('keydown', handleEscape)
  onUnmounted(() => window.removeEventListener('keydown', handleEscape))
})
</script>

<template>
  <div class="flex">
    <!-- Main content -->
    <div class="flex-1 min-w-0" :class="{ 'mr-96': selectedLot }">
      <!-- Toolbar -->
      <div class="flex items-center justify-between gap-4 mb-4">
        <!-- Left: Search and Filters -->
        <div class="flex items-center gap-2">
          <!-- Search bar -->
          <div class="relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              :value="searchQuery"
              type="text"
              placeholder="Search wines..."
              class="pl-9 pr-4 py-2 w-64 text-sm border border-muted-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary-500"
              @input="handleSearchInput(($event.target as HTMLInputElement).value)"
            >
          </div>

          <!-- Filters toggle -->
          <button
            class="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-muted-700 bg-white border border-muted-300 rounded-lg hover:bg-muted-50 hover:scale-102 transition-transform"
            @click="showFilters = !showFilters"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters
            <span v-if="hasActiveFilters" class="w-2 h-2 bg-primary-500 rounded-full" />
          </button>
        </div>

        <!-- Right: Actions -->
        <div class="flex items-center gap-2">
          <a
            href="/api/inventory/export"
            download
            class="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-muted-700 bg-white border border-muted-300 rounded-lg hover:bg-muted-50 hover:scale-102 transition-transform"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </a>

          <button
            v-if="inventory?.total && inventory.total > 0"
            class="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-red-600 bg-white border border-red-300 rounded-lg hover:bg-red-50 hover:scale-102 transition-transform"
            @click="showDeleteAllConfirm = true"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete All
          </button>

          <!-- Add Wine dropdown -->
          <div class="relative">
            <button
              class="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 hover:scale-105 transition-transform"
              @click="showAddMenu = !showAddMenu"
            >
              Add Wine
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div
              v-if="showAddMenu"
              class="absolute right-0 z-10 mt-2 w-48 bg-white rounded-lg border border-muted-200 py-1"
            >
              <button
                class="block w-full text-left px-4 py-2 text-sm text-muted-700 hover:bg-muted-100"
                @click="showAddWineModal = true; closeAddMenu()"
              >
                Add Wine
              </button>
              <NuxtLink
                to="/inventory/import"
                class="block px-4 py-2 text-sm text-muted-700 hover:bg-muted-100"
                @click="closeAddMenu"
              >
                Import CSV
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick filter tabs -->
      <div class="flex gap-1 border-b border-muted-200 mb-4">
        <button
          v-for="tab in maturityTabs"
          :key="tab.value"
          class="px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors"
          :class="maturityFilter === tab.value
            ? 'text-primary-600 border-primary-600'
            : 'text-muted-500 border-transparent hover:text-muted-700 hover:border-muted-300'"
          @click="maturityFilter = tab.value; page = 1"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Collapsible filters panel -->
      <div
        v-show="showFilters"
        class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4 p-4 bg-muted-50 rounded-lg border border-muted-200"
      >
        <div>
          <label class="block text-xs font-semibold text-muted-500 mb-1">Producer</label>
          <select v-model="producerId" class="input text-sm" @change="page = 1">
            <option :value="undefined">All producers</option>
            <option v-for="p in filterOptions?.producers" :key="p.id" :value="p.id">
              {{ p.name }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-semibold text-muted-500 mb-1">Region</label>
          <select v-model="regionId" class="input text-sm" @change="page = 1">
            <option :value="undefined">All regions</option>
            <option v-for="r in filterOptions?.regions" :key="r.id" :value="r.id">
              {{ r.name }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-semibold text-muted-500 mb-1">Color</label>
          <select v-model="color" class="input text-sm" @change="page = 1">
            <option v-for="opt in colorOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-semibold text-muted-500 mb-1">Vintage</label>
          <select v-model="vintage" class="input text-sm" @change="page = 1">
            <option :value="undefined">All vintages</option>
            <option v-for="v in filterOptions?.vintages" :key="v" :value="v">
              {{ v }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-semibold text-muted-500 mb-1">Cellar</label>
          <select v-model="cellarId" class="input text-sm" @change="page = 1">
            <option :value="undefined">All cellars</option>
            <option v-for="c in filterOptions?.cellars" :key="c.id" :value="c.id">
              {{ c.name }}
            </option>
          </select>
        </div>

        <div v-if="hasActiveFilters" class="col-span-full">
          <button
            class="text-sm text-primary-600 hover:text-primary-700 hover:scale-102 transition-transform"
            @click="clearFilters"
          >
            Clear all filters
          </button>
        </div>
      </div>

      <!-- Loading state -->
      <div v-if="pending" class="text-center py-12">
        <p class="text-muted-500">Loading inventory...</p>
      </div>

      <!-- Empty state -->
      <div v-else-if="!inventory?.lots?.length" class="text-center py-12">
        <svg class="mx-auto h-12 w-12 text-muted-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
        <h3 class="mt-4 text-lg font-semibold text-muted-900">No wines found</h3>
        <p class="mt-2 text-sm text-muted-500">
          {{ hasActiveFilters || maturityFilter ? 'Try adjusting your filters.' : 'Get started by adding wines to your cellar.' }}
        </p>
      </div>

      <!-- Table -->
      <div v-else class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b border-muted-200">
              <th class="px-4 py-3 text-left text-xs font-semibold text-muted-500 uppercase tracking-wider">Name</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-muted-500 uppercase tracking-wider">Producer</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-muted-500 uppercase tracking-wider">Region</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-muted-500 uppercase tracking-wider">Vintage</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-muted-500 uppercase tracking-wider">Color</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-muted-500 uppercase tracking-wider">Qty</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-muted-100">
            <tr
              v-for="lot in inventory.lots"
              :key="lot.id"
              class="cursor-pointer transition-colors"
              :class="selectedLot?.id === lot.id ? 'bg-primary-50' : 'hover:bg-muted-50'"
              @click="selectLot(lot)"
            >
              <td class="px-4 py-3 text-sm font-semibold text-muted-900">{{ lot.wineName }}</td>
              <td class="px-4 py-3 text-sm text-muted-600">{{ lot.producerName }}</td>
              <td class="px-4 py-3 text-sm text-muted-600">{{ lot.regionName || lot.appellationName || '-' }}</td>
              <td class="px-4 py-3 text-sm text-muted-600">{{ lot.vintage || 'NV' }}</td>
              <td class="px-4 py-3">
                <span
                  class="inline-block w-3 h-3 rounded-full"
                  :class="getColorDot(lot.wineColor)"
                  :title="lot.wineColor"
                />
              </td>
              <td class="px-4 py-3 text-sm text-muted-900 text-right font-semibold">{{ lot.quantity }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="inventory?.total" class="flex items-center justify-between mt-4 pt-4 border-t border-muted-200">
        <span class="text-sm text-muted-600">
          {{ (page - 1) * limit + 1 }}-{{ Math.min(page * limit, inventory.total) }} of {{ inventory.total }} results
        </span>
        <div class="flex gap-2">
          <button
            class="px-3 py-1.5 text-sm font-semibold text-muted-700 bg-white border border-muted-300 rounded-md hover:bg-muted-50 hover:scale-102 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!canPrev"
            @click="page--"
          >
            Prev
          </button>
          <button
            class="px-3 py-1.5 text-sm font-semibold text-muted-700 bg-white border border-muted-300 rounded-md hover:bg-muted-50 hover:scale-102 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!canNext"
            @click="page++"
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <!-- Side Panel -->
    <Transition
      enter-active-class="transition-transform duration-300 ease-out"
      enter-from-class="translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transition-transform duration-200 ease-in"
      leave-from-class="translate-x-0"
      leave-to-class="translate-x-full"
    >
      <div
        v-if="selectedLot"
        class="fixed right-0 top-0 h-full w-96 bg-white border-l-2 border-muted-200 overflow-y-auto z-20"
      >
        <!-- Panel Header -->
        <div class="sticky top-0 bg-white border-b border-muted-200 px-6 py-4 z-10">
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <!-- Wine Name - Editable -->
              <div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-full flex-shrink-0" :class="getColorDot(selectedLot.wineColor)" />
                <div v-if="editingField === 'wineName'" class="flex items-center gap-1 flex-1">
                  <input
                    v-model="editValues.wineName"
                    type="text"
                    class="input text-lg font-bold py-1 flex-1"
                    @keydown.enter="saveField('wineName')"
                    @keydown.escape="cancelEditing"
                  >
                  <button
                    type="button"
                    class="p-1.5 text-secondary-600 hover:text-secondary-700"
                    @click="saveField('wineName')"
                  >
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    class="p-1.5 text-muted-400 hover:text-muted-600"
                    @click="cancelEditing"
                  >
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <h2
                  v-else
                  class="font-display font-bold text-xl text-muted-900 truncate cursor-pointer hover:text-primary-600 transition-colors"
                  @click="startEditing('wineName')"
                >
                  {{ selectedLot.wineName }}
                </h2>
              </div>
              <!-- Producer - Editable -->
              <div class="ml-5">
                <div v-if="editingField === 'producer'" class="flex items-center gap-1 mt-1">
                  <select
                    v-model="editValues.producerId"
                    class="input text-sm py-1 flex-1"
                  >
                    <option v-for="p in producers" :key="p.id" :value="p.id">
                      {{ p.name }}
                    </option>
                  </select>
                  <button
                    type="button"
                    class="p-1.5 text-secondary-600 hover:text-secondary-700"
                    @click="saveField('producer')"
                  >
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    class="p-1.5 text-muted-400 hover:text-muted-600"
                    @click="cancelEditing"
                  >
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p
                  v-else
                  class="text-sm text-muted-500 cursor-pointer hover:text-primary-600 transition-colors"
                  @click="startEditing('producer')"
                >
                  {{ selectedLot.producerName }}
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <!-- Maturity badge with tooltip -->
              <div v-if="selectedLot.maturity" class="relative group">
                <span
                  class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border-2 cursor-help"
                  :class="getMaturityStatusColor(selectedLot.maturity.status)"
                >
                  {{ getMaturityStatusLabel(selectedLot.maturity.status) }}
                </span>
                <!-- Tooltip -->
                <div class="absolute right-0 top-full mt-2 px-3 py-2 bg-muted-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                  {{ selectedLot.maturity.message }}
                </div>
              </div>
              <button
                class="p-1.5 text-muted-400 hover:text-muted-600 rounded-lg hover:bg-muted-100 hover:scale-105 transition-all"
                @click="closePanel"
              >
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Section: Details (white bg) -->
        <div class="px-6 py-5 bg-white">
          <div class="flex items-center gap-2.5 mb-4">
            <div class="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
              <svg class="w-4 h-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 class="font-display font-bold text-muted-900">Details</h3>
          </div>
          <dl class="space-y-3">
            <!-- Vintage - Editable -->
            <div class="flex justify-between items-center">
              <dt class="text-sm text-muted-500">Vintage</dt>
              <dd v-if="editingField === 'vintage'" class="flex items-center gap-1">
                <input
                  v-model.number="editValues.vintage"
                  type="number"
                  min="1900"
                  max="2100"
                  class="input w-20 text-sm text-center py-1"
                  placeholder="NV"
                  @keydown.enter="saveField('vintage')"
                  @keydown.escape="cancelEditing"
                >
                <button
                  type="button"
                  class="p-1.5 text-secondary-600 hover:text-secondary-700"
                  @click="saveField('vintage')"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button
                  type="button"
                  class="p-1.5 text-muted-400 hover:text-muted-600"
                  @click="cancelEditing"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </dd>
              <dd
                v-else
                class="text-sm font-semibold text-muted-900 cursor-pointer hover:text-primary-600 transition-colors"
                @click="startEditing('vintage')"
              >
                {{ selectedLot.vintage || 'NV' }}
              </dd>
            </div>
            <!-- Appellation - Editable -->
            <div class="flex justify-between items-center">
              <dt class="text-sm text-muted-500">Appellation</dt>
              <dd v-if="editingField === 'appellation'" class="flex items-center gap-1">
                <select
                  v-model="editValues.appellationId"
                  class="input text-sm py-1 w-40"
                >
                  <option :value="null">None</option>
                  <option v-for="a in appellations" :key="a.id" :value="a.id">
                    {{ a.name }}
                  </option>
                </select>
                <button
                  type="button"
                  class="p-1.5 text-secondary-600 hover:text-secondary-700"
                  @click="saveField('appellation')"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button
                  type="button"
                  class="p-1.5 text-muted-400 hover:text-muted-600"
                  @click="cancelEditing"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </dd>
              <dd
                v-else
                class="text-sm font-semibold text-muted-900 cursor-pointer hover:text-primary-600 transition-colors"
                @click="startEditing('appellation')"
              >
                {{ selectedLot.appellationName || '-' }}
              </dd>
            </div>
            <!-- Region - Editable -->
            <div class="flex justify-between items-center">
              <dt class="text-sm text-muted-500">Region</dt>
              <dd v-if="editingField === 'region'" class="flex items-center gap-1">
                <select
                  v-model="editValues.regionId"
                  class="input text-sm py-1 w-40"
                >
                  <option :value="null">None</option>
                  <option v-for="r in regionsData" :key="r.id" :value="r.id">
                    {{ r.name }}
                  </option>
                </select>
                <button
                  type="button"
                  class="p-1.5 text-secondary-600 hover:text-secondary-700"
                  @click="saveField('region')"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button
                  type="button"
                  class="p-1.5 text-muted-400 hover:text-muted-600"
                  @click="cancelEditing"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </dd>
              <dd
                v-else
                class="text-sm font-semibold text-muted-900 cursor-pointer hover:text-primary-600 transition-colors"
                @click="startEditing('region')"
              >
                {{ selectedLot.regionName || '-' }}
              </dd>
            </div>
            <!-- Drinking Window - Editable -->
            <div class="flex justify-between items-center">
              <dt class="text-sm text-muted-500">Drinking Window</dt>
              <dd class="flex items-center gap-2">
                <input
                  v-model.number="drinkFromYear"
                  type="number"
                  min="1900"
                  max="2100"
                  class="input w-20 text-sm text-center py-1.5"
                  placeholder="From"
                  :disabled="isSavingDrinkWindow"
                  @change="saveDrinkingWindow"
                >
                <span class="text-muted-400">-</span>
                <input
                  v-model.number="drinkUntilYear"
                  type="number"
                  min="1900"
                  max="2100"
                  class="input w-20 text-sm text-center py-1.5"
                  placeholder="Until"
                  :disabled="isSavingDrinkWindow"
                  @change="saveDrinkingWindow"
                >
              </dd>
            </div>
          </dl>
        </div>

        <!-- Section: Inventory (gray bg) -->
        <div class="px-6 py-5 bg-muted-50">
          <div class="flex items-center gap-2.5 mb-4">
            <div class="w-8 h-8 rounded-lg bg-secondary-100 flex items-center justify-center">
              <svg class="w-4 h-4 text-secondary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 class="font-display font-bold text-muted-900">Inventory</h3>
          </div>

          <dl class="space-y-3">
            <!-- Quantity with format selector -->
            <div class="flex justify-between items-center">
              <dt class="text-sm text-muted-500">Quantity</dt>
              <dd class="flex items-center gap-2">
                <input
                  v-model.number="selectedLot.quantity"
                  type="number"
                  min="0"
                  class="input w-20 text-sm text-center py-1.5"
                  :disabled="isUpdating"
                  @change="saveQuantity"
                >
                <select
                  class="input w-28 text-sm py-1.5"
                  :value="selectedLot.formatId"
                  :disabled="isUpdating"
                  @change="saveFormat"
                >
                  <option v-for="fmt in formatOptions" :key="fmt.id" :value="fmt.id">
                    {{ fmt.name }}
                  </option>
                </select>
              </dd>
            </div>
            <div class="flex justify-between items-center">
              <dt class="text-sm text-muted-500">Cellar</dt>
              <dd class="text-sm font-semibold text-muted-900">{{ selectedLot.cellarName }}</dd>
            </div>
            <div v-if="selectedLot.binLocation" class="flex justify-between items-center">
              <dt class="text-sm text-muted-500">Bin Location</dt>
              <dd class="text-sm font-semibold text-muted-900">{{ selectedLot.binLocation }}</dd>
            </div>
          </dl>
        </div>

        <!-- Section: Purchase (white bg) -->
        <div class="px-6 py-5 bg-white">
          <div class="flex items-center gap-2.5 mb-4">
            <div class="w-8 h-8 rounded-lg bg-accent-100 flex items-center justify-center">
              <svg class="w-4 h-4 text-accent-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <h3 class="font-display font-bold text-muted-900">Purchase</h3>
          </div>
          <dl class="space-y-3">
            <!-- Purchase Date - Editable -->
            <div class="flex justify-between items-center">
              <dt class="text-sm text-muted-500">Date</dt>
              <dd v-if="editingField === 'purchaseDate'" class="flex items-center gap-1">
                <input
                  v-model="editValues.purchaseDate"
                  type="date"
                  class="input text-sm py-1.5 w-36"
                  @keydown.enter="saveField('purchaseDate')"
                  @keydown.escape="cancelEditing"
                >
                <button
                  type="button"
                  class="p-1.5 text-secondary-600 hover:text-secondary-700 hover:scale-105 transition-transform"
                  @click="saveField('purchaseDate')"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button
                  type="button"
                  class="p-1.5 text-muted-400 hover:text-muted-600 hover:scale-105 transition-transform"
                  @click="cancelEditing"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </dd>
              <dd
                v-else
                class="text-sm font-semibold text-muted-900 cursor-pointer hover:text-primary-600 transition-colors"
                @click="startEditing('purchaseDate')"
              >
                {{ formatDate(selectedLot.purchaseDate) }}
              </dd>
            </div>

            <!-- Price per bottle - Editable -->
            <div class="flex justify-between items-center">
              <dt class="text-sm text-muted-500">Price per bottle</dt>
              <dd v-if="editingField === 'purchasePricePerBottle'" class="flex items-center gap-1">
                <input
                  v-model="editValues.purchasePricePerBottle"
                  type="number"
                  step="0.01"
                  min="0"
                  class="input text-sm py-1.5 w-24"
                  @keydown.enter="saveField('purchasePricePerBottle')"
                  @keydown.escape="cancelEditing"
                >
                <button
                  type="button"
                  class="p-1.5 text-secondary-600 hover:text-secondary-700 hover:scale-105 transition-transform"
                  @click="saveField('purchasePricePerBottle')"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button
                  type="button"
                  class="p-1.5 text-muted-400 hover:text-muted-600 hover:scale-105 transition-transform"
                  @click="cancelEditing"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </dd>
              <dd
                v-else
                class="text-sm font-semibold text-muted-900 cursor-pointer hover:text-primary-600 transition-colors"
                @click="startEditing('purchasePricePerBottle')"
              >
                {{ formatCurrency(selectedLot.purchasePricePerBottle, selectedLot.purchaseCurrency) }}
              </dd>
            </div>

            <div v-if="selectedLot.purchaseSource" class="flex justify-between items-center">
              <dt class="text-sm text-muted-500">Source</dt>
              <dd class="text-sm font-semibold text-muted-900">{{ selectedLot.purchaseSource }}</dd>
            </div>
          </dl>

          <!-- Notes (within purchase section if present) -->
          <div v-if="selectedLot.notes" class="mt-4 pt-4 border-t border-muted-200">
            <p class="text-xs font-semibold text-muted-500 uppercase tracking-wide mb-2">Notes</p>
            <p class="text-sm text-muted-600">{{ selectedLot.notes }}</p>
          </div>
        </div>

        <!-- Section: Tasting Notes (gray bg) -->
        <div class="px-6 py-5 bg-muted-50">
          <div class="flex items-center gap-2.5 mb-4">
            <div class="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
              <svg class="w-4 h-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <h3 class="font-display font-bold text-muted-900">Tasting Notes</h3>
          </div>

          <!-- Add new note form -->
          <div class="p-4 bg-white rounded-xl border-2 border-muted-200 mb-4">
            <div class="flex gap-3 mb-3">
              <div class="flex-shrink-0">
                <label class="block text-xs font-medium text-muted-500 mb-1.5">Score</label>
                <div class="flex items-center gap-1">
                  <input
                    v-model="newTastingNote.score"
                    type="number"
                    min="0"
                    max="100"
                    class="input w-16 text-sm text-center"
                    placeholder="--"
                  >
                  <span class="text-sm text-muted-400">/100</span>
                </div>
              </div>
              <div class="flex-1">
                <label class="block text-xs font-medium text-muted-500 mb-1.5">Comment</label>
                <textarea
                  v-model="newTastingNote.comment"
                  rows="2"
                  class="input text-sm w-full resize-none"
                  placeholder="Your tasting notes..."
                />
              </div>
            </div>
            <button
              type="button"
              class="w-full px-3 py-2 text-sm font-semibold text-white bg-primary rounded-xl hover:bg-primary-600 hover:scale-102 transition-all disabled:opacity-50"
              :disabled="isAddingNote || (!newTastingNote.score && !newTastingNote.comment)"
              @click="addTastingNote"
            >
              {{ isAddingNote ? 'Adding...' : 'Add Note' }}
            </button>
          </div>

          <!-- Existing notes -->
          <div v-if="tastingNotes.length > 0" class="space-y-3">
            <div
              v-for="note in tastingNotes"
              :key="note.id"
              class="p-4 bg-white rounded-xl border-2 border-muted-200"
            >
              <div class="flex items-start justify-between mb-2">
                <div class="flex items-center gap-2">
                  <span v-if="note.score !== null" class="text-sm font-display font-bold text-primary-600">
                    {{ note.score }}/100
                  </span>
                  <span class="text-xs text-muted-400">
                    {{ formatTastingDate(note.tastedAt) }}
                  </span>
                </div>
                <button
                  type="button"
                  class="p-1 text-muted-400 hover:text-red-500 hover:scale-105 transition-all"
                  @click="deleteTastingNote(note.id)"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p v-if="note.comment" class="text-sm text-muted-600">{{ note.comment }}</p>
            </div>
          </div>
          <p v-else class="text-sm text-muted-500 text-center py-4">
            No tasting notes yet
          </p>
        </div>

        <!-- Actions (white bg) -->
        <div class="px-6 py-5 bg-white border-t border-muted-200">
          <div v-if="!showDeleteConfirm">
            <button
              type="button"
              class="w-full px-4 py-2.5 text-sm font-semibold text-red-600 bg-red-50 rounded-xl border-2 border-red-200 hover:bg-red-100 hover:scale-102 transition-all"
              @click="showDeleteConfirm = true"
            >
              Delete Lot
            </button>
          </div>
          <div v-else class="p-4 bg-red-50 rounded-xl border-2 border-red-200">
            <p class="text-sm text-red-700 mb-3">Are you sure you want to delete this lot?</p>
            <div class="flex gap-2">
              <button
                type="button"
                class="flex-1 px-3 py-2 text-sm font-semibold text-muted-700 bg-white border-2 border-muted-300 rounded-xl hover:bg-muted-50 hover:scale-102 transition-all"
                @click="showDeleteConfirm = false"
              >
                Cancel
              </button>
              <button
                type="button"
                class="flex-1 px-3 py-2 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 hover:scale-105 transition-all disabled:opacity-50"
                :disabled="isUpdating"
                @click="deleteLot"
              >
                {{ isUpdating ? 'Deleting...' : 'Confirm' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Overlay -->
    <div
      v-if="selectedLot"
      class="fixed inset-0 bg-black/20 z-10 lg:hidden"
      @click="closePanel"
    />

    <!-- Add Wine Modal -->
    <AddWineModal
      v-model="showAddWineModal"
      @success="handleWineAdded"
    />

    <!-- Delete All Confirmation Modal -->
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
          v-if="showDeleteAllConfirm"
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          @click.self="showDeleteAllConfirm = false"
        >
          <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div class="flex items-center gap-4 mb-4">
              <div class="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg class="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 class="text-lg font-display font-bold text-muted-900">Delete All Wines</h3>
                <p class="text-sm text-muted-500">This action cannot be undone</p>
              </div>
            </div>

            <p class="text-sm text-muted-700 mb-6">
              This will permanently delete all <strong>{{ inventory?.total || 0 }}</strong> wines from your inventory, including all associated tasting notes and history.
            </p>

            <div class="flex gap-3">
              <button
                type="button"
                class="flex-1 px-4 py-2.5 text-sm font-semibold text-muted-700 bg-white border-2 border-muted-300 rounded-xl hover:bg-muted-50 hover:scale-102 transition-all"
                :disabled="isDeletingAll"
                @click="showDeleteAllConfirm = false"
              >
                Cancel
              </button>
              <button
                type="button"
                class="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 hover:scale-105 transition-all disabled:opacity-50"
                :disabled="isDeletingAll"
                @click="deleteAllWines"
              >
                {{ isDeletingAll ? 'Deleting...' : 'Delete All' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
