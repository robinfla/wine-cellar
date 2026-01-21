<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'created': []
}>()

const cellars = ref<{ name: string; countryCode: string }[]>([
  { name: '', countryCode: 'FR' },
])

const isSubmitting = ref(false)
const error = ref('')

const countryOptions = [
  { value: 'FR', label: 'France' },
  { value: 'ZA', label: 'South Africa' },
  { value: 'IT', label: 'Italy' },
  { value: 'ES', label: 'Spain' },
  { value: 'US', label: 'United States' },
  { value: 'AU', label: 'Australia' },
  { value: 'DE', label: 'Germany' },
  { value: 'PT', label: 'Portugal' },
  { value: 'CH', label: 'Switzerland' },
  { value: 'GB', label: 'United Kingdom' },
]

const canSubmit = computed(() =>
  cellars.value.some(c => c.name.trim().length > 0),
)

function addCellar() {
  cellars.value.push({ name: '', countryCode: 'FR' })
}

function removeCellar(index: number) {
  if (cellars.value.length > 1) {
    cellars.value.splice(index, 1)
  }
}

function closeModal() {
  emit('update:modelValue', false)
}

async function handleSubmit() {
  error.value = ''
  isSubmitting.value = true

  try {
    const validCellars = cellars.value.filter(c => c.name.trim())
    
    for (const cellar of validCellars) {
      await $fetch('/api/cellars', {
        method: 'POST',
        body: {
          name: cellar.name.trim(),
          countryCode: cellar.countryCode,
        },
      })
    }

    emit('created')
    closeModal()
    cellars.value = [{ name: '', countryCode: 'FR' }]
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    error.value = err.data?.message || 'Failed to create cellars'
  } finally {
    isSubmitting.value = false
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.modelValue) {
    closeModal()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    cellars.value = [{ name: '', countryCode: 'FR' }]
    error.value = ''
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 overflow-y-auto"
      >
        <div
          class="fixed inset-0 bg-muted-900/50"
          @click="closeModal"
        />

        <div class="relative min-h-screen flex items-center justify-center p-4">
          <Transition
            enter-active-class="transition ease-out duration-200"
            enter-from-class="opacity-0 scale-95"
            enter-to-class="opacity-100 scale-100"
            leave-active-class="transition ease-in duration-150"
            leave-from-class="opacity-100 scale-100"
            leave-to-class="opacity-0 scale-95"
          >
            <div
              v-if="modelValue"
              class="relative bg-white rounded-xl border-2 border-muted-200 w-full max-w-lg"
              @click.stop
            >
              <div class="bg-white border-b border-muted-200 px-6 py-4 flex items-center justify-between rounded-t-xl">
                <div>
                  <h2 class="text-xl font-semibold text-muted-900">Create Your Cellars</h2>
                  <p class="text-sm text-muted-500 mt-1">Add one or more storage locations for your wines</p>
                </div>
                <button
                  type="button"
                  class="text-muted-400 hover:text-muted-600 transition-transform hover:scale-105"
                  @click="closeModal"
                >
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form class="p-6" @submit.prevent="handleSubmit">
                <div v-if="error" class="mb-4 p-3 text-sm text-red-700 bg-red-50 rounded-lg">
                  {{ error }}
                </div>

                <div class="space-y-3">
                  <div
                    v-for="(cellar, index) in cellars"
                    :key="index"
                    class="flex items-center gap-2"
                  >
                    <input
                      v-model="cellar.name"
                      type="text"
                      class="input flex-1"
                      placeholder="Cellar name (e.g., Home, Office, Parents)"
                    >
                    <select v-model="cellar.countryCode" class="input w-32">
                      <option v-for="opt in countryOptions" :key="opt.value" :value="opt.value">
                        {{ opt.label }}
                      </option>
                    </select>
                    <button
                      v-if="cellars.length > 1"
                      type="button"
                      class="p-2 text-muted-400 hover:text-red-500 transition-colors"
                      @click="removeCellar(index)"
                    >
                      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                    <div v-else class="w-9" />
                  </div>
                </div>

                <button
                  type="button"
                  class="mt-3 text-sm text-primary-600 hover:text-primary-700 font-semibold flex items-center gap-1"
                  @click="addCellar"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Add another cellar
                </button>

                <div class="mt-6 flex justify-end gap-3 pt-4 border-t border-muted-200">
                  <button
                    type="button"
                    class="btn-secondary"
                    @click="closeModal"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    :disabled="!canSubmit || isSubmitting"
                    class="btn-primary"
                  >
                    {{ isSubmitting ? 'Creating...' : 'Create Cellars' }}
                  </button>
                </div>
              </form>
            </div>
          </Transition>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
