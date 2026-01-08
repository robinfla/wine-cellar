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
    <form @submit.prevent="handleSubmit" class="space-y-6">
      <div v-if="error" class="p-3 text-sm text-red-700 bg-red-50 rounded-lg">
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
        />
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
        />
      </div>

      <button
        type="submit"
        :disabled="isLoading"
        class="btn-primary w-full"
      >
        <span v-if="isLoading">Signing in...</span>
        <span v-else>Sign in</span>
      </button>
    </form>
  </div>
</template>
