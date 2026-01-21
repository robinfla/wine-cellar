<script setup lang="ts">
definePageMeta({
  layout: 'auth',
})

const { login, user } = useAuth()
const router = useRouter()

const email = ref('')
const password = ref('')
const error = ref('')
const isLoading = ref(false)

// Redirect if already logged in
watch(user, (newUser) => {
  if (newUser) {
    router.push('/')
  }
}, { immediate: true })

async function handleSubmit() {
  error.value = ''
  isLoading.value = true

  try {
    await login(email.value, password.value)
    router.push('/')
  } catch (e: any) {
    error.value = e.data?.message || 'Login failed. Please try again.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="card">
    <form class="space-y-6" @submit.prevent="handleSubmit">
      <div v-if="error" class="p-3 text-sm font-semibold text-red-700 bg-red-100 rounded-lg border-2 border-red-200">
        {{ error }}
      </div>

      <div>
        <label for="email" class="label">Email</label>
        <input
          id="email"
          v-model="email"
          type="email"
          required
          autocomplete="email"
          class="input"
          placeholder="you@example.com"
        >
      </div>

      <div>
        <label for="password" class="label">Password</label>
        <input
          id="password"
          v-model="password"
          type="password"
          required
          autocomplete="current-password"
          class="input"
          placeholder="Enter your password"
        >
      </div>

      <button
        type="submit"
        :disabled="isLoading"
        class="btn-primary w-full h-12"
      >
        <svg
          v-if="isLoading"
          class="animate-spin -ml-1 mr-2 h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span v-if="isLoading">Signing in...</span>
        <span v-else>Sign in</span>
      </button>

      <p class="text-center text-sm text-muted-foreground">
        Have an invitation code?
        <NuxtLink to="/register" class="text-primary font-semibold hover:underline">
          Create account
        </NuxtLink>
      </p>
    </form>
  </div>
</template>
