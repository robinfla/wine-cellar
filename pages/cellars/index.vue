<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

const { data: cellars, pending, refresh } = await useFetch('/api/cellars')

const showCreateModal = ref(false)
const deletingId = ref<number | null>(null)
const deleteError = ref('')

async function deleteCellar(id: number) {
  deleteError.value = ''
  deletingId.value = id
  try {
    await $fetch(`/api/cellars/${id}`, { method: 'DELETE' })
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    deleteError.value = err.data?.message || 'Failed to delete cellar'
  } finally {
    deletingId.value = null
  }
}

async function handleCellarCreated() {
  await refresh()
}
</script>

<template>
  <div>
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-muted-900">Cellars</h1>
        <p class="mt-1 text-sm text-muted-600">
          Manage your wine storage locations
        </p>
      </div>
      <button
        class="btn-primary"
        @click="showCreateModal = true"
      >
        Add Cellar
      </button>
    </div>

    <div v-if="deleteError" class="mb-4 p-3 text-sm text-red-700 bg-red-50 rounded-lg">
      {{ deleteError }}
    </div>

    <div v-if="pending" class="text-center py-12">
      <p class="text-muted-500 font-medium">Loading cellars...</p>
    </div>

    <div v-else-if="!cellars?.length" class="text-center py-12">
      <svg class="mx-auto h-12 w-12 text-muted-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
      <h3 class="mt-4 text-lg font-semibold text-muted-900">No cellars yet</h3>
      <p class="mt-2 text-sm text-muted-500">Create your first cellar to start adding wines.</p>
      <button
        class="mt-4 btn-primary"
        @click="showCreateModal = true"
      >
        Create Cellar
      </button>
    </div>

    <div v-else class="grid gap-4 sm:grid-cols-2">
      <div
        v-for="cellar in cellars"
        :key="cellar.id"
        class="card-interactive"
      >
        <div class="flex items-start justify-between">
          <div>
            <h3 class="text-lg font-semibold text-muted-900">{{ cellar.name }}</h3>
            <p class="mt-1 text-sm text-muted-500">
              {{ cellar.countryCode }}
              <span v-if="cellar.isVirtual" class="ml-2 text-xs font-semibold bg-muted-200 text-muted-700 px-2 py-0.5 rounded">Virtual</span>
              <span class="ml-2 text-xs font-semibold bg-primary-100 text-primary-700 px-2 py-0.5 rounded">{{ cellar.bottleCount }} bottles</span>
            </p>
          </div>
          <div class="flex items-center gap-3">
            <NuxtLink
              :to="`/inventory?cellar=${cellar.id}`"
              class="text-sm font-semibold text-primary hover:text-primary-600 transition-colors"
            >
              View wines
            </NuxtLink>
            <button
              class="text-muted-400 hover:text-red-500 transition-colors"
              :disabled="deletingId === cellar.id"
              @click="deleteCellar(cellar.id)"
            >
              <svg v-if="deletingId === cellar.id" class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <svg v-else class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <CreateCellarModal
      v-model="showCreateModal"
      @created="handleCellarCreated"
    />
  </div>
</template>
