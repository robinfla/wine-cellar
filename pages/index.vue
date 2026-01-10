<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

const { user } = useAuth()

// Fetch real stats
const { data: statsData } = await useFetch('/api/reports/stats')

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-EU', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const stats = computed(() => [
  {
    name: 'Total Bottles',
    value: statsData.value?.totals?.bottles?.toString() || '0',
    change: `${statsData.value?.totals?.lots || 0} lots`,
  },
  {
    name: 'Ready to Drink',
    value: statsData.value?.readyToDrink?.toString() || '0',
    change: 'bottles',
  },
  {
    name: 'Purchase Value',
    value: formatCurrency(statsData.value?.totals?.estimatedValue || 0),
    change: '',
  },
])

const hasWines = computed(() => (statsData.value?.totals?.bottles || 0) > 0)
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900">
        Welcome back{{ user?.name ? `, ${user.name}` : '' }}
      </h1>
      <p class="mt-1 text-gray-600">
        Here's an overview of your wine cellar
      </p>
    </div>

    <!-- Stats grid -->
    <div class="grid gap-4 mb-8 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="stat in stats"
        :key="stat.name"
        class="card"
      >
        <p class="text-sm font-medium text-gray-500">{{ stat.name }}</p>
        <p class="mt-1 text-3xl font-semibold text-gray-900">{{ stat.value }}</p>
        <p v-if="stat.change" class="mt-1 text-sm text-gray-500">{{ stat.change }}</p>
      </div>
    </div>

    <!-- Quick actions -->
    <div class="mb-8">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <NuxtLink to="/inventory/add" class="card hover:border-wine-300 transition-colors">
          <div class="flex items-center">
            <div class="flex-shrink-0 p-2 bg-wine-100 rounded-lg">
              <svg class="w-6 h-6 text-wine-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div class="ml-4">
              <p class="text-sm font-medium text-gray-900">Add Wine</p>
              <p class="text-xs text-gray-500">Add bottles manually</p>
            </div>
          </div>
        </NuxtLink>

        <NuxtLink to="/inventory/import" class="card hover:border-wine-300 transition-colors">
          <div class="flex items-center">
            <div class="flex-shrink-0 p-2 bg-purple-100 rounded-lg">
              <svg class="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div class="ml-4">
              <p class="text-sm font-medium text-gray-900">Import CSV</p>
              <p class="text-xs text-gray-500">Bulk import inventory</p>
            </div>
          </div>
        </NuxtLink>

        <NuxtLink to="/reports/ready-to-drink" class="card hover:border-wine-300 transition-colors">
          <div class="flex items-center">
            <div class="flex-shrink-0 p-2 bg-green-100 rounded-lg">
              <svg class="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div class="ml-4">
              <p class="text-sm font-medium text-gray-900">Ready to Drink</p>
              <p class="text-xs text-gray-500">Wines in optimal window</p>
            </div>
          </div>
        </NuxtLink>

        <NuxtLink to="/reports/value" class="card hover:border-wine-300 transition-colors">
          <div class="flex items-center">
            <div class="flex-shrink-0 p-2 bg-amber-100 rounded-lg">
              <svg class="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div class="ml-4">
              <p class="text-sm font-medium text-gray-900">Cellar Value</p>
              <p class="text-xs text-gray-500">Track your investment</p>
            </div>
          </div>
        </NuxtLink>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="!hasWines" class="card text-center py-12">
      <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
      <h3 class="mt-4 text-lg font-medium text-gray-900">No wines yet</h3>
      <p class="mt-2 text-sm text-gray-500">
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

    <!-- Export button -->
    <div v-else class="mt-8 text-center">
      <a
        href="/api/inventory/export"
        download
        class="btn-secondary inline-flex items-center"
      >
        <svg class="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Export Inventory (CSV)
      </a>
    </div>
  </div>
</template>
