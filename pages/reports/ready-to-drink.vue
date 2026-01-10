<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

const statusFilter = ref<string>('')

const { data, pending, refresh } = await useFetch('/api/reports/ready-to-drink', {
  query: computed(() => ({
    status: statusFilter.value || undefined,
  })),
})

const statusOptions = [
  { value: '', label: 'Ready to drink (all)' },
  { value: 'peak', label: 'At peak' },
  { value: 'ready', label: 'Ready' },
  { value: 'approaching', label: 'Approaching' },
  { value: 'declining', label: 'Declining' },
  { value: 'too_early', label: 'Too early' },
  { value: 'past', label: 'Past prime' },
]

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    peak: 'bg-green-100 text-green-800',
    ready: 'bg-emerald-100 text-emerald-800',
    approaching: 'bg-blue-100 text-blue-800',
    declining: 'bg-amber-100 text-amber-800',
    too_early: 'bg-gray-100 text-gray-800',
    past: 'bg-red-100 text-red-800',
    unknown: 'bg-gray-100 text-gray-600',
  }
  return colors[status] || colors.unknown
}

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    peak: 'Peak',
    ready: 'Ready',
    approaching: 'Approaching',
    declining: 'Declining',
    too_early: 'Too Early',
    past: 'Past',
    unknown: 'Unknown',
  }
  return labels[status] || status
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Ready to Drink</h1>
        <p class="mt-1 text-sm text-gray-600">
          Wines currently in their optimal drinking window
        </p>
      </div>
    </div>

    <!-- Summary cards -->
    <div v-if="data?.summary" class="grid gap-4 sm:grid-cols-3 lg:grid-cols-6 mb-6">
      <div class="card text-center">
        <p class="text-2xl font-bold text-green-600">{{ data.summary.peak }}</p>
        <p class="text-xs text-gray-600">At Peak</p>
      </div>
      <div class="card text-center">
        <p class="text-2xl font-bold text-emerald-600">{{ data.summary.ready }}</p>
        <p class="text-xs text-gray-600">Ready</p>
      </div>
      <div class="card text-center">
        <p class="text-2xl font-bold text-blue-600">{{ data.summary.approaching }}</p>
        <p class="text-xs text-gray-600">Approaching</p>
      </div>
      <div class="card text-center">
        <p class="text-2xl font-bold text-amber-600">{{ data.summary.declining }}</p>
        <p class="text-xs text-gray-600">Declining</p>
      </div>
      <div class="card text-center">
        <p class="text-2xl font-bold text-gray-600">{{ data.summary.too_early }}</p>
        <p class="text-xs text-gray-600">Too Early</p>
      </div>
      <div class="card text-center">
        <p class="text-2xl font-bold text-red-600">{{ data.summary.past }}</p>
        <p class="text-xs text-gray-600">Past</p>
      </div>
    </div>

    <!-- Filter -->
    <div class="card mb-6">
      <div class="flex items-center gap-4">
        <label class="label mb-0">Filter:</label>
        <select v-model="statusFilter" class="input w-auto">
          <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="pending" class="text-center py-12">
      <p class="text-gray-500">Loading wines...</p>
    </div>

    <!-- Empty state -->
    <div v-else-if="!data?.lots?.length" class="card text-center py-12">
      <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <h3 class="mt-4 text-lg font-medium text-gray-900">No wines found</h3>
      <p class="mt-2 text-sm text-gray-500">
        {{ statusFilter ? 'No wines match this filter.' : 'Add wines with vintages to see maturity recommendations.' }}
      </p>
    </div>

    <!-- Wine list -->
    <div v-else class="space-y-4">
      <div
        v-for="lot in data.lots"
        :key="lot.id"
        class="card"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                :class="getStatusColor(lot.maturity.status)"
              >
                {{ getStatusLabel(lot.maturity.status) }}
              </span>
              <span v-if="lot.vintage" class="text-sm font-medium text-gray-700">
                {{ lot.vintage }}
              </span>
              <span class="text-xs text-gray-500">
                {{ lot.cellarName }}
              </span>
            </div>
            <h3 class="mt-1 text-base font-medium text-gray-900">
              {{ lot.wineName }}
            </h3>
            <p class="text-sm text-gray-600">
              {{ lot.producerName }}
              <span v-if="lot.appellationName"> · {{ lot.appellationName }}</span>
              <span v-else-if="lot.regionName"> · {{ lot.regionName }}</span>
            </p>
            <p class="mt-1 text-xs text-gray-500">
              {{ lot.maturity.message }}
              <span v-if="lot.maturity.drinkFrom && lot.maturity.drinkUntil">
                ({{ lot.maturity.drinkFrom }}-{{ lot.maturity.drinkUntil }})
              </span>
            </p>
          </div>
          <div class="text-right ml-4">
            <p class="text-2xl font-semibold text-gray-900">{{ lot.quantity }}</p>
            <p class="text-xs text-gray-500">bottles</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Total -->
    <div v-if="data?.total" class="mt-6 text-center text-sm text-gray-600">
      Showing {{ data.lots.length }} lots ({{ data.total }} bottles)
    </div>
  </div>
</template>
