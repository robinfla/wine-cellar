<script setup lang="ts">
interface Props {
  color?: 'primary' | 'secondary' | 'accent' | 'muted' | 'white'
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  color: 'primary',
  size: 'md',
})

const colorClasses = {
  primary: 'bg-primary text-white',
  secondary: 'bg-secondary text-white',
  accent: 'bg-accent text-white',
  muted: 'bg-muted-200 text-muted-700',
  white: 'bg-white text-primary',
}

const sizeClasses = {
  sm: 'h-10 w-10',
  md: 'h-14 w-14',
  lg: 'h-16 w-16',
}

const iconSizeClasses = {
  sm: 'h-5 w-5',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
}

const classes = computed(() => [
  'inline-flex items-center justify-center rounded-full',
  colorClasses[props.color],
  sizeClasses[props.size],
])
</script>

<template>
  <div :class="classes">
    <div :class="iconSizeClasses[size]">
      <slot />
    </div>
  </div>
</template>
