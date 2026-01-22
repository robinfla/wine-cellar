<script setup lang="ts">
const props = withDefaults(defineProps<{
  message: string
  type?: 'success' | 'error' | 'warning' | 'info'
  duration?: number
}>(), {
  type: 'info',
  duration: 5000,
})

const emit = defineEmits<{
  close: []
}>()

const isVisible = ref(true)

const typeClasses = {
  success: 'bg-secondary-50 border-secondary-200 text-secondary-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-accent-50 border-accent-200 text-accent-800',
  info: 'bg-primary-50 border-primary-200 text-primary-800',
}

const iconPaths = {
  success: 'M5 13l4 4L19 7',
  error: 'M6 18L18 6M6 6l12 12',
  warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
}

onMounted(() => {
  if (props.duration > 0) {
    setTimeout(() => {
      isVisible.value = false
      setTimeout(() => emit('close'), 300)
    }, props.duration)
  }
})

function close() {
  isVisible.value = false
  setTimeout(() => emit('close'), 300)
}
</script>

<template>
  <Transition
    enter-active-class="transition ease-out duration-300"
    enter-from-class="opacity-0 translate-y-2"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition ease-in duration-200"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 translate-y-2"
  >
    <div
      v-if="isVisible"
      class="flex items-start gap-3 p-4 rounded-lg border-2 shadow-lg"
      :class="typeClasses[type]"
    >
      <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="iconPaths[type]" />
      </svg>
      <p class="text-sm font-medium flex-1">{{ message }}</p>
      <button
        class="flex-shrink-0 p-1 -m-1 rounded hover:bg-black/5 transition-colors"
        @click="close"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </Transition>
</template>
