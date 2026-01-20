<script setup lang="ts">
interface Props {
  interactive?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
  headerColor?: 'primary' | 'secondary' | 'accent' | 'muted'
}

const props = withDefaults(defineProps<Props>(), {
  interactive: false,
  padding: 'md',
})

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
}

const headerColorClasses = {
  primary: 'bg-primary text-white',
  secondary: 'bg-secondary text-white',
  accent: 'bg-accent text-white',
  muted: 'bg-muted-800 text-white',
}

const classes = computed(() => [
  'bg-white rounded-lg border-2 border-muted-200',
  props.interactive ? 'cursor-pointer transition-transform duration-200 hover:scale-102' : '',
  props.headerColor ? '' : paddingClasses[props.padding],
])
</script>

<template>
  <div :class="classes">
    <div
      v-if="headerColor && $slots.header"
      :class="['px-4 py-3 rounded-t-md -mx-[2px] -mt-[2px] border-2 border-transparent', headerColorClasses[headerColor]]"
    >
      <slot name="header" />
    </div>
    <div :class="headerColor ? paddingClasses[padding] : ''">
      <slot />
    </div>
  </div>
</template>
