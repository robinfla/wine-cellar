<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

const { data: summary, refresh: refreshSummary } = await useFetch('/api/valuations/summary')
const { data: valuationsData, refresh: refreshValuations } = await useFetch('/api/valuations')

const isFetchingAll = ref(false)
const fetchProgress = ref<{ total: number; matched: number; needsReview: number; noMatch: number; errors: number } | null>(null)

const valuations = computed(() => valuationsData.value?.valuations || [])

const winesNeedingReview = computed(() =>
  valuations.value.filter((v: any) => v.status === 'needs_review')
)

const winesNoMatch = computed(() =>
  valuations.value.filter((v: any) => v.status === 'no_match')
)

const matchedWines = computed(() =>
  valuations.value.filter((v: any) => ['matched', 'confirmed', 'manual'].includes(v.status) && v.priceEstimate)
)

async function fetchAllValuations() {
  isFetchingAll.value = true
  fetchProgress.value = null
  try {
    const result = await $fetch<any>('/api/valuations/fetch-all', { method: 'POST' })
    fetchProgress.value = result
    await refreshSummary()
    await refreshValuations()
  } catch (e) {
    console.error('Failed to fetch all valuations:', e)
  } finally {
    isFetchingAll.value = false
  }
}

async function confirmValuation(id: number) {
  try {
    await $fetch(`/api/valuations/${id}/confirm`, { method: 'POST' })
    await refreshValuations()
    await refreshSummary()
  } catch (e) {
    console.error('Failed to confirm valuation:', e)
  }
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-EU', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const gainLossColor = computed(() => {
  if (!summary.value) return 'text-muted-600'
  return summary.value.gainLoss >= 0 ? 'text-green-600' : 'text-red-600'
})
</script>

<template>
  <div class="min-h-screen bg-muted-50">
    <!-- Header -->
    <div class="bg-white border-b border-muted-200">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="font-display font-bold text-2xl text-muted-900">Cellar Valuation</h1>
            <p class="text-sm text-muted-500 mt-1">Track your wine collection's market value</p>
          </div>
          <button
            class="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50"
            :disabled="isFetchingAll"
            @click="fetchAllValuations"
          >
            <svg v-if="isFetchingAll" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {{ isFetchingAll ? 'Fetching prices...' : 'Fetch All Prices' }}
          </button>
        </div>
      </div>
    </div>

    <div class="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <!-- Fetch Progress -->
      <div v-if="fetchProgress" class="mb-6 p-4 bg-white rounded-xl border-2 border-muted-200">
        <h3 class="font-semibold text-muted-900 mb-2">Fetch Complete</h3>
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
          <div>
            <span class="text-muted-500">Total</span>
            <p class="font-semibold">{{ fetchProgress.total }}</p>
          </div>
          <div>
            <span class="text-green-600">Matched</span>
            <p class="font-semibold text-green-600">{{ fetchProgress.matched }}</p>
          </div>
          <div>
            <span class="text-amber-600">Needs Review</span>
            <p class="font-semibold text-amber-600">{{ fetchProgress.needsReview }}</p>
          </div>
          <div>
            <span class="text-muted-500">No Match</span>
            <p class="font-semibold">{{ fetchProgress.noMatch }}</p>
          </div>
          <div>
            <span class="text-red-600">Errors</span>
            <p class="font-semibold text-red-600">{{ fetchProgress.errors }}</p>
          </div>
        </div>
      </div>

      <!-- Summary Cards -->
      <div v-if="summary" class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div class="bg-white p-6 rounded-xl border-2 border-muted-200">
          <p class="text-sm text-muted-500 mb-1">Total Value</p>
          <p class="text-3xl font-bold text-muted-900">{{ formatCurrency(summary.totalValue) }}</p>
          <p class="text-xs text-muted-400 mt-1">{{ summary.winesWithValuation }} wines valued</p>
        </div>
        <div class="bg-white p-6 rounded-xl border-2 border-muted-200">
          <p class="text-sm text-muted-500 mb-1">Purchase Cost</p>
          <p class="text-3xl font-bold text-muted-900">{{ formatCurrency(summary.totalCost) }}</p>
          <p class="text-xs text-muted-400 mt-1">{{ summary.totalBottles }} bottles</p>
        </div>
        <div class="bg-white p-6 rounded-xl border-2 border-muted-200">
          <p class="text-sm text-muted-500 mb-1">Gain / Loss</p>
          <p class="text-3xl font-bold" :class="gainLossColor">
            {{ summary.gainLoss >= 0 ? '+' : '' }}{{ formatCurrency(summary.gainLoss) }}
          </p>
          <p class="text-xs" :class="gainLossColor">
            {{ summary.gainLoss >= 0 ? '+' : '' }}{{ summary.gainLossPercent }}%
          </p>
        </div>
      </div>

      <!-- Needs Review Section -->
      <div v-if="winesNeedingReview.length > 0" class="mb-8">
        <div class="flex items-center gap-2 mb-4">
          <span class="w-2 h-2 rounded-full bg-amber-500" />
          <h2 class="font-display font-bold text-lg text-muted-900">
            Needs Review ({{ winesNeedingReview.length }})
          </h2>
        </div>
        <div class="bg-white rounded-xl border-2 border-muted-200 divide-y divide-muted-100">
          <div
            v-for="v in winesNeedingReview"
            :key="v.id"
            class="p-4 flex items-center justify-between"
          >
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-muted-900 truncate">
                {{ v.producerName }} {{ v.wineName }}
                <span v-if="v.vintage" class="text-muted-500 font-normal">{{ v.vintage }}</span>
              </p>
              <p class="text-xs text-muted-500 mt-0.5">
                Suggested: {{ v.sourceName }} ({{ Math.round(Number(v.confidence || 0) * 100) }}% match)
              </p>
            </div>
            <div class="flex items-center gap-4">
              <p class="text-lg font-bold text-muted-900">€{{ Number(v.priceEstimate).toFixed(0) }}</p>
              <div class="flex gap-2">
                <a
                  v-if="v.sourceUrl"
                  :href="v.sourceUrl"
                  target="_blank"
                  class="px-3 py-1.5 text-xs font-medium text-muted-600 hover:text-muted-800 border border-muted-200 rounded-lg hover:bg-muted-50"
                >
                  View
                </a>
                <button
                  class="px-3 py-1.5 text-xs font-medium text-white bg-secondary-500 rounded-lg hover:bg-secondary-600"
                  @click="confirmValuation(v.id)"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- No Match Section -->
      <div v-if="winesNoMatch.length > 0" class="mb-8">
        <div class="flex items-center gap-2 mb-4">
          <span class="w-2 h-2 rounded-full bg-muted-400" />
          <h2 class="font-display font-bold text-lg text-muted-900">
            No Match Found ({{ winesNoMatch.length }})
          </h2>
        </div>
        <div class="bg-white rounded-xl border-2 border-muted-200 divide-y divide-muted-100">
          <div
            v-for="v in winesNoMatch"
            :key="v.id"
            class="p-4 flex items-center justify-between"
          >
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-muted-900 truncate">
                {{ v.producerName }} {{ v.wineName }}
                <span v-if="v.vintage" class="text-muted-500 font-normal">{{ v.vintage }}</span>
              </p>
            </div>
            <span class="text-xs text-muted-400">Manual entry required</span>
          </div>
        </div>
      </div>

      <!-- Matched Wines Table -->
      <div v-if="matchedWines.length > 0">
        <div class="flex items-center gap-2 mb-4">
          <span class="w-2 h-2 rounded-full bg-green-500" />
          <h2 class="font-display font-bold text-lg text-muted-900">
            Valued Wines ({{ matchedWines.length }})
          </h2>
        </div>
        <div class="bg-white rounded-xl border-2 border-muted-200 overflow-hidden">
          <table class="w-full">
            <thead class="bg-muted-50 border-b border-muted-200">
              <tr>
                <th class="text-left text-xs font-semibold text-muted-500 uppercase tracking-wide px-4 py-3">Wine</th>
                <th class="text-right text-xs font-semibold text-muted-500 uppercase tracking-wide px-4 py-3">Vintage</th>
                <th class="text-right text-xs font-semibold text-muted-500 uppercase tracking-wide px-4 py-3">Value</th>
                <th class="text-right text-xs font-semibold text-muted-500 uppercase tracking-wide px-4 py-3">Source</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-muted-100">
              <tr v-for="v in matchedWines" :key="v.id">
                <td class="px-4 py-3">
                  <p class="font-medium text-muted-900">{{ v.wineName }}</p>
                  <p class="text-xs text-muted-500">{{ v.producerName }}</p>
                </td>
                <td class="px-4 py-3 text-right text-sm text-muted-600">
                  {{ v.vintage || 'NV' }}
                </td>
                <td class="px-4 py-3 text-right">
                  <span class="font-semibold text-muted-900">€{{ Number(v.priceEstimate).toFixed(0) }}</span>
                </td>
                <td class="px-4 py-3 text-right">
                  <a
                    v-if="v.sourceUrl"
                    :href="v.sourceUrl"
                    target="_blank"
                    class="text-xs text-primary-600 hover:text-primary-700"
                  >
                    {{ v.source === 'vivino' ? 'Vivino' : v.source }}
                  </a>
                  <span v-else class="text-xs text-muted-400">{{ v.source || '—' }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="valuations.length === 0" class="text-center py-16">
        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-muted-100 flex items-center justify-center">
          <svg class="w-8 h-8 text-muted-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 class="font-display font-bold text-lg text-muted-900 mb-2">No valuations yet</h3>
        <p class="text-muted-500 mb-4">Click "Fetch All Prices" to get market valuations for your wines.</p>
      </div>
    </div>
  </div>
</template>
