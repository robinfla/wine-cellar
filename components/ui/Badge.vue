<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary' | 'accent' | 'muted' | 'success' | 'warning' | 'danger'
  size?: 'sm' | 'md'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'muted',
  size: 'sm',
})

const variantClasses = {
  primary: 'bg-primary-100 text-primary-700',
  secondary: 'bg-secondary-100 text-secondary-700',
  accent: 'bg-accent-100 text-accent-700',
  muted: 'bg-muted-200 text-muted-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
}

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
}

const classes = computed(() => [
  'inline-flex items-center font-semibold rounded-md',
  variantClasses[props.variant],
  sizeClasses[props.size],
])
</script>

<template>
  <span :class="classes">
    <slot />
  </span>
</template>
