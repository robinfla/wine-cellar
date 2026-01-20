<script setup lang="ts">
interface Option {
  value: string | number
  label: string
}

interface Props {
  modelValue: string | number | null
  options: Option[]
  placeholder?: string
  disabled?: boolean
  error?: string
  label?: string
  id?: string
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Select an option',
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number | null]
}>()

const selectId = computed(() => props.id || `select-${Math.random().toString(36).slice(2, 9)}`)

const selectClasses = computed(() => [
  'block w-full rounded-lg border-2 px-3 py-2 text-muted-900 bg-muted-100 transition-colors duration-200 appearance-none cursor-pointer',
  'focus:bg-white focus:border-primary focus:ring-0 focus:outline-none',
  'disabled:bg-muted-200 disabled:cursor-not-allowed',
  props.error ? 'border-red-500 focus:border-red-500' : 'border-muted-300',
])

function handleChange(event: Event) {
  const target = event.target as HTMLSelectElement
  const value = target.value === '' ? null : target.value
  emit('update:modelValue', value)
}
</script>

<template>
  <div>
    <label
      v-if="label"
      :for="selectId"
      class="block text-sm font-semibold text-muted-700 mb-1"
    >
      {{ label }}
    </label>
    <div class="relative">
      <select
        :id="selectId"
        :value="modelValue ?? ''"
        :disabled="disabled"
        :class="selectClasses"
        @change="handleChange"
      >
        <option value="" disabled>{{ placeholder }}</option>
        <option
          v-for="option in options"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>
      <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
        <svg class="h-5 w-5 text-muted-400" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </div>
    </div>
    <p v-if="error" class="mt-1 text-sm text-red-600">
      {{ error }}
    </p>
  </div>
</template>
