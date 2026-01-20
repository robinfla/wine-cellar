<script setup lang="ts">
// Check session on app load
const { checkSession } = useAuth()

onMounted(async () => {
  await checkSession()
})
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
