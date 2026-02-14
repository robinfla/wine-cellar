<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

const { t } = useI18n({ useScope: 'global' })
const route = useRoute()
const router = useRouter()

// Filter state
const eventTypeFilter = ref(route.query.type as string || '')

// Pagination
const page = ref(route.query.page ? Number(route.query.page) : 1)
const limit = 50

// Fetch events
const { data: eventsData, pending } = await useFetch('/api/inventory/events', {
  query: computed(() => ({
    eventType: eventTypeFilter.value || undefined,
    limit,
    offset: (page.value - 1) * limit,
  })),
})

// Update URL when filters change
watch(
  [eventTypeFilter, page],
  () => {
    router.replace({
      query: {
        ...(eventTypeFilter.value && { type: eventTypeFilter.value }),
        ...(page.value > 1 && { page: page.value }),
      },
    })
  },
)

// Event type tabs
const eventTypeTabs = computed(() => [
  { value: '', label: t('history.all') },
  { value: 'purchase', label: t('history.added') },
  { value: 'consume', label: t('history.consumed') },
  { value: 'gift', label: t('history.gift') },
  { value: 'transfer', label: t('history.transfer') },
  { value: 'adjustment', label: t('history.adjustment') },
  { value: 'loss', label: t('history.loss') },
])

const getEventLabel = (type: string) => {
  const keyMap: Record<string, string> = {
    purchase: 'history.added',
    consume: 'history.consumed',
    gift: 'history.gift',
    transfer: 'history.transfer',
    adjustment: 'history.adjustment',
    loss: 'history.loss',
  }
  return keyMap[type] ? t(keyMap[type]) : type
}

const getEventBadgeClasses = (type: string) => {
  const classes: Record<string, string> = {
    purchase: 'bg-secondary-100 text-secondary-700',
    consume: 'bg-primary-100 text-primary-700',
    gift: 'bg-purple-100 text-purple-700',
    transfer: 'bg-blue-100 text-blue-700',
    adjustment: 'bg-muted-200 text-muted-700',
    loss: 'bg-red-100 text-red-700',
  }
  return classes[type] || 'bg-muted-200 text-muted-700'
}

const getQuantityPrefix = (change: number) => {
  return change > 0 ? '+' : ''
}

const getQuantityClasses = (change: number) => {
  return change > 0
    ? 'text-secondary-600'
    : 'text-red-600'
}

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

const formatDate = (date: string | Date | null) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const formatTime = (date: string | Date | null) => {
  if (!date) return ''
  return new Date(date).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Pagination
const totalPages = computed(() => Math.ceil((eventsData.value?.total || 0) / limit))
const canPrev = computed(() => page.value > 1)
const canNext = computed(() => page.value < totalPages.value)

// Group events by month
const formatMonthKey = (date: string | Date | null) => {
  if (!date) return 'unknown'
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const formatMonthLabel = (key: string) => {
  if (key === 'unknown') return 'Unknown'
  const [year, month] = key.split('-')
  const d = new Date(Number(year), Number(month) - 1)
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

const groupedEvents = computed(() => {
  const events = eventsData.value?.events || []
  const groups: { key: string; label: string; events: typeof events }[] = []
  let currentKey = ''

  for (const evt of events) {
    const key = formatMonthKey(evt.eventDate)
    if (key !== currentKey) {
      currentKey = key
      groups.push({ key, label: formatMonthLabel(key), events: [] })
    }
    groups[groups.length - 1].events.push(evt)
  }

  return groups
})
</script>

<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <div>
        <h1 class="text-2xl font-bold text-muted-900">{{ $t('history.title') }}</h1>
        <p class="mt-1 text-sm text-muted-500">{{ $t('history.subtitle') }}</p>
      </div>
    </div>

    <!-- Event type tabs -->
    <div class="flex gap-1 border-b border-muted-200 mb-4 overflow-x-auto">
      <button
        v-for="tab in eventTypeTabs"
        :key="tab.value"
        class="px-3 sm:px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap"
        :class="eventTypeFilter === tab.value
          ? 'text-primary-600 border-primary-600'
          : 'text-muted-500 border-transparent hover:text-muted-700 hover:border-muted-300'"
        @click="eventTypeFilter = tab.value; page = 1"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Loading state -->
    <div v-if="pending" class="text-center py-12">
      <p class="text-muted-500">{{ $t('history.loadingHistory') }}</p>
    </div>

    <!-- Empty state -->
    <div v-else-if="!eventsData?.events?.length" class="text-center py-12">
      <svg class="mx-auto h-12 w-12 text-muted-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <h3 class="mt-4 text-lg font-semibold text-muted-900">{{ $t('history.noActivity') }}</h3>
      <p class="mt-2 text-sm text-muted-500">
        {{ eventTypeFilter ? $t('history.noEventsFilter') : $t('history.noEventsEmpty') }}
      </p>
    </div>

    <!-- Events list grouped by month -->
    <div v-else class="space-y-6">
      <div v-for="group in groupedEvents" :key="group.key">
        <!-- Month subheader -->
        <h2 class="text-sm font-bold text-muted-700 uppercase tracking-wide mb-2 px-1">
          {{ group.label }}
        </h2>
        <div class="space-y-2">
          <div
            v-for="evt in group.events"
            :key="evt.id"
            class="flex items-start sm:items-center gap-3 sm:gap-4 px-4 py-3 bg-white border border-muted-200 rounded-lg hover:border-muted-300 transition-colors"
          >
            <!-- Color dot -->
            <span
              class="w-3 h-3 rounded-full flex-shrink-0 mt-1 sm:mt-0"
              :class="getColorDot(evt.wineColor)"
            />

            <!-- Wine info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-sm font-semibold text-muted-900 truncate">{{ evt.wineName }}</span>
                <span v-if="evt.vintage" class="text-xs text-muted-500">{{ evt.vintage }}</span>
              </div>
              <div class="text-xs text-muted-500 truncate">
                {{ evt.producerName }} · {{ evt.cellarName }}
              </div>
              <div v-if="evt.notes" class="text-xs text-muted-400 mt-0.5 truncate">
                {{ evt.notes }}
              </div>
              <!-- Date on mobile -->
              <div class="text-xs text-muted-400 mt-1 sm:hidden">
                {{ formatDate(evt.eventDate) }} · {{ formatTime(evt.eventDate) }}
              </div>
            </div>

            <!-- Quantity change -->
            <div class="flex-shrink-0 text-right">
              <span
                class="text-sm font-bold"
                :class="getQuantityClasses(evt.quantityChange)"
              >
                {{ getQuantityPrefix(evt.quantityChange) }}{{ evt.quantityChange }}
              </span>
              <span class="text-xs text-muted-400 ml-1">{{ $t('common.btl') }}</span>
            </div>

            <!-- Event type badge -->
            <span
              class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0"
              :class="getEventBadgeClasses(evt.eventType)"
            >
              {{ getEventLabel(evt.eventType) }}
            </span>

            <!-- Date on desktop -->
            <div class="flex-shrink-0 text-right hidden sm:block w-24">
              <div class="text-xs text-muted-600">{{ formatDate(evt.eventDate) }}</div>
              <div class="text-xs text-muted-400">{{ formatTime(evt.eventDate) }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="eventsData?.total" class="flex items-center justify-between mt-4 pt-4 border-t border-muted-200">
      <span class="text-sm text-muted-600">
        {{ (page - 1) * limit + 1 }}-{{ Math.min(page * limit, eventsData.total) }} {{ $t('common.of') }} {{ eventsData.total }} {{ $t('common.events') }}
      </span>
      <div class="flex gap-2">
        <button
          class="px-3 py-1.5 text-sm font-semibold text-muted-700 bg-white border border-muted-300 rounded-md hover:bg-muted-50 hover:scale-102 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="!canPrev"
          @click="page--"
        >
          {{ $t('common.prev') }}
        </button>
        <button
          class="px-3 py-1.5 text-sm font-semibold text-muted-700 bg-white border border-muted-300 rounded-md hover:bg-muted-50 hover:scale-102 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="!canNext"
          @click="page++"
        >
          {{ $t('common.next') }}
        </button>
      </div>
    </div>
  </div>
</template>
