<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

const reports = [
  {
    name: 'Ready to Drink',
    description: 'Wines currently in their optimal drinking window',
    path: '/reports/ready-to-drink',
    icon: 'check-circle',
    color: 'green',
  },
  {
    name: 'Cellar Value',
    description: 'Track the estimated value of your collection',
    path: '/reports/value',
    icon: 'currency',
    color: 'amber',
  },
  {
    name: 'Maturity Timeline',
    description: 'See when your wines will be ready',
    path: '/reports/maturity',
    icon: 'clock',
    color: 'blue',
  },
]
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Reports</h1>
      <p class="mt-1 text-sm text-gray-600">
        Insights and analytics for your wine collection
      </p>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="report in reports"
        :key="report.path"
        :to="report.path"
        class="card hover:border-wine-300 transition-colors"
      >
        <h3 class="text-lg font-medium text-gray-900">{{ report.name }}</h3>
        <p class="mt-1 text-sm text-gray-500">{{ report.description }}</p>
      </NuxtLink>
    </div>
  </div>
</template>
