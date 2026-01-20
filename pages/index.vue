<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

const { user } = useAuth()

// Fetch real stats
const { data: statsData, pending } = await useFetch('/api/reports/stats')

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-EU', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const hasWines = computed(() => (statsData.value?.totals?.bottles || 0) > 0)

// Color helpers
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

// Chart color palettes - using flat design colors
const cellarColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']
const regionColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']
const vintageColors = ['#8B5CF6', '#A855F7', '#C084FC', '#D8B4FE', '#E9D5FF']
const grapeColors = ['#10B981', '#34D399', '#6EE7B7', '#A7F3D0', '#D1FAE5']

// Compute pie chart segments
const colorChartData = computed(() => {
  if (!statsData.value?.byColor) return []
  const total = statsData.value.totals.bottles
  let offset = 0
  return statsData.value.byColor.map((item) => {
    const percent = (Number(item.bottles) / total) * 100
    const segment = {
      label: getColorLabel(item.color),
      color: getColorHex(item.color),
      bottles: item.bottles,
      percent: Math.round(percent),
      dashArray: `${percent} ${100 - percent}`,
      offset: -offset,
    }
    offset += percent
    return segment
  })
})

const cellarChartData = computed(() => {
  if (!statsData.value?.byCellar) return []
  const total = statsData.value.totals.bottles
  let offset = 0
  return statsData.value.byCellar.map((item, i) => {
    const percent = (Number(item.bottles) / total) * 100
    const segment = {
      label: item.cellarName,
      color: cellarColors[i % cellarColors.length],
      bottles: item.bottles,
      percent: Math.round(percent),
      dashArray: `${percent} ${100 - percent}`,
      offset: -offset,
    }
    offset += percent
    return segment
  })
})

const regionChartData = computed(() => {
  if (!statsData.value?.byRegion) return []
  const total = statsData.value.byRegion.reduce((sum, r) => sum + Number(r.bottles), 0)
  let offset = 0
  return statsData.value.byRegion.slice(0, 8).map((item, i) => {
    const percent = (Number(item.bottles) / total) * 100
    const segment = {
      label: item.regionName,
      color: regionColors[i % regionColors.length],
      bottles: item.bottles,
      percent: Math.round(percent),
      dashArray: `${percent} ${100 - percent}`,
      offset: -offset,
    }
    offset += percent
    return segment
  })
})

const vintageChartData = computed(() => {
  if (!statsData.value?.byVintage) return []
  const total = statsData.value.byVintage.reduce((sum, v) => sum + Number(v.bottles), 0)
  let offset = 0
  return statsData.value.byVintage.map((item, i) => {
    const percent = (Number(item.bottles) / total) * 100
    const segment = {
      label: String(item.vintage),
      color: vintageColors[i % vintageColors.length],
      bottles: item.bottles,
      percent: Math.round(percent),
      dashArray: `${percent} ${100 - percent}`,
      offset: -offset,
    }
    offset += percent
    return segment
  })
})

const grapeChartData = computed(() => {
  if (!statsData.value?.byGrape) return []
  const total = statsData.value.byGrape.reduce((sum, g) => sum + Number(g.bottles), 0)
  let offset = 0
  return statsData.value.byGrape.map((item, i) => {
    const percent = (Number(item.bottles) / total) * 100
    const segment = {
      label: item.grapeName,
      color: grapeColors[i % grapeColors.length],
      bottles: item.bottles,
      percent: Math.round(percent),
      dashArray: `${percent} ${100 - percent}`,
      offset: -offset,
    }
    offset += percent
    return segment
  })
})
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

      <!-- Charts grid -->
      <div class="grid gap-6 lg:grid-cols-2 mb-6">
        <!-- By Cellar -->
        <div class="card">
          <h2 class="text-lg font-semibold text-muted-900 mb-4">By Cellar</h2>
          <div class="flex items-center gap-6">
            <svg viewBox="0 0 36 36" class="w-32 h-32 flex-shrink-0">
              <circle
                v-for="(segment, i) in cellarChartData"
                :key="i"
                cx="18"
                cy="18"
                r="15.9"
                fill="none"
                :stroke="segment.color"
                stroke-width="3.5"
                :stroke-dasharray="segment.dashArray"
                :stroke-dashoffset="segment.offset"
                transform="rotate(-90 18 18)"
              />
            </svg>
            <div class="flex flex-col gap-2">
              <div v-for="item in cellarChartData" :key="item.label" class="flex items-center gap-2 text-sm">
                <span class="w-3 h-3 rounded-full flex-shrink-0" :style="{ backgroundColor: item.color }" />
                <span class="text-muted-700 font-medium">{{ item.label }}</span>
                <span class="text-muted-500">({{ item.percent }}%)</span>
              </div>
            </div>
          </div>
        </div>

        <!-- By Color -->
        <div class="card">
          <h2 class="text-lg font-semibold text-muted-900 mb-4">By Color</h2>
          <div class="flex items-center gap-6">
            <svg viewBox="0 0 36 36" class="w-32 h-32 flex-shrink-0">
              <circle
                v-for="(segment, i) in colorChartData"
                :key="i"
                cx="18"
                cy="18"
                r="15.9"
                fill="none"
                :stroke="segment.color"
                stroke-width="3.5"
                :stroke-dasharray="segment.dashArray"
                :stroke-dashoffset="segment.offset"
                transform="rotate(-90 18 18)"
              />
            </svg>
            <div class="flex flex-col gap-2">
              <div v-for="item in colorChartData" :key="item.label" class="flex items-center gap-2 text-sm">
                <span class="w-3 h-3 rounded-full flex-shrink-0" :style="{ backgroundColor: item.color }" />
                <span class="text-muted-700 font-medium">{{ item.label }}</span>
                <span class="text-muted-500">({{ item.percent }}%)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- By Region (full width) -->
      <div class="card">
        <h2 class="text-lg font-semibold text-muted-900 mb-4">By Region</h2>
        <div class="flex flex-col sm:flex-row items-center gap-6">
          <svg viewBox="0 0 36 36" class="w-40 h-40 flex-shrink-0">
            <circle
              v-for="(segment, i) in regionChartData"
              :key="i"
              cx="18"
              cy="18"
              r="15.9"
              fill="none"
              :stroke="segment.color"
              stroke-width="3.5"
              :stroke-dasharray="segment.dashArray"
              :stroke-dashoffset="segment.offset"
              transform="rotate(-90 18 18)"
            />
          </svg>
          <div class="flex flex-wrap gap-x-6 gap-y-2">
            <div v-for="item in regionChartData" :key="item.label" class="flex items-center gap-2 text-sm">
              <span class="w-3 h-3 rounded-full flex-shrink-0" :style="{ backgroundColor: item.color }" />
              <span class="text-muted-700 font-medium">{{ item.label }}</span>
              <span class="text-muted-500">({{ item.bottles }})</span>
            </div>
          </div>
        </div>
      </div>

      <!-- By Vintage and By Grape -->
      <div class="grid gap-6 lg:grid-cols-2 mt-6">
        <!-- By Vintage (Top 5) -->
        <div v-if="vintageChartData.length > 0" class="card">
          <h2 class="text-lg font-semibold text-muted-900 mb-4">Top 5 Vintages</h2>
          <div class="flex items-center gap-6">
            <svg viewBox="0 0 36 36" class="w-32 h-32 flex-shrink-0">
              <circle
                v-for="(segment, i) in vintageChartData"
                :key="i"
                cx="18"
                cy="18"
                r="15.9"
                fill="none"
                :stroke="segment.color"
                stroke-width="3.5"
                :stroke-dasharray="segment.dashArray"
                :stroke-dashoffset="segment.offset"
                transform="rotate(-90 18 18)"
              />
            </svg>
            <div class="flex flex-col gap-2">
              <div v-for="item in vintageChartData" :key="item.label" class="flex items-center gap-2 text-sm">
                <span class="w-3 h-3 rounded-full flex-shrink-0" :style="{ backgroundColor: item.color }" />
                <span class="text-muted-700 font-medium">{{ item.label }}</span>
                <span class="text-muted-500">({{ item.bottles }} bottles)</span>
              </div>
            </div>
          </div>
        </div>

        <!-- By Grape (Top 5) -->
        <div v-if="grapeChartData.length > 0" class="card">
          <h2 class="text-lg font-semibold text-muted-900 mb-4">Top 5 Grape Varieties</h2>
          <div class="flex items-center gap-6">
            <svg viewBox="0 0 36 36" class="w-32 h-32 flex-shrink-0">
              <circle
                v-for="(segment, i) in grapeChartData"
                :key="i"
                cx="18"
                cy="18"
                r="15.9"
                fill="none"
                :stroke="segment.color"
                stroke-width="3.5"
                :stroke-dasharray="segment.dashArray"
                :stroke-dashoffset="segment.offset"
                transform="rotate(-90 18 18)"
              />
            </svg>
            <div class="flex flex-col gap-2">
              <div v-for="item in grapeChartData" :key="item.label" class="flex items-center gap-2 text-sm">
                <span class="w-3 h-3 rounded-full flex-shrink-0" :style="{ backgroundColor: item.color }" />
                <span class="text-muted-700 font-medium">{{ item.label }}</span>
                <span class="text-muted-500">({{ item.bottles }} bottles)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
