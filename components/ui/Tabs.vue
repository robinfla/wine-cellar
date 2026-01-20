<script setup lang="ts">
interface Tab {
  key: string
  label: string
  count?: number
}

interface Props {
  tabs: Tab[]
  modelValue: string
}

defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <div class="border-b-2 border-muted-200">
    <nav class="-mb-[2px] flex gap-6">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        :class="[
          'py-3 px-1 text-sm font-semibold transition-all duration-200 border-b-4 hover:scale-105',
          modelValue === tab.key
            ? 'border-primary text-primary'
            : 'border-transparent text-muted-500 hover:text-muted-700 hover:border-muted-300'
        ]"
        @click="emit('update:modelValue', tab.key)"
      >
        {{ tab.label }}
        <span
          v-if="tab.count !== undefined"
          :class="[
            'ml-2 rounded-md px-2 py-0.5 text-xs font-semibold',
            modelValue === tab.key
              ? 'bg-primary-100 text-primary-700'
              : 'bg-muted-200 text-muted-600'
          ]"
        >
          {{ tab.count }}
        </span>
      </button>
    </nav>
  </div>
</template>
