<script setup lang="ts">
const { t } = useI18n({ useScope: 'global' })
interface Grape {
  id: number
  name: string
}

const props = defineProps<{
  grapes: Grape[]
  modelValue: number[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number[]]
}>()

const search = ref('')
const showDropdown = ref(false)
const containerRef = ref<HTMLElement | null>(null)
const isCreating = ref(false)
const localGrapes = ref<Grape[]>([])

// Initialize local grapes from props
watch(() => props.grapes, (newGrapes) => {
  localGrapes.value = [...newGrapes]
}, { immediate: true })

const allGrapes = computed(() => localGrapes.value)

const filteredGrapes = computed(() => {
  if (!search.value) return allGrapes.value
  const query = search.value.toLowerCase()
  return allGrapes.value.filter(g => g.name.toLowerCase().includes(query))
})

const selectedGrapes = computed(() => {
  return allGrapes.value.filter(g => props.modelValue.includes(g.id))
})

const showCreateOption = computed(() => {
  return search.value.trim().length > 0 && filteredGrapes.value.length === 0
})

function isSelected(grapeId: number) {
  return props.modelValue.includes(grapeId)
}

function toggleGrape(grapeId: number) {
  if (isSelected(grapeId)) {
    emit('update:modelValue', props.modelValue.filter(id => id !== grapeId))
  } else {
    emit('update:modelValue', [...props.modelValue, grapeId])
  }
}

function removeGrape(grapeId: number) {
  emit('update:modelValue', props.modelValue.filter(id => id !== grapeId))
}

async function createGrape() {
  if (!search.value.trim()) return
  isCreating.value = true
  try {
    const newGrape = await $fetch<Grape>('/api/grapes', {
      method: 'POST',
      body: { name: search.value.trim() },
    })
    localGrapes.value = [...localGrapes.value, newGrape]
    emit('update:modelValue', [...props.modelValue, newGrape.id])
    search.value = ''
  } catch (e) {
    console.error('Failed to create grape', e)
  } finally {
    isCreating.value = false
  }
}

// Close dropdown when clicking outside
function handleClickOutside(event: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    showDropdown.value = false
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside)
})
</script>

<template>
  <div ref="containerRef" class="relative">
    <!-- Selected grapes as chips -->
    <div v-if="selectedGrapes.length > 0" class="flex flex-wrap gap-1.5 mb-2">
      <span
        v-for="grape in selectedGrapes"
        :key="grape.id"
        class="inline-flex items-center gap-1 px-2 py-0.5 text-sm font-semibold bg-primary-100 text-primary-700 rounded-full"
      >
        {{ grape.name }}
        <button
          type="button"
          class="hover:text-primary-900 hover:scale-110 transition-transform"
          @click.stop="removeGrape(grape.id)"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </span>
    </div>

    <!-- Search input -->
    <div class="relative">
      <input
        v-model="search"
        type="text"
        class="input w-full pr-8"
        :placeholder="$t('grapes.searchGrapes')"
        @focus="showDropdown = true"
      >
      <button
        type="button"
        class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-400 hover:text-muted-600 hover:scale-110 transition-all"
        @click="showDropdown = !showDropdown"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>

    <!-- Dropdown list -->
    <Transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="showDropdown"
        class="absolute z-[60] mt-1 w-full bg-white border-2 border-muted-200 rounded-lg max-h-60 overflow-y-auto"
      >
        <!-- Create new option -->
        <button
          v-if="showCreateOption"
          type="button"
          class="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary-50 hover:scale-102 transition-all disabled:opacity-50"
          :disabled="isCreating"
          @click="createGrape"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          {{ isCreating ? $t('grapes.creating') : $t('grapes.addGrape', { name: search }) }}
        </button>

        <!-- Empty state when no grapes and no search -->
        <div v-else-if="filteredGrapes.length === 0" class="px-3 py-2 text-sm text-muted-500">
          {{ $t('grapes.noGrapesFound') }}
        </div>

        <!-- Grape list -->
        <div
          v-for="grape in filteredGrapes"
          :key="grape.id"
          class="flex items-center gap-2 px-3 py-2 hover:bg-muted-50 cursor-pointer transition-colors"
          @click="toggleGrape(grape.id)"
        >
          <input
            type="checkbox"
            :checked="isSelected(grape.id)"
            class="w-4 h-4 text-primary border-2 border-muted-300 rounded focus:ring-primary pointer-events-none"
          >
          <span class="text-sm text-muted-700">{{ grape.name }}</span>
        </div>
      </div>
    </Transition>
  </div>
</template>
