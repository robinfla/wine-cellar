<script setup lang="ts">
const { t } = useI18n()
interface TimelineAllocation {
  id: number
  producerName: string
  regionName: string | null
  status: string
  totalBottles: number
  totalValueEur: number
}

interface TimelineMonth {
  month: number
  monthName: string
  allocations: TimelineAllocation[]
  totals: {
    totalBottles: number
    totalValueEur: number
  }
}

interface TimelineData {
  year: number
  months: TimelineMonth[]
  yearTotals: {
    totalBottles: number
    totalValueEur: number
    allocationCount: number
  }
  availableYears: number[]
}

const emit = defineEmits<{
  select: [allocation: TimelineAllocation]
}>()

// Selected year state
const selectedYear = ref(new Date().getFullYear())

// Expanded months state (tracks which months are expanded)
const expandedMonths = ref<Set<number>>(new Set())

// Fetch timeline data
const { data: timelineData, pending } = await useFetch<TimelineData>('/api/allocations/timeline', {
  query: computed(() => ({
    year: selectedYear.value,
  })),
})

// Update available years when data loads and auto-expand months with allocations
watch(
  () => timelineData.value?.availableYears,
  (years) => {
    if (years && years.length > 0 && !years.includes(selectedYear.value)) {
      selectedYear.value = years[0]
    }
  },
  { immediate: true },
)

// Auto-expand months with allocations when data loads
watch(
  () => timelineData.value?.months,
  (months) => {
    if (months) {
      const monthsWithAllocations = months
        .filter(m => m.allocations.length > 0)
        .map(m => m.month)
      expandedMonths.value = new Set(monthsWithAllocations)
    }
  },
  { immediate: true },
)

// Toggle month expanded state
function toggleMonth(month: number) {
  if (expandedMonths.value.has(month)) {
    expandedMonths.value.delete(month)
  } else {
    expandedMonths.value.add(month)
  }
  // Trigger reactivity
  expandedMonths.value = new Set(expandedMonths.value)
}

function isExpanded(month: number): boolean {
  return expandedMonths.value.has(month)
}

// Expand/collapse all
function expandAll() {
  expandedMonths.value = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
}

function collapseAll() {
  expandedMonths.value = new Set()
}

// Status colors mapping
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
  const labels: Record<string, () => string> = {
    upcoming: () => t('allocations.upcoming'), // TODO: add i18n key
    to_claim: () => t('allocations.toClaim'), // TODO: add i18n key
    on_the_way: () => t('allocations.onTheWay'), // TODO: add i18n key
    received: () => t('allocations.received'), // TODO: add i18n key
    cancelled: () => t('allocations.cancelled'), // TODO: add i18n key
  }
  return labels[status]?.() || status
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-EU', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function selectAllocation(allocation: TimelineAllocation) {
  emit('select', allocation)
}
</script>

<template>
  <div>
    <!-- Header with year selector and totals -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-6">
      <div class="flex items-center gap-3 sm:gap-4">
        <h2 class="text-lg sm:text-xl font-display font-bold text-muted-900">
          {{ selectedYear }} {{ $t('allocations.timeline') }}
        </h2>
        <select
          v-model="selectedYear"
          class="input text-sm py-1.5 w-24 sm:w-28"
        >
          <option
            v-for="year in timelineData?.availableYears || [selectedYear]"
            :key="year"
            :value="year"
          >
            {{ year }}
          </option>
        </select>
      </div>

      <!-- Year summary -->
      <div v-if="timelineData?.yearTotals" class="flex flex-wrap items-center gap-2 sm:gap-4 text-sm text-muted-600">
        <span>
          <span class="font-semibold text-muted-900">{{ timelineData.yearTotals.allocationCount }}</span>
          <span class="hidden sm:inline"> {{ $t('allocations.allocationCount', { count: timelineData.yearTotals.allocationCount }) }}</span>
          <span class="sm:hidden"> {{ $t('allocations.allocShort') }}</span>
        </span>
        <span class="text-muted-300">|</span>
        <span>
          <span class="font-semibold text-muted-900">{{ timelineData.yearTotals.totalBottles }}</span>
          <span class="hidden sm:inline"> {{ $t('allocations.bottleCount', { count: timelineData.yearTotals.totalBottles }) }}</span>
          <span class="sm:hidden"> {{ $t('common.btl') }}</span>
        </span>
        <span class="text-muted-300">|</span>
        <span class="font-semibold text-muted-900">
          {{ formatCurrency(timelineData.yearTotals.totalValueEur) }}
        </span>
        <span class="text-muted-300 hidden sm:inline">|</span>
        <div class="flex gap-2 w-full sm:w-auto mt-1 sm:mt-0">
          <button
            class="text-primary-600 hover:text-primary-700 font-medium text-xs sm:text-sm"
            @click="expandAll"
          >
            {{ $t('allocations.expandAll') }}
          </button>
          <button
            class="text-primary-600 hover:text-primary-700 font-medium text-xs sm:text-sm"
            @click="collapseAll"
          >
            {{ $t('allocations.collapseAll') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="pending" class="text-center py-12">
      <p class="text-muted-500">{{ $t('allocations.loadingTimeline') }}</p>
    </div>

    <!-- Month cards -->
    <div v-else-if="timelineData" class="space-y-2">
      <div
        v-for="month in timelineData.months"
        :key="month.month"
        class="bg-white rounded-xl border-2 border-muted-200 overflow-hidden"
      >
        <!-- Month header (clickable) -->
        <button
          class="w-full flex items-center justify-between px-3 sm:px-4 py-3 text-left transition-colors"
          :class="[
            month.allocations.length > 0 ? 'hover:bg-muted-100' : 'hover:bg-muted-50',
            month.allocations.length > 0 && isExpanded(month.month) ? 'bg-muted-50 border-b border-muted-200' : 'bg-muted-50'
          ]"
          @click="toggleMonth(month.month)"
        >
          <div class="flex items-center gap-2 sm:gap-3">
            <!-- Chevron icon -->
            <svg
              class="w-4 h-4 text-muted-400 transition-transform duration-200 flex-shrink-0"
              :class="{ 'rotate-90': isExpanded(month.month) }"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
            <h3 class="font-display font-bold text-muted-900 text-sm sm:text-base">
              {{ month.monthName }}
            </h3>
            <!-- Allocation count badge -->
            <span
              v-if="month.allocations.length > 0"
              class="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full text-xs font-semibold bg-primary-100 text-primary-700"
            >
              {{ month.allocations.length }}
            </span>
          </div>
          <div v-if="month.allocations.length > 0" class="text-xs sm:text-sm text-muted-600">
            <span class="font-semibold text-muted-900">{{ month.totals.totalBottles }}</span>
            <span class="hidden sm:inline"> {{ $t('common.bottles') }}</span>
            <span class="sm:hidden"> {{ $t('common.btl') }}</span>
            <span class="mx-1 sm:mx-2 text-muted-300">|</span>
            <span class="font-semibold text-muted-900">{{ formatCurrency(month.totals.totalValueEur) }}</span>
          </div>
          <div v-else class="text-xs sm:text-sm text-muted-400">
            <span class="hidden sm:inline">{{ $t('allocations.noAllocations') }}</span>
            <span class="sm:hidden">-</span>
          </div>
        </button>

        <!-- Allocations list (collapsible) -->
        <Transition
          enter-active-class="transition-all duration-200 ease-out"
          enter-from-class="opacity-0 max-h-0"
          enter-to-class="opacity-100 max-h-[1000px]"
          leave-active-class="transition-all duration-150 ease-in"
          leave-from-class="opacity-100 max-h-[1000px]"
          leave-to-class="opacity-0 max-h-0"
        >
          <div v-if="month.allocations.length > 0 && isExpanded(month.month)" class="divide-y divide-muted-100 overflow-hidden">
            <div
              v-for="allocation in month.allocations"
              :key="allocation.id"
              class="flex flex-col sm:flex-row sm:items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 gap-1 sm:gap-3 cursor-pointer hover:bg-muted-50 transition-colors"
              @click.stop="selectAllocation(allocation)"
            >
              <div class="flex items-center gap-2 sm:gap-3">
                <span
                  class="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-md text-xs font-semibold flex-shrink-0"
                  :class="getStatusColor(allocation.status)"
                >
                  {{ getStatusLabel(allocation.status) }}
                </span>
                <div class="min-w-0">
                  <span class="font-semibold text-muted-900 text-sm sm:text-base">{{ allocation.producerName }}</span>
                  <span v-if="allocation.regionName" class="text-xs sm:text-sm text-muted-500 ml-1 sm:ml-2 hidden sm:inline">
                    {{ allocation.regionName }}
                  </span>
                </div>
              </div>
              <div class="text-right text-xs sm:text-sm flex-shrink-0 ml-auto sm:ml-0">
                <span class="text-muted-600">{{ allocation.totalBottles }} {{ $t('common.btl') }}</span>
                <span class="font-semibold text-muted-900 ml-2 sm:ml-3">
                  {{ formatCurrency(allocation.totalValueEur) }}
                </span>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>
