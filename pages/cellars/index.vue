<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

const { data: cellars, pending } = await useFetch('/api/cellars')
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Cellars</h1>
      <p class="mt-1 text-sm text-gray-600">
        Manage your wine storage locations
      </p>
    </div>

    <div v-if="pending" class="text-center py-12">
      <p class="text-gray-500">Loading cellars...</p>
    </div>

    <div v-else class="grid gap-4 sm:grid-cols-2">
      <div
        v-for="cellar in cellars"
        :key="cellar.id"
        class="card"
      >
        <div class="flex items-start justify-between">
          <div>
            <h3 class="text-lg font-medium text-gray-900">{{ cellar.name }}</h3>
            <p class="mt-1 text-sm text-gray-500">
              {{ cellar.countryCode }}
              <span v-if="cellar.isVirtual" class="ml-2 text-xs bg-gray-100 px-2 py-0.5 rounded">Virtual</span>
            </p>
          </div>
          <NuxtLink
            :to="`/inventory?cellar=${cellar.id}`"
            class="text-sm text-wine-600 hover:text-wine-700"
          >
            View wines
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>
