<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

const { t } = useI18n({ useScope: 'global' })
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
  { value: 'EUR', label: t('profile.euroEUR') }, // TODO: add i18n key
  { value: 'USD', label: t('profile.usDollarUSD') }, // TODO: add i18n key
  { value: 'GBP', label: t('profile.britishPoundGBP') }, // TODO: add i18n key
  { value: 'ZAR', label: t('profile.southAfricanRandZAR') }, // TODO: add i18n key
  { value: 'CHF', label: t('profile.swissFrancCHF') }, // TODO: add i18n key
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
    success.value = t('profile.updateSuccess') // TODO: add i18n key
  } catch (e: any) {
    error.value = e.data?.message || t('profile.updateFailed') // TODO: add i18n key
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="max-w-2xl mx-auto py-8 px-4">
    <h1 class="text-2xl font-display font-bold mb-8">{{ $t('profile.settings') }}</h1><!-- TODO: add i18n key -->

    <div class="card">
      <form class="space-y-6" @submit.prevent="handleSubmit">
        <div v-if="error" class="p-3 text-sm font-semibold text-red-700 bg-red-100 rounded-lg border-2 border-red-200">
          {{ error }}
        </div>

        <div v-if="success" class="p-3 text-sm font-semibold text-green-700 bg-green-100 rounded-lg border-2 border-green-200">
          {{ success }}
        </div>

        <div>
          <label for="email" class="label">{{ $t('auth.email') }}</label>
          <input
            id="email"
            :value="user?.email"
            type="email"
            disabled
            class="input bg-muted/50 cursor-not-allowed"
          >
          <p class="mt-1 text-sm text-muted-foreground">{{ $t('profile.emailCannotChange') }}</p><!-- TODO: add i18n key -->
        </div>

        <div>
          <label for="name" class="label">{{ $t('auth.name') }}</label>
          <input
            id="name"
            v-model="name"
            type="text"
            class="input"
            :placeholder="$t('profile.yourName')"
          ><!-- TODO: add i18n key -->
        </div>

        <div>
          <label for="currency" class="label">{{ $t('profile.preferredCurrency') }}</label><!-- TODO: add i18n key -->
          <select
            id="currency"
            v-model="preferredCurrency"
            class="input"
          >
            <option v-for="currency in currencies" :key="currency.value" :value="currency.value">
              {{ currency.label }}
            </option>
          </select>
          <p class="mt-1 text-sm text-muted-foreground">{{ $t('profile.currencyDescription') }}</p><!-- TODO: add i18n key -->
        </div>

        <div class="flex gap-4">
          <button
            type="submit"
            :disabled="isLoading"
            class="btn-primary"
          >
            <span v-if="isLoading">{{ $t('inventory.saving') }}...</span>
            <span v-else>{{ $t('profile.saveChanges') }}</span><!-- TODO: add i18n key -->
          </button>

          <NuxtLink to="/" class="btn-secondary">
            {{ $t('common.cancel') }}
          </NuxtLink>
        </div>
      </form>
    </div>

    <!-- Admin Section -->
    <div v-if="isAdmin" class="card mt-8">
      <h2 class="text-lg font-semibold mb-4">{{ $t('profile.administration') }}</h2><!-- TODO: add i18n key -->
      <p class="text-sm text-muted-600 mb-4">
        {{ $t('profile.adminPrivileges') }}<!-- TODO: add i18n key -->
      </p>
      <NuxtLink to="/admin" class="btn-primary">
        {{ $t('profile.openAdminDashboard') }}<!-- TODO: add i18n key -->
      </NuxtLink>
    </div>
  </div>
</template>
