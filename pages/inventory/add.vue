<script setup lang="ts">
// Redirect to inventory page - wine adding is now done via modal
definePageMeta({
  middleware: 'auth',
})

const router = useRouter()

onMounted(() => {
  router.replace('/inventory')
})
</script>

<template>
  <div class="flex items-center justify-center min-h-[50vh]">
    <p class="text-gray-500">Redirecting to inventory...</p>
  </div>
</template>
