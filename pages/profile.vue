<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

const { user, isAdmin, fetchUser } = useAuth()

const name = ref(user.value?.name || '')
const preferredCurrency = ref(user.value?.preferredCurrency || 'EUR')
const error = ref('')
const success = ref('')
const isLoading = ref(false)

watch(user, (newUser) => {
  if (newUser) {
    name.value = newUser.name || ''
    preferredCurrency.value = newUser.preferredCurrency || 'EUR'
  }
}, { immediate: true })

const currencies = [
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'USD', label: 'US Dollar (USD)' },
  { value: 'GBP', label: 'British Pound (GBP)' },
  { value: 'ZAR', label: 'South African Rand (ZAR)' },
  { value: 'CHF', label: 'Swiss Franc (CHF)' },
]

async function handleSubmit() {
  error.value = ''
  success.value = ''
  isLoading.value = true

  try {
    await $fetch('/api/users/me', {
      method: 'PATCH',
      body: {
        name: name.value || undefined,
        preferredCurrency: preferredCurrency.value,
      },
    })
    await fetchUser()
    success.value = 'Profile updated successfully'
  } catch (e: any) {
    error.value = e.data?.message || 'Failed to update profile'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="max-w-2xl mx-auto py-8 px-4">
    <h1 class="text-2xl font-display font-bold mb-8">Profile Settings</h1>

    <div class="card">
      <form class="space-y-6" @submit.prevent="handleSubmit">
        <div v-if="error" class="p-3 text-sm font-semibold text-red-700 bg-red-100 rounded-lg border-2 border-red-200">
          {{ error }}
        </div>

        <div v-if="success" class="p-3 text-sm font-semibold text-green-700 bg-green-100 rounded-lg border-2 border-green-200">
          {{ success }}
        </div>

        <div>
          <label for="email" class="label">Email</label>
          <input
            id="email"
            :value="user?.email"
            type="email"
            disabled
            class="input bg-muted/50 cursor-not-allowed"
          >
          <p class="mt-1 text-sm text-muted-foreground">Email cannot be changed</p>
        </div>

        <div>
          <label for="name" class="label">Name</label>
          <input
            id="name"
            v-model="name"
            type="text"
            class="input"
            placeholder="Your name"
          >
        </div>

        <div>
          <label for="currency" class="label">Preferred Currency</label>
          <select
            id="currency"
            v-model="preferredCurrency"
            class="input"
          >
            <option v-for="currency in currencies" :key="currency.value" :value="currency.value">
              {{ currency.label }}
            </option>
          </select>
          <p class="mt-1 text-sm text-muted-foreground">Used for displaying prices in reports</p>
        </div>

        <div class="flex gap-4">
          <button
            type="submit"
            :disabled="isLoading"
            class="btn-primary"
          >
            <span v-if="isLoading">Saving...</span>
            <span v-else>Save Changes</span>
          </button>

          <NuxtLink to="/" class="btn-secondary">
            Cancel
          </NuxtLink>
        </div>
      </form>
    </div>

    <!-- Admin Section -->
    <div v-if="isAdmin" class="card mt-8">
      <h2 class="text-lg font-semibold mb-4">Administration</h2>
      <p class="text-sm text-muted-600 mb-4">
        You have admin privileges. Access the admin dashboard to manage users and invitations.
      </p>
      <NuxtLink to="/admin" class="btn-primary">
        Open Admin Dashboard
      </NuxtLink>
    </div>
  </div>
</template>
