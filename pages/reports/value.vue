<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

const { data: stats, pending } = await useFetch('/api/reports/stats')

const formatCurrency = (value: number, currency = 'EUR') => {
  return new Intl.NumberFormat('en-EU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
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

const getColorBarColor = (color: string) => {
  const colors: Record<string, string> = {
    red: 'bg-red-500',
    white: 'bg-amber-300',
    rose: 'bg-pink-400',
    sparkling: 'bg-yellow-400',
    dessert: 'bg-orange-400',
    fortified: 'bg-purple-500',
  }
  return colors[color] || 'bg-gray-400'
}

// Calculate percentages for charts
const maxBottlesByColor = computed(() => {
  if (!stats.value?.byColor) return 1
  return Math.max(...stats.value.byColor.map(c => Number(c.bottles)), 1)
})

const maxBottlesByRegion = computed(() => {
  if (!stats.value?.byRegion) return 1
  return Math.max(...stats.value.byRegion.map(r => Number(r.bottles)), 1)
})
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Cellar Value</h1>
      <p class="mt-1 text-sm text-gray-600">
        Overview of your wine collection value and distribution
      </p>
    </div>

    <div v-if="pending" class="text-center py-12">
      <p class="text-gray-500">Loading stats...</p>
    </div>

    <template v-else-if="stats">
      <!-- Summary cards -->
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div class="card">
          <p class="text-sm font-medium text-gray-500">Total Bottles</p>
          <p class="mt-1 text-3xl font-bold text-gray-900">{{ stats.totals.bottles }}</p>
        </div>
        <div class="card">
          <p class="text-sm font-medium text-gray-500">Total Lots</p>
          <p class="mt-1 text-3xl font-bold text-gray-900">{{ stats.totals.lots }}</p>
        </div>
        <div class="card">
          <p class="text-sm font-medium text-gray-500">Ready to Drink</p>
          <p class="mt-1 text-3xl font-bold text-green-600">{{ stats.readyToDrink }}</p>
        </div>
        <div class="card">
          <p class="text-sm font-medium text-gray-500">Purchase Value</p>
          <p class="mt-1 text-3xl font-bold text-wine-600">
            {{ formatCurrency(stats.totals.estimatedValue) }}
          </p>
          <p class="text-xs text-gray-500 mt-1">Based on purchase prices</p>
        </div>
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <!-- By Cellar -->
        <div class="card">
          <h2 class="text-lg font-medium text-gray-900 mb-4">By Cellar</h2>
          <div class="space-y-3">
            <div v-for="cellar in stats.byCellar" :key="cellar.cellarId">
              <div class="flex justify-between text-sm mb-1">
                <span class="font-medium">{{ cellar.cellarName }}</span>
                <span class="text-gray-600">{{ cellar.bottles }} bottles</span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2">
                <div
                  class="bg-wine-500 h-2 rounded-full transition-all"
                  :style="{ width: `${(Number(cellar.bottles) / stats.totals.bottles) * 100}%` }"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- By Color -->
        <div class="card">
          <h2 class="text-lg font-medium text-gray-900 mb-4">By Color</h2>
          <div class="space-y-3">
            <div v-for="item in stats.byColor" :key="item.color">
              <div class="flex justify-between text-sm mb-1">
                <span class="font-medium">{{ getColorLabel(item.color) }}</span>
                <span class="text-gray-600">{{ item.bottles }} bottles</span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2">
                <div
                  :class="getColorBarColor(item.color)"
                  class="h-2 rounded-full transition-all"
                  :style="{ width: `${(Number(item.bottles) / maxBottlesByColor) * 100}%` }"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- By Region -->
        <div class="card lg:col-span-2">
          <h2 class="text-lg font-medium text-gray-900 mb-4">Top Regions</h2>
          <div class="grid gap-3 sm:grid-cols-2">
            <div v-for="region in stats.byRegion" :key="region.regionId">
              <div class="flex justify-between text-sm mb-1">
                <span class="font-medium">
                  {{ region.regionName }}
                  <span class="text-gray-400 text-xs">({{ region.countryCode }})</span>
                </span>
                <span class="text-gray-600">{{ region.bottles }}</span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2">
                <div
                  class="bg-purple-500 h-2 rounded-full transition-all"
                  :style="{ width: `${(Number(region.bottles) / maxBottlesByRegion) * 100}%` }"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Maturity Breakdown -->
        <div class="card lg:col-span-2">
          <h2 class="text-lg font-medium text-gray-900 mb-4">Maturity Breakdown</h2>
          <div class="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <div class="text-center p-3 bg-gray-50 rounded-lg">
              <p class="text-2xl font-bold text-gray-600">{{ stats.maturity.too_early }}</p>
              <p class="text-xs text-gray-500">Too Early</p>
            </div>
            <div class="text-center p-3 bg-blue-50 rounded-lg">
              <p class="text-2xl font-bold text-blue-600">{{ stats.maturity.approaching }}</p>
              <p class="text-xs text-blue-600">Approaching</p>
            </div>
            <div class="text-center p-3 bg-emerald-50 rounded-lg">
              <p class="text-2xl font-bold text-emerald-600">{{ stats.maturity.ready }}</p>
              <p class="text-xs text-emerald-600">Ready</p>
            </div>
            <div class="text-center p-3 bg-green-50 rounded-lg">
              <p class="text-2xl font-bold text-green-600">{{ stats.maturity.peak }}</p>
              <p class="text-xs text-green-600">At Peak</p>
            </div>
            <div class="text-center p-3 bg-amber-50 rounded-lg">
              <p class="text-2xl font-bold text-amber-600">{{ stats.maturity.declining }}</p>
              <p class="text-xs text-amber-600">Declining</p>
            </div>
            <div class="text-center p-3 bg-red-50 rounded-lg">
              <p class="text-2xl font-bold text-red-600">{{ stats.maturity.past }}</p>
              <p class="text-xs text-red-600">Past</p>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Empty state -->
    <div v-else class="card text-center py-12">
      <p class="text-gray-500">No data available. Add wines to see your cellar stats.</p>
    </div>
  </div>
</template>
