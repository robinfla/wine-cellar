<script setup lang="ts">
interface Props {
  modelValue: string | number
  type?: 'text' | 'email' | 'password' | 'number' | 'date' | 'search'
  placeholder?: string
  disabled?: boolean
  error?: string
  label?: string
  id?: string
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  placeholder: '',
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

const inputId = computed(() => props.id || `input-${Math.random().toString(36).slice(2, 9)}`)

const inputClasses = computed(() => [
  'block w-full rounded-lg border-2 px-3 py-2 text-muted-900 placeholder-muted-400 bg-muted-100 transition-colors duration-200',
  'focus:bg-white focus:border-primary focus:ring-0 focus:outline-none',
  'disabled:bg-muted-200 disabled:cursor-not-allowed',
  props.error ? 'border-red-500 focus:border-red-500' : 'border-muted-300',
])

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement
  const value = props.type === 'number' ? Number(target.value) : target.value
  emit('update:modelValue', value)
}
</script>

<template>
  <div>
    <label
      v-if="label"
      :for="inputId"
      class="block text-sm font-semibold text-muted-700 mb-1"
    >
      {{ label }}
    </label>
    <input
      :id="inputId"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :class="inputClasses"
      @input="handleInput"
    />
    <p v-if="error" class="mt-1 text-sm text-red-600">
      {{ error }}
    </p>
  </div>
</template>
