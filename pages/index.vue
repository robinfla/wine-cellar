<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

const { user } = useAuth()

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
  const data = statsData.value.byRegion.slice(0, 6)
  const total = data.reduce((sum, r) => sum + Number(r.bottles), 0)
  const max = Math.max(...data.map(item => Number(item.bottles)))
  return data.map((item, i) => ({
    label: item.regionName,
    color: regionColors[i % regionColors.length],
    bottles: Number(item.bottles),
    percent: Math.round((Number(item.bottles) / total) * 100),
    width: (Number(item.bottles) / max) * 100,
  }))
})

const vintageChartData = computed(() => {
  if (!statsData.value?.byVintage) return []
  const total = statsData.value.byVintage.reduce((sum, v) => sum + Number(v.bottles), 0)
  const max = Math.max(...statsData.value.byVintage.map(item => Number(item.bottles)))
  return statsData.value.byVintage.map((item, i) => ({
    label: String(item.vintage),
    color: vintageColors[i % vintageColors.length],
    bottles: Number(item.bottles),
    percent: Math.round((Number(item.bottles) / total) * 100),
    width: (Number(item.bottles) / max) * 100,
  }))
})

const grapeChartData = computed(() => {
  if (!statsData.value?.byGrape) return []
  const total = statsData.value.byGrape.reduce((sum, g) => sum + Number(g.bottles), 0)
  const max = Math.max(...statsData.value.byGrape.map(item => Number(item.bottles)))
  return statsData.value.byGrape.map((item, i) => ({
    label: item.grapeName,
    color: grapeColors[i % grapeColors.length],
    bottles: Number(item.bottles),
    percent: Math.round((Number(item.bottles) / total) * 100),
    width: (Number(item.bottles) / max) * 100,
  }))
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
      </div>
    </template>
  </div>
</template>
