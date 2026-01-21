<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

interface Producer {
  id: number
  name: string
  regionId: number | null
  regionName: string | null
  website: string | null
  notes: string | null
  bottleCount: number
  createdAt: string
}

const router = useRouter()

const searchQuery = ref('')
const searchDebounce = ref<ReturnType<typeof setTimeout> | null>(null)
const debouncedSearch = ref('')

const selectedProducer = ref<Producer | null>(null)
const showAddModal = ref(false)

const editingField = ref<string | null>(null)
const editValues = ref({
  name: '',
  regionId: null as number | null,
  website: '',
  notes: '',
})
const isUpdating = ref(false)
const showDeleteConfirm = ref(false)

const newProducer = ref({
  name: '',
  regionId: null as number | null,
  website: '',
  notes: '',
})
const isCreating = ref(false)
const createError = ref('')

const { data: regionsData } = await useFetch('/api/regions')

const { data: producers, pending, refresh: refreshProducers } = await useFetch<Producer[]>('/api/producers', {
  query: computed(() => ({
    search: debouncedSearch.value || undefined,
  })),
})

const handleSearchInput = (value: string) => {
  searchQuery.value = value
  if (searchDebounce.value) clearTimeout(searchDebounce.value)
  searchDebounce.value = setTimeout(() => {
    debouncedSearch.value = value
  }, 300)
}

const selectProducer = (producer: Producer) => {
  selectedProducer.value = producer
}

const closePanel = () => {
  selectedProducer.value = null
  editingField.value = null
}

const startEditing = (field: string) => {
  if (!selectedProducer.value) return
  editingField.value = field
  if (field === 'name') {
    editValues.value.name = selectedProducer.value.name
  } else if (field === 'region') {
    editValues.value.regionId = selectedProducer.value.regionId
  } else if (field === 'website') {
    editValues.value.website = selectedProducer.value.website || ''
  } else if (field === 'notes') {
    editValues.value.notes = selectedProducer.value.notes || ''
  }
}

const cancelEditing = () => {
  editingField.value = null
}

const saveField = async (field: string) => {
  if (!selectedProducer.value) return
  isUpdating.value = true

  try {
    const body: Record<string, unknown> = {}
    if (field === 'name') {
      body.name = editValues.value.name
    } else if (field === 'region') {
      body.regionId = editValues.value.regionId
    } else if (field === 'website') {
      body.website = editValues.value.website || null
    } else if (field === 'notes') {
      body.notes = editValues.value.notes || null
    }

    const updated = await $fetch<Producer>(`/api/producers/${selectedProducer.value.id}`, {
      method: 'PATCH',
      body,
    })

    selectedProducer.value = updated

    if (producers.value) {
      const index = producers.value.findIndex(p => p.id === updated.id)
      if (index !== -1) {
        producers.value[index] = updated
      }
    }

    editingField.value = null
  } catch (e) {
    console.error('Failed to save field', e)
  } finally {
    isUpdating.value = false
  }
}

const deleteProducer = async () => {
  if (!selectedProducer.value) return
  isUpdating.value = true

  try {
    await $fetch(`/api/producers/${selectedProducer.value.id}`, {
      method: 'DELETE',
    })
    closePanel()
    await refreshProducers()
  } catch (e: any) {
    console.error('Failed to delete producer', e)
    alert(e.data?.message || 'Failed to delete producer')
  } finally {
    isUpdating.value = false
    showDeleteConfirm.value = false
  }
}

const createProducer = async () => {
  if (!newProducer.value.name.trim()) {
    createError.value = 'Name is required'
    return
  }

  isCreating.value = true
  createError.value = ''

  try {
    await $fetch('/api/producers', {
      method: 'POST',
      body: {
        name: newProducer.value.name.trim(),
        regionId: newProducer.value.regionId,
        website: newProducer.value.website.trim() || null,
        notes: newProducer.value.notes.trim() || null,
      },
    })

    newProducer.value = { name: '', regionId: null, website: '', notes: '' }
    showAddModal.value = false
    await refreshProducers()
  } catch (e: any) {
    console.error('Failed to create producer', e)
    createError.value = e.data?.message || 'Failed to create producer'
  } finally {
    isCreating.value = false
  }
}

const viewWines = (producerId: number) => {
  router.push(`/inventory?producer=${producerId}`)
}

onMounted(() => {
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (showAddModal.value) {
        showAddModal.value = false
      } else {
        closePanel()
      }
    }
  }
  window.addEventListener('keydown', handleEscape)
  onUnmounted(() => window.removeEventListener('keydown', handleEscape))
})
</script>

<template>
  <div class="flex">
    <div class="flex-1 min-w-0" :class="{ 'lg:mr-96': selectedProducer }">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-6">
        <div>
          <h1 class="text-2xl font-bold text-muted-900">Producers</h1>
          <p class="mt-1 text-muted-600">Manage your wine producers</p>
        </div>

        <div class="flex items-center gap-2">
          <div class="relative flex-1 sm:flex-initial">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              :value="searchQuery"
              type="text"
              placeholder="Search producers..."
              class="pl-9 pr-4 py-2 w-full sm:w-64 text-sm border border-muted-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary-500"
              @input="handleSearchInput(($event.target as HTMLInputElement).value)"
            >
          </div>

          <button
            class="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 hover:scale-105 transition-transform"
            @click="showAddModal = true"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            <span class="hidden sm:inline">Add Producer</span>
            <span class="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      <div v-if="pending" class="text-center py-12">
        <p class="text-muted-500">Loading producers...</p>
      </div>

      <div v-else-if="!producers?.length" class="text-center py-12">
        <svg class="mx-auto h-12 w-12 text-muted-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        <h3 class="mt-4 text-lg font-semibold text-muted-900">No producers found</h3>
        <p class="mt-2 text-sm text-muted-500">
          {{ debouncedSearch ? 'Try adjusting your search.' : 'Get started by adding a producer.' }}
        </p>
        <div v-if="!debouncedSearch" class="mt-6">
          <button
            class="btn-primary"
            @click="showAddModal = true"
          >
            Add Producer
          </button>
        </div>
      </div>

      <div v-else class="overflow-x-auto -mx-4 sm:mx-0">
        <table class="w-full min-w-[400px]">
          <thead>
            <tr class="border-b border-muted-200">
              <th class="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-muted-500 uppercase tracking-wider">Name</th>
              <th class="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-muted-500 uppercase tracking-wider hidden sm:table-cell">Region</th>
              <th class="px-3 sm:px-4 py-3 text-right text-xs font-semibold text-muted-500 uppercase tracking-wider">Bottles</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-muted-100">
            <tr
              v-for="producer in producers"
              :key="producer.id"
              class="cursor-pointer transition-colors"
              :class="selectedProducer?.id === producer.id ? 'bg-primary-50' : 'hover:bg-muted-50'"
              @click="selectProducer(producer)"
            >
              <td class="px-3 sm:px-4 py-3 text-sm font-semibold text-muted-900">
                {{ producer.name }}
                <span class="sm:hidden text-xs font-normal text-muted-500 block">{{ producer.regionName || '-' }}</span>
              </td>
              <td class="px-3 sm:px-4 py-3 text-sm text-muted-600 hidden sm:table-cell">{{ producer.regionName || '-' }}</td>
              <td class="px-3 sm:px-4 py-3 text-sm text-muted-900 text-right font-semibold">{{ producer.bottleCount }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <Transition
      enter-active-class="transition-transform duration-300 ease-out"
      enter-from-class="translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transition-transform duration-200 ease-in"
      leave-from-class="translate-x-0"
      leave-to-class="translate-x-full"
    >
      <div
        v-if="selectedProducer"
        class="fixed right-0 top-0 h-full w-full sm:w-80 lg:w-96 bg-white border-l-2 border-muted-200 overflow-y-auto z-20"
      >
        <div class="sticky top-0 bg-white border-b border-muted-200 px-6 py-4 z-10">
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <div v-if="editingField === 'name'" class="flex items-center gap-1">
                <input
                  v-model="editValues.name"
                  type="text"
                  class="input text-lg font-bold py-1 flex-1"
                  @keydown.enter="saveField('name')"
                  @keydown.escape="cancelEditing"
                >
                <button
                  type="button"
                  class="p-1.5 text-secondary-600 hover:text-secondary-700"
                  :disabled="isUpdating"
                  @click="saveField('name')"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button
                  type="button"
                  class="p-1.5 text-muted-400 hover:text-muted-600"
                  @click="cancelEditing"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <h2
                v-else
                class="font-display font-bold text-xl text-muted-900 truncate cursor-pointer hover:text-primary-600 transition-colors"
                @click="startEditing('name')"
              >
                {{ selectedProducer.name }}
              </h2>
              <p class="text-sm text-muted-500 mt-1">
                {{ selectedProducer.bottleCount }} bottle{{ selectedProducer.bottleCount === 1 ? '' : 's' }}
              </p>
            </div>
            <button
              class="p-1.5 text-muted-400 hover:text-muted-600 rounded-lg hover:bg-muted-100 hover:scale-105 transition-all"
              @click="closePanel"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div class="px-6 py-5 bg-white">
          <div class="flex items-center gap-2.5 mb-4">
            <div class="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
              <svg class="w-4 h-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 class="font-display font-bold text-muted-900">Details</h3>
          </div>

          <dl class="space-y-3">
            <div class="flex justify-between items-center">
              <dt class="text-sm text-muted-500">Region</dt>
              <dd v-if="editingField === 'region'" class="flex items-center gap-1">
                <select
                  v-model="editValues.regionId"
                  class="input text-sm py-1 w-32 sm:w-40"
                >
                  <option :value="null">None</option>
                  <option v-for="r in regionsData" :key="r.id" :value="r.id">
                    {{ r.name }}
                  </option>
                </select>
                <button
                  type="button"
                  class="p-1.5 text-secondary-600 hover:text-secondary-700"
                  :disabled="isUpdating"
                  @click="saveField('region')"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button
                  type="button"
                  class="p-1.5 text-muted-400 hover:text-muted-600"
                  @click="cancelEditing"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </dd>
              <dd
                v-else
                class="text-sm font-semibold text-muted-900 cursor-pointer hover:text-primary-600 transition-colors"
                @click="startEditing('region')"
              >
                {{ selectedProducer.regionName || '-' }}
              </dd>
            </div>

            <div class="flex justify-between items-center">
              <dt class="text-sm text-muted-500">Website</dt>
              <dd v-if="editingField === 'website'" class="flex items-center gap-1">
                <input
                  v-model="editValues.website"
                  type="url"
                  placeholder="https://..."
                  class="input text-sm py-1 w-32 sm:w-40"
                  @keydown.enter="saveField('website')"
                  @keydown.escape="cancelEditing"
                >
                <button
                  type="button"
                  class="p-1.5 text-secondary-600 hover:text-secondary-700"
                  :disabled="isUpdating"
                  @click="saveField('website')"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button
                  type="button"
                  class="p-1.5 text-muted-400 hover:text-muted-600"
                  @click="cancelEditing"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </dd>
              <dd
                v-else
                class="text-sm font-semibold cursor-pointer hover:text-primary-600 transition-colors"
                :class="selectedProducer.website ? 'text-primary-600' : 'text-muted-900'"
                @click="startEditing('website')"
              >
                <a
                  v-if="selectedProducer.website"
                  :href="selectedProducer.website"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="hover:underline"
                  @click.stop
                >
                  {{ selectedProducer.website.replace(/^https?:\/\//, '').replace(/\/$/, '') }}
                </a>
                <span v-else>-</span>
              </dd>
            </div>
          </dl>
        </div>

        <div class="px-6 py-5 bg-muted-50">
          <div class="flex items-center gap-2.5 mb-4">
            <div class="w-8 h-8 rounded-lg bg-secondary-100 flex items-center justify-center">
              <svg class="w-4 h-4 text-secondary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 class="font-display font-bold text-muted-900">Notes</h3>
          </div>

          <div v-if="editingField === 'notes'" class="space-y-2">
            <textarea
              v-model="editValues.notes"
              rows="4"
              class="input text-sm w-full resize-none"
              placeholder="Add notes about this producer..."
              @keydown.escape="cancelEditing"
            />
            <div class="flex justify-end gap-2">
              <button
                type="button"
                class="px-3 py-1.5 text-sm text-muted-600 hover:text-muted-800"
                @click="cancelEditing"
              >
                Cancel
              </button>
              <button
                type="button"
                class="px-3 py-1.5 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700"
                :disabled="isUpdating"
                @click="saveField('notes')"
              >
                Save
              </button>
            </div>
          </div>
          <p
            v-else
            class="text-sm cursor-pointer hover:text-primary-600 transition-colors"
            :class="selectedProducer.notes ? 'text-muted-700' : 'text-muted-400 italic'"
            @click="startEditing('notes')"
          >
            {{ selectedProducer.notes || 'Click to add notes...' }}
          </p>
        </div>

        <div class="px-6 py-5 bg-white border-t border-muted-200">
          <button
            v-if="selectedProducer.bottleCount > 0"
            class="w-full mb-3 px-4 py-2 text-sm font-semibold text-primary-600 bg-primary-50 border-2 border-primary-200 rounded-lg hover:bg-primary-100 hover:scale-102 transition-all"
            @click="viewWines(selectedProducer.id)"
          >
            View {{ selectedProducer.bottleCount }} Bottle{{ selectedProducer.bottleCount === 1 ? '' : 's' }}
          </button>

          <div v-if="showDeleteConfirm" class="space-y-3">
            <p class="text-sm text-muted-600">Are you sure you want to delete this producer?</p>
            <div class="flex gap-2">
              <button
                class="flex-1 px-3 py-2 text-sm font-semibold text-muted-700 bg-muted-100 rounded-lg hover:bg-muted-200"
                @click="showDeleteConfirm = false"
              >
                Cancel
              </button>
              <button
                class="flex-1 px-3 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700"
                :disabled="isUpdating"
                @click="deleteProducer"
              >
                Delete
              </button>
            </div>
          </div>

          <div v-else class="relative group">
            <button
              class="w-full px-4 py-2 text-sm font-semibold rounded-lg transition-all"
              :class="selectedProducer.bottleCount > 0
                ? 'text-muted-400 bg-muted-100 cursor-not-allowed'
                : 'text-red-600 bg-red-50 border-2 border-red-200 hover:bg-red-100 hover:scale-102'"
              :disabled="selectedProducer.bottleCount > 0"
              @click="showDeleteConfirm = true"
            >
              Delete Producer
            </button>
            <div
              v-if="selectedProducer.bottleCount > 0"
              class="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-muted-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50"
            >
              Remove all wines first to delete this producer
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showAddModal"
        class="fixed inset-0 bg-black/50 z-30 flex items-center justify-center p-4"
        @click.self="showAddModal = false"
      >
        <div class="bg-white rounded-xl w-full max-w-md">
          <div class="flex items-center justify-between px-6 py-4 border-b border-muted-200">
            <h2 class="text-lg font-bold text-muted-900">Add Producer</h2>
            <button
              class="p-1.5 text-muted-400 hover:text-muted-600 rounded-lg hover:bg-muted-100"
              @click="showAddModal = false"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form class="p-6 space-y-4" @submit.prevent="createProducer">
            <div v-if="createError" class="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
              {{ createError }}
            </div>

            <div>
              <label class="block text-sm font-semibold text-muted-700 mb-1">
                Name <span class="text-red-500">*</span>
              </label>
              <input
                v-model="newProducer.name"
                type="text"
                class="input w-full"
                placeholder="e.g. Domaine de la Romanée-Conti"
                required
              >
            </div>

            <div>
              <label class="block text-sm font-semibold text-muted-700 mb-1">Region</label>
              <select v-model="newProducer.regionId" class="input w-full">
                <option :value="null">Select region (optional)</option>
                <option v-for="r in regionsData" :key="r.id" :value="r.id">
                  {{ r.name }}
                </option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-semibold text-muted-700 mb-1">Website</label>
              <input
                v-model="newProducer.website"
                type="url"
                class="input w-full"
                placeholder="https://..."
              >
            </div>

            <div>
              <label class="block text-sm font-semibold text-muted-700 mb-1">Notes</label>
              <textarea
                v-model="newProducer.notes"
                rows="3"
                class="input w-full resize-none"
                placeholder="Add any notes..."
              />
            </div>

            <div class="flex gap-3 pt-2">
              <button
                type="button"
                class="flex-1 px-4 py-2 text-sm font-semibold text-muted-700 bg-muted-100 rounded-lg hover:bg-muted-200"
                @click="showAddModal = false"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="flex-1 px-4 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
                :disabled="isCreating"
              >
                {{ isCreating ? 'Adding...' : 'Add Producer' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </div>
</template>
