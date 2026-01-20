<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

const router = useRouter()
const route = useRoute()

// UI state
const selectedAllocation = ref<any>(null)
const showAddModal = ref(false)
const showAddItemModal = ref(false)

// View tab state
const viewTab = ref<'list' | 'timeline'>('list')

// Filter state
const statusFilter = ref(route.query.status as string || '')
const yearFilter = ref(route.query.year ? Number(route.query.year) : undefined)

// Pagination
const page = ref(route.query.page ? Number(route.query.page) : 1)
const limit = 50

// Status tabs
const statusTabs = [
  { value: '', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'to_claim', label: 'To Claim' },
  { value: 'on_the_way', label: 'On the Way' },
  { value: 'received', label: 'Received' },
]

// Fetch allocations
const { data: allocationsData, pending, refresh: refreshAllocations } = await useFetch('/api/allocations', {
  query: computed(() => ({
    status: statusFilter.value || undefined,
    year: yearFilter.value || undefined,
    limit,
    offset: (page.value - 1) * limit,
  })),
})

// Fetch producers for the add modal
const { data: producers, refresh: refreshProducers } = await useFetch('/api/producers')

// Inline producer creation
const showNewProducer = ref(false)
const newProducerName = ref('')
const isCreatingProducer = ref(false)

// Producer search
const producerSearch = ref('')
const showProducerDropdown = ref(false)

const filteredProducers = computed(() => {
  if (!producers.value) return []
  if (!producerSearch.value.trim()) return producers.value
  const search = producerSearch.value.toLowerCase()
  return producers.value.filter((p: any) =>
    p.name.toLowerCase().includes(search),
  )
})

const _selectedProducerName = computed(() => {
  if (!newAllocation.value.producerId || !producers.value) return ''
  const producer = producers.value.find((p: any) => p.id === newAllocation.value.producerId)
  return producer?.name || ''
})

function selectProducer(producer: any) {
  newAllocation.value.producerId = producer.id
  producerSearch.value = producer.name
  showProducerDropdown.value = false
}

function clearProducerSelection() {
  newAllocation.value.producerId = null
  producerSearch.value = ''
}

async function createProducer() {
  if (!newProducerName.value.trim()) return
  isCreatingProducer.value = true
  try {
    const newProducer = await $fetch<{ id: number; name: string }>('/api/producers', {
      method: 'POST',
      body: { name: newProducerName.value.trim(), countryCode: 'FR' },
    })
    await refreshProducers()
    newAllocation.value.producerId = newProducer.id
    producerSearch.value = newProducer.name
    newProducerName.value = ''
    showNewProducer.value = false
  } catch (e) {
    console.error('Failed to create producer', e)
  } finally {
    isCreatingProducer.value = false
  }
}

// Get unique years for filter dropdown
const availableYears = computed(() => {
  if (!allocationsData.value?.allocations) return []
  const years = [...new Set(allocationsData.value.allocations.map((a: any) => a.year))]
  return years.sort((a, b) => b - a)
})

// Update URL when filters change
watch(
  [statusFilter, yearFilter, page],
  () => {
    router.replace({
      query: {
        ...(statusFilter.value && { status: statusFilter.value }),
        ...(yearFilter.value && { year: yearFilter.value }),
        ...(page.value > 1 && { page: page.value }),
      },
    })
  },
)

// Pagination
const totalPages = computed(() => Math.ceil((allocationsData.value?.total || 0) / limit))
const canPrev = computed(() => page.value > 1)
const canNext = computed(() => page.value < totalPages.value)

// Status colors
const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    upcoming: 'bg-muted-200 text-muted-700',
    to_claim: 'bg-primary-100 text-primary-700',
    on_the_way: 'bg-accent-100 text-accent-700',
    received: 'bg-secondary-100 text-secondary-700',
    cancelled: 'bg-red-100 text-red-700',
  }
  return colors[status] || colors.upcoming
}

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    upcoming: 'Upcoming',
    to_claim: 'To Claim',
    on_the_way: 'On the Way',
    received: 'Received',
    cancelled: 'Cancelled',
  }
  return labels[status] || status
}

const formatCurrency = (value: string | number | null, currency = 'EUR') => {
  if (!value) return '-'
  return new Intl.NumberFormat('en-EU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value))
}

const _formatDate = (date: string | Date | null) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

const formatMonth = (date: string | Date | null) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('en-GB', {
    month: 'long',
  })
}

// Month options for claim month dropdown
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const claimMonthOptions = computed(() => {
  const year = selectedAllocation.value?.year || new Date().getFullYear()
  return monthNames.map((name, index) => ({
    value: `${year}-${String(index + 1).padStart(2, '0')}`,
    label: name,
  }))
})

// Compute totals by currency
const totalsByCurrency = computed(() => {
  if (!selectedAllocation.value?.items?.length) return []
  const totals: Record<string, number> = {}
  for (const item of selectedAllocation.value.items) {
    const currency = item.currency || 'EUR'
    const value = item.quantityClaimed * Number(item.pricePerBottle || 0)
    totals[currency] = (totals[currency] || 0) + value
  }
  return Object.entries(totals).map(([currency, value]) => ({ currency, value }))
})

// Select allocation and fetch details
async function selectAllocation(allocation: any) {
  const details = await $fetch(`/api/allocations/${allocation.id}`)
  // Convert claimOpensAt to YYYY-MM format for month input
  if (details.claimOpensAt) {
    const date = new Date(details.claimOpensAt)
    details.claimOpensAt = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  }
  selectedAllocation.value = details
}

function closePanel() {
  selectedAllocation.value = null
}

// Create allocation
const newAllocation = ref({
  producerId: null as number | null,
  year: new Date().getFullYear(),
})

async function createAllocation() {
  if (!newAllocation.value.producerId) return

  try {
    const created = await $fetch('/api/allocations', {
      method: 'POST',
      body: newAllocation.value,
    })
    showAddModal.value = false
    newAllocation.value = { producerId: null, year: new Date().getFullYear() }
    showNewProducer.value = false
    newProducerName.value = ''
    producerSearch.value = ''
    await refreshAllocations()
    selectAllocation(created)
  } catch (e) {
    console.error('Failed to create allocation', e)
  }
}

// Update allocation
const isUpdating = ref(false)

async function updateAllocationStatus(status: string) {
  if (!selectedAllocation.value) return
  isUpdating.value = true
  try {
    await $fetch(`/api/allocations/${selectedAllocation.value.id}`, {
      method: 'PATCH',
      body: { status },
    })
    selectedAllocation.value.status = status
    await refreshAllocations()
  } catch (e) {
    console.error('Failed to update status', e)
  } finally {
    isUpdating.value = false
  }
}

async function updateClaimMonth(claimMonth: string | null) {
  if (!selectedAllocation.value) return
  isUpdating.value = true
  try {
    // Convert YYYY-MM to ISO datetime string
    const claimOpensAt = claimMonth ? new Date(`${claimMonth}-01T00:00:00Z`).toISOString() : null
    await $fetch(`/api/allocations/${selectedAllocation.value.id}`, {
      method: 'PATCH',
      body: { claimOpensAt },
    })
    await refreshAllocations()
  } catch (e) {
    console.error('Failed to update claim month', e)
  } finally {
    isUpdating.value = false
  }
}

// Delete allocation
const showDeleteConfirm = ref(false)

async function deleteAllocation() {
  if (!selectedAllocation.value) return
  isUpdating.value = true
  try {
    await $fetch(`/api/allocations/${selectedAllocation.value.id}`, { method: 'DELETE' })
    closePanel()
    await refreshAllocations()
  } catch (e) {
    console.error('Failed to delete allocation', e)
  } finally {
    isUpdating.value = false
    showDeleteConfirm.value = false
  }
}

// Navigate to linked year
async function goToLinkedYear(yearData: { id: number }) {
  const details = await $fetch(`/api/allocations/${yearData.id}`)
  // Convert claimOpensAt to YYYY-MM format for month input
  if (details.claimOpensAt) {
    const date = new Date(details.claimOpensAt)
    details.claimOpensAt = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  }
  selectedAllocation.value = details
}

// Receive allocation
const isReceiving = ref(false)

async function receiveAllocation() {
  if (!selectedAllocation.value) return
  isReceiving.value = true
  try {
    const result = await $fetch(`/api/allocations/${selectedAllocation.value.id}/receive`, {
      method: 'POST',
    })
    // Refresh the selected allocation
    const details = await $fetch(`/api/allocations/${selectedAllocation.value.id}`)
    selectedAllocation.value = details
    await refreshAllocations()
    alert(`Received! Created ${result.createdLots} inventory lots.${result.nextYearAllocation ? ' Next year allocation created.' : ''}`)
  } catch (e: any) {
    console.error('Failed to receive allocation', e)
    alert(e.data?.message || 'Failed to receive allocation')
  } finally {
    isReceiving.value = false
  }
}

// Item management
const { data: wines, refresh: refreshWines } = await useFetch('/api/wines')
const { data: formats } = await useFetch('/api/formats')

// Producer-filtered wines for Add Item modal
const producerWines = ref<any[]>([])
const otherWines = ref<any[]>([])

// Wine creation modal
const showAddWineModal = ref(false)

async function handleWineCreated(wineId: number) {
  await refreshWines()
  if (selectedAllocation.value?.producerId) {
    await fetchProducerWines(selectedAllocation.value.producerId)
  }
  newItem.value.wineId = wineId
}

async function fetchProducerWines(producerId: number) {
  try {
    const result = await $fetch<{ wines: any[] }>('/api/wines', {
      query: { producerId },
    })
    producerWines.value = result.wines
    // Other wines = all wines not from this producer
    otherWines.value = (wines.value?.wines || wines.value || []).filter(
      (w: any) => w.producerId !== producerId,
    )
  } catch (e) {
    console.error('Failed to fetch producer wines', e)
    producerWines.value = []
    otherWines.value = wines.value?.wines || wines.value || []
  }
}

const newItem = ref({
  wineId: null as number | null,
  formatId: 1,
  quantityClaimed: 0,
  pricePerBottle: '',
  currency: 'EUR' as 'EUR' | 'ZAR',
})

async function addItem() {
  if (!selectedAllocation.value || !newItem.value.wineId) return

  try {
    await $fetch(`/api/allocations/${selectedAllocation.value.id}/items`, {
      method: 'POST',
      body: newItem.value,
    })
    showAddItemModal.value = false
    newItem.value = { wineId: null, formatId: 1, quantityClaimed: 0, pricePerBottle: '', currency: 'EUR' }
    // Refresh allocation details
    const details = await $fetch(`/api/allocations/${selectedAllocation.value.id}`)
    selectedAllocation.value = details
  } catch (e) {
    console.error('Failed to add item', e)
  }
}

async function updateItem(item: any) {
  if (!selectedAllocation.value) return

  try {
    await $fetch(`/api/allocations/${selectedAllocation.value.id}/items/${item.id}`, {
      method: 'PATCH',
      body: {
        quantityClaimed: item.quantityClaimed,
        pricePerBottle: item.pricePerBottle,
        currency: item.currency,
      },
    })
    // Refresh allocation details
    const details = await $fetch(`/api/allocations/${selectedAllocation.value.id}`)
    selectedAllocation.value = details
    await refreshAllocations()
  } catch (e) {
    console.error('Failed to update item', e)
  }
}

async function deleteItem(itemId: number) {
  if (!selectedAllocation.value) return

  try {
    await $fetch(`/api/allocations/${selectedAllocation.value.id}/items/${itemId}`, {
      method: 'DELETE',
    })
    // Refresh allocation details
    const details = await $fetch(`/api/allocations/${selectedAllocation.value.id}`)
    selectedAllocation.value = details
    await refreshAllocations()
  } catch (e) {
    console.error('Failed to delete item', e)
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
    <div class="flex-1 min-w-0" :class="{ 'mr-96': selectedAllocation }">
      <!-- View tabs -->
      <div class="flex items-center justify-between mb-6">
        <div class="flex gap-1 bg-muted-100 p-1 rounded-lg">
          <button
            class="px-4 py-2 text-sm font-semibold rounded-md transition-colors"
            :class="viewTab === 'list'
              ? 'bg-white text-muted-900 shadow-sm'
              : 'text-muted-600 hover:text-muted-900'"
            @click="viewTab = 'list'"
          >
            List
          </button>
          <button
            class="px-4 py-2 text-sm font-semibold rounded-md transition-colors"
            :class="viewTab === 'timeline'
              ? 'bg-white text-muted-900 shadow-sm'
              : 'text-muted-600 hover:text-muted-900'"
            @click="viewTab = 'timeline'"
          >
            Timeline
          </button>
        </div>

        <!-- Add button (visible in both views) -->
        <button
          class="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 hover:scale-105 transition-transform"
          @click="showAddModal = true"
        >
          Add Allocation
        </button>
      </div>

      <!-- Timeline View -->
      <AllocationTimeline
        v-if="viewTab === 'timeline'"
        @select="(allocation) => selectAllocation(allocation)"
      />

      <!-- List View -->
      <div v-else>
      <!-- Toolbar -->
      <div class="flex items-center gap-4 mb-4">
        <!-- Year filter -->
        <select
          v-if="availableYears.length > 0"
          v-model="yearFilter"
          class="input text-sm w-32"
          @change="page = 1"
        >
          <option :value="undefined">All years</option>
          <option v-for="y in availableYears" :key="y" :value="y">
            {{ y }}
          </option>
        </select>
      </div>

      <!-- Status filter tabs -->
      <div class="flex gap-1 border-b border-muted-200 mb-4">
        <button
          v-for="tab in statusTabs"
          :key="tab.value"
          class="px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors"
          :class="statusFilter === tab.value
            ? 'text-primary-600 border-primary-600'
            : 'text-muted-500 border-transparent hover:text-muted-700 hover:border-muted-300'"
          @click="statusFilter = tab.value; page = 1"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Loading state -->
      <div v-if="pending" class="text-center py-12">
        <p class="text-muted-500">Loading allocations...</p>
      </div>

      <!-- Empty state -->
      <div v-else-if="!allocationsData?.allocations?.length" class="text-center py-12">
        <svg class="mx-auto h-12 w-12 text-muted-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <h3 class="mt-4 text-lg font-semibold text-muted-900">No allocations found</h3>
        <p class="mt-2 text-sm text-muted-500">
          Get started by adding your first allocation.
        </p>
      </div>

      <!-- Table -->
      <div v-else class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b border-muted-200">
              <th class="px-4 py-3 text-left text-xs font-semibold text-muted-500 uppercase tracking-wider">Producer</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-muted-500 uppercase tracking-wider">Year</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-muted-500 uppercase tracking-wider">Claim Month</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-muted-500 uppercase tracking-wider">Status</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-muted-500 uppercase tracking-wider">Items</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-muted-500 uppercase tracking-wider">Bottles</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-muted-500 uppercase tracking-wider">Value</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-muted-100">
            <tr
              v-for="allocation in allocationsData.allocations"
              :key="allocation.id"
              class="cursor-pointer transition-colors"
              :class="selectedAllocation?.id === allocation.id ? 'bg-primary-50' : 'hover:bg-muted-50'"
              @click="selectAllocation(allocation)"
            >
              <td class="px-4 py-3">
                <div class="text-sm font-semibold text-muted-900">{{ allocation.producerName }}</div>
                <div v-if="allocation.regionName" class="text-xs text-muted-500">{{ allocation.regionName }}</div>
              </td>
              <td class="px-4 py-3 text-sm text-muted-600">{{ allocation.year }}</td>
              <td class="px-4 py-3 text-sm text-muted-600">
                <span v-if="allocation.claimOpensAt">
                  {{ formatMonth(allocation.claimOpensAt) }}
                </span>
                <span v-else class="text-muted-400">-</span>
              </td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                  :class="getStatusColor(allocation.status)"
                >
                  {{ getStatusLabel(allocation.status) }}
                </span>
              </td>
              <td class="px-4 py-3 text-sm text-muted-600 text-right">{{ allocation.itemCount }}</td>
              <td class="px-4 py-3 text-sm text-muted-900 text-right font-semibold">{{ allocation.totalBottles }}</td>
              <td class="px-4 py-3 text-sm text-muted-900 text-right font-semibold">
                <template v-if="allocation.totalsByCurrency?.length">
                  <div v-for="total in allocation.totalsByCurrency" :key="total.currency">
                    {{ formatCurrency(total.value, total.currency) }}
                  </div>
                </template>
                <span v-else>-</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="allocationsData?.total" class="flex items-center justify-between mt-4 pt-4 border-t border-muted-200">
        <span class="text-sm text-muted-600">
          {{ allocationsData.totalAllocations }} allocation{{ allocationsData.totalAllocations === 1 ? '' : 's' }}
        </span>
        <div class="flex gap-2">
          <button
            class="px-3 py-1.5 text-sm font-semibold text-muted-700 bg-white border border-muted-300 rounded-md hover:bg-muted-50 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!canPrev"
            @click="page--"
          >
            Prev
          </button>
          <button
            class="px-3 py-1.5 text-sm font-semibold text-muted-700 bg-white border border-muted-300 rounded-md hover:bg-muted-50 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!canNext"
            @click="page++"
          >
            Next
          </button>
        </div>
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
        v-if="selectedAllocation"
        class="fixed right-0 top-0 h-full w-96 bg-white border-l-2 border-muted-200 overflow-y-auto z-20"
      >
        <!-- Panel Header -->
        <div class="sticky top-0 bg-white border-b border-muted-200 px-6 py-4 z-10">
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <h2 class="font-display font-bold text-xl text-muted-900 truncate">
                {{ selectedAllocation.producerName }}
              </h2>
              <p class="text-sm text-muted-500">{{ selectedAllocation.year }} Allocation</p>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <span
                class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                :class="getStatusColor(selectedAllocation.status)"
              >
                {{ getStatusLabel(selectedAllocation.status) }}
              </span>
              <button
                class="p-1.5 text-muted-400 hover:text-muted-600 rounded-lg hover:bg-muted-100"
                @click="closePanel"
              >
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Lifecycle links -->
          <div v-if="selectedAllocation.previousYear || selectedAllocation.nextYear" class="flex gap-2 mt-3">
            <button
              v-if="selectedAllocation.previousYear"
              class="text-sm text-primary-600 hover:text-primary-700 font-semibold"
              @click="goToLinkedYear(selectedAllocation.previousYear)"
            >
              ← {{ selectedAllocation.previousYear.year }}
            </button>
            <span v-if="selectedAllocation.previousYear && selectedAllocation.nextYear" class="text-muted-300">|</span>
            <button
              v-if="selectedAllocation.nextYear"
              class="text-sm text-primary-600 hover:text-primary-700 font-semibold"
              @click="goToLinkedYear(selectedAllocation.nextYear)"
            >
              {{ selectedAllocation.nextYear.year }} →
            </button>
          </div>
        </div>

        <!-- Section: Details -->
        <div class="px-6 py-5 bg-white">
          <div class="flex items-center gap-2.5 mb-4">
            <div class="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
              <svg class="w-4 h-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 class="font-display font-bold text-muted-900">Details</h3>
          </div>

          <dl class="space-y-3">
            <div class="flex justify-between items-center">
              <dt class="text-sm text-muted-500">Claim Month</dt>
              <dd>
                <select
                  v-model="selectedAllocation.claimOpensAt"
                  class="input w-36 text-sm py-1.5"
                  :disabled="isUpdating"
                  @change="updateClaimMonth(selectedAllocation.claimOpensAt)"
                >
                  <option :value="null">-</option>
                  <option v-for="m in claimMonthOptions" :key="m.value" :value="m.value">
                    {{ m.label }}
                  </option>
                </select>
              </dd>
            </div>
            <div class="flex justify-between items-center">
              <dt class="text-sm text-muted-500">Status</dt>
              <dd>
                <select
                  v-model="selectedAllocation.status"
                  class="input w-36 text-sm py-1.5"
                  :disabled="isUpdating"
                  @change="updateAllocationStatus(selectedAllocation.status)"
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="to_claim">To Claim</option>
                  <option value="on_the_way">On the Way</option>
                  <option value="received">Received</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </dd>
            </div>
          </dl>
        </div>

        <!-- Section: Items -->
        <div class="px-6 py-5 bg-muted-50">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-lg bg-secondary-100 flex items-center justify-center">
                <svg class="w-4 h-4 text-secondary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 class="font-display font-bold text-muted-900">Items</h3>
            </div>
            <button
              v-if="selectedAllocation.status !== 'received'"
              class="text-sm text-primary-600 hover:text-primary-700 font-semibold"
              @click="fetchProducerWines(selectedAllocation.producerId); showAddItemModal = true"
            >
              + Add Wine
            </button>
          </div>

          <div v-if="selectedAllocation.items?.length > 0" class="space-y-3">
            <div
              v-for="item in selectedAllocation.items"
              :key="item.id"
              class="p-3 bg-white rounded-xl border-2 border-muted-200"
            >
              <div class="flex items-start justify-between mb-2">
                <div>
                  <p class="text-sm font-semibold text-muted-900">{{ item.wineName }}</p>
                  <p class="text-xs text-muted-500">{{ item.formatName }}</p>
                </div>
                <button
                  v-if="selectedAllocation.status !== 'received'"
                  class="p-1 text-muted-400 hover:text-red-500"
                  @click="deleteItem(item.id)"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div class="flex gap-2">
                <div class="w-14">
                  <label class="block text-xs text-muted-500 mb-1">Qty</label>
                  <input
                    v-model.number="item.quantityClaimed"
                    type="number"
                    min="0"
                    class="input w-full text-sm py-1.5 text-center"
                    :disabled="selectedAllocation.status === 'received'"
                    @change="updateItem(item)"
                  >
                </div>
                <div class="w-20">
                  <label class="block text-xs text-muted-500 mb-1">Price</label>
                  <input
                    v-model="item.pricePerBottle"
                    type="number"
                    step="0.01"
                    min="0"
                    class="input w-full text-sm py-1.5 text-center"
                    :disabled="selectedAllocation.status === 'received'"
                    @change="updateItem(item)"
                  >
                </div>
                <div class="flex-1">
                  <label class="block text-xs text-muted-500 mb-1">&nbsp;</label>
                  <select
                    v-model="item.currency"
                    class="input w-full text-sm py-1.5"
                    :disabled="selectedAllocation.status === 'received'"
                    @change="updateItem(item)"
                  >
                    <option value="EUR">EUR</option>
                    <option value="ZAR">ZAR</option>
                  </select>
                </div>
              </div>
              <div class="mt-2 text-right text-sm font-semibold text-muted-700">
                {{ formatCurrency(item.quantityClaimed * Number(item.pricePerBottle || 0), item.currency) }}
              </div>
            </div>
          </div>
          <p v-else class="text-sm text-muted-500 text-center py-4">
            No wines added yet
          </p>

          <!-- Totals -->
          <div v-if="selectedAllocation.items?.length > 0" class="mt-4 pt-4 border-t border-muted-200">
            <div class="flex justify-between text-sm">
              <span class="text-muted-500">Total Bottles</span>
              <span class="font-semibold text-muted-900">{{ selectedAllocation.totalBottles }}</span>
            </div>
            <div v-for="total in totalsByCurrency" :key="total.currency" class="flex justify-between text-sm mt-1">
              <span class="text-muted-500">Total Value</span>
              <span class="font-semibold text-muted-900">{{ formatCurrency(total.value, total.currency) }}</span>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="px-6 py-5 bg-white border-t border-muted-200">
          <!-- Receive button -->
          <button
            v-if="selectedAllocation.status === 'on_the_way'"
            class="w-full px-4 py-2.5 mb-3 text-sm font-semibold text-white bg-secondary-600 rounded-xl hover:bg-secondary-700 disabled:opacity-50"
            :disabled="isReceiving || selectedAllocation.items?.length === 0"
            @click="receiveAllocation"
          >
            {{ isReceiving ? 'Receiving...' : 'Mark as Received' }}
          </button>

          <div v-if="!showDeleteConfirm">
            <button
              type="button"
              class="w-full px-4 py-2.5 text-sm font-semibold text-red-600 bg-red-50 rounded-xl border-2 border-red-200 hover:bg-red-100"
              @click="showDeleteConfirm = true"
            >
              Delete Allocation
            </button>
          </div>
          <div v-else class="p-4 bg-red-50 rounded-xl border-2 border-red-200">
            <p class="text-sm text-red-700 mb-3">Delete this allocation?</p>
            <div class="flex gap-2">
              <button
                type="button"
                class="flex-1 px-3 py-2 text-sm font-semibold text-muted-700 bg-white border-2 border-muted-300 rounded-xl hover:bg-muted-50"
                @click="showDeleteConfirm = false"
              >
                Cancel
              </button>
              <button
                type="button"
                class="flex-1 px-3 py-2 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50"
                :disabled="isUpdating"
                @click="deleteAllocation"
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
      v-if="selectedAllocation"
      class="fixed inset-0 bg-black/20 z-10 lg:hidden"
      @click="closePanel"
    />

    <!-- Add Allocation Modal -->
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
          v-if="showAddModal"
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div class="fixed inset-0 bg-muted-900/40 backdrop-blur-sm" @click="showAddModal = false; producerSearch = ''; showProducerDropdown = false" />
          <div class="relative bg-white rounded-2xl w-full max-w-md shadow-xl">
            <!-- Header -->
            <div class="flex items-center justify-between px-6 py-5 border-b border-muted-100">
              <h3 class="font-display font-bold text-xl text-muted-900">New Allocation</h3>
              <button
                class="p-1 text-muted-400 hover:text-muted-600 rounded-lg hover:bg-muted-100 transition-colors"
                @click="showAddModal = false; producerSearch = ''; showProducerDropdown = false"
              >
                <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <!-- Body -->
            <div class="px-6 py-5 space-y-5" @click="showProducerDropdown = false">
              <div @click.stop>
                <label class="block text-sm font-medium text-muted-700 mb-2">Producer <span class="text-red-500">*</span></label>
                <div v-if="showNewProducer" class="flex gap-2">
                  <input
                    v-model="newProducerName"
                    type="text"
                    class="input flex-1"
                    placeholder="New producer name"
                    @keydown.enter.prevent="createProducer"
                  >
                  <button
                    type="button"
                    class="px-2 text-green-600 hover:text-green-700 transition-transform hover:scale-105"
                    :disabled="isCreatingProducer"
                    @click="createProducer"
                  >
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    class="px-2 text-muted-400 hover:text-muted-600 transition-transform hover:scale-105"
                    @click="showNewProducer = false; newProducerName = ''"
                  >
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div v-else class="flex gap-2">
                  <div class="relative flex-1">
                    <div class="relative">
                      <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        v-model="producerSearch"
                        type="text"
                        class="input w-full pl-9 pr-8"
                        placeholder="Search producers..."
                        @focus="showProducerDropdown = true"
                        @blur="setTimeout(() => showProducerDropdown = false, 150)"
                        @input="showProducerDropdown = true; newAllocation.producerId = null"
                      >
                      <button
                        v-if="producerSearch"
                        type="button"
                        class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-400 hover:text-muted-600"
                        @click="clearProducerSelection"
                      >
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <!-- Dropdown -->
                    <div
                      v-if="showProducerDropdown && !newAllocation.producerId"
                      class="absolute z-10 mt-1 w-full bg-white border border-muted-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
                    >
                      <div v-if="filteredProducers.length === 0" class="px-4 py-3 text-sm text-muted-500">
                        No producers found
                      </div>
                      <button
                        v-for="producer in filteredProducers"
                        :key="producer.id"
                        type="button"
                        class="w-full px-4 py-2 text-left text-sm hover:bg-muted-50 focus:bg-muted-50 focus:outline-none"
                        @click="selectProducer(producer)"
                      >
                        <span class="font-medium text-muted-900">{{ producer.name }}</span>
                        <span v-if="producer.regionName" class="text-muted-500 ml-2">{{ producer.regionName }}</span>
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    class="px-2 text-primary-600 hover:text-primary-700 transition-transform hover:scale-105"
                    title="Add new producer"
                    @click="showNewProducer = true"
                  >
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-muted-700 mb-2">Year <span class="text-red-500">*</span></label>
                <input
                  v-model.number="newAllocation.year"
                  type="number"
                  min="2000"
                  max="2100"
                  class="input"
                  @focus="showProducerDropdown = false"
                >
              </div>
            </div>

            <!-- Footer -->
            <div class="flex items-center justify-between px-6 py-4 border-t border-muted-100">
              <button
                class="px-4 py-2.5 text-sm font-semibold text-muted-600 hover:text-muted-900 rounded-xl hover:bg-muted-100 transition-colors"
                @click="showAddModal = false; producerSearch = ''; showProducerDropdown = false"
              >
                Cancel
              </button>
              <button
                class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-secondary-500 rounded-xl hover:bg-secondary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="!newAllocation.producerId"
                @click="createAllocation"
              >
                Confirm
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Add Item Modal -->
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
          v-if="showAddItemModal"
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div class="fixed inset-0 bg-muted-900/40 backdrop-blur-sm" @click="showAddItemModal = false" />
          <div class="relative bg-white rounded-2xl w-full max-w-md shadow-xl">
            <!-- Header -->
            <div class="flex items-center justify-between px-6 py-5 border-b border-muted-100">
              <h3 class="font-display font-bold text-xl text-muted-900">Add Wine</h3>
              <button
                class="p-1 text-muted-400 hover:text-muted-600 rounded-lg hover:bg-muted-100 transition-colors"
                @click="showAddItemModal = false"
              >
                <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <!-- Body -->
            <div class="px-6 py-5 space-y-5">
              <div>
                <label class="block text-sm font-medium text-muted-700 mb-2">Wine <span class="text-red-500">*</span></label>
                <div class="flex gap-2">
                  <select v-model="newItem.wineId" class="input flex-1">
                    <option :value="null" disabled>Select a wine</option>
                    <optgroup v-if="producerWines.length > 0" :label="selectedAllocation?.producerName + ' wines'">
                      <option v-for="w in producerWines" :key="w.id" :value="w.id">
                        {{ w.name }}
                      </option>
                    </optgroup>
                    <optgroup v-if="otherWines.length > 0" label="Other wines">
                      <option v-for="w in otherWines" :key="w.id" :value="w.id">
                        {{ w.producerName }} - {{ w.name }}
                      </option>
                    </optgroup>
                  </select>
                  <button
                    type="button"
                    class="px-2 text-primary-600 hover:text-primary-700 transition-transform hover:scale-105"
                    title="Add new wine"
                    @click="showAddWineModal = true"
                  >
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-muted-700 mb-2">Format</label>
                <select v-model="newItem.formatId" class="input">
                  <option v-for="f in formats" :key="f.id" :value="f.id">
                    {{ f.name }}
                  </option>
                </select>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-muted-700 mb-2">Quantity</label>
                  <input v-model.number="newItem.quantityClaimed" type="number" min="0" class="input" >
                </div>
                <div>
                  <label class="block text-sm font-medium text-muted-700 mb-2">Price</label>
                  <div class="flex gap-2">
                    <input v-model="newItem.pricePerBottle" type="number" step="0.01" min="0" class="input flex-1" placeholder="0.00" >
                    <select v-model="newItem.currency" class="input w-20">
                      <option value="EUR">EUR</option>
                      <option value="ZAR">ZAR</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="flex items-center justify-between px-6 py-4 border-t border-muted-100">
              <button
                class="px-4 py-2.5 text-sm font-semibold text-muted-600 hover:text-muted-900 rounded-xl hover:bg-muted-100 transition-colors"
                @click="showAddItemModal = false"
              >
                Cancel
              </button>
              <button
                class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-secondary-500 rounded-xl hover:bg-secondary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="!newItem.wineId"
                @click="addItem"
              >
                Confirm
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Add Wine Modal -->
    <AddWineModal
      v-model="showAddWineModal"
      :default-producer="selectedAllocation?.producerName"
      wine-only
      @success="handleWineCreated"
    />
  </div>
</template>
