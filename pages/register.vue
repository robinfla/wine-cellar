<script setup lang="ts">
const { t } = useI18n({ useScope: 'global' })

definePageMeta({
  layout: 'auth',
})

const router = useRouter()
const route = useRoute()
const { user, fetchUser } = useAuth()

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const name = ref('')
const inviteCode = ref((route.query.code as string) || '')
const error = ref('')
const isLoading = ref(false)

watch(user, (newUser) => {
  if (newUser) {
    router.push('/')
  }
}, { immediate: true })

async function handleSubmit() {
  error.value = ''

  if (password.value !== confirmPassword.value) {
    error.value = t('auth.passwordsMismatch') // TODO: add i18n key for 'auth.passwordsMismatch'
    return
  }

  if (password.value.length < 8) {
    error.value = t('auth.passwordTooShort') // TODO: add i18n key for 'auth.passwordTooShort'
    return
  }

  isLoading.value = true

  try {
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: {
        email: email.value,
        password: password.value,
        name: name.value || undefined,
        inviteCode: inviteCode.value,
      },
    })
    await fetchUser()
    router.push('/')
  } catch (e: any) {
    error.value = e.data?.message || t('auth.registerFailed') // TODO: add i18n key for 'auth.registerFailed'
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
        <label for="inviteCode" class="label">{{ $t('auth.invitationCode') }}</label>
        <input
          id="inviteCode"
          v-model="inviteCode"
          type="text"
          required
          class="input"
          :placeholder="$t('auth.invitationCodePlaceholder')"
        >
      </div>

      <div>
        <label for="email" class="label">{{ $t('auth.email') }}</label>
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
        <label for="name" class="label">{{ $t('auth.name') }} ({{ $t('auth.optional') }})</label>
        <input
          id="name"
          v-model="name"
          type="text"
          autocomplete="name"
          class="input"
          :placeholder="$t('auth.namePlaceholder')"
        >
      </div>

      <div>
        <label for="password" class="label">{{ $t('auth.password') }}</label>
        <input
          id="password"
          v-model="password"
          type="password"
          required
          autocomplete="new-password"
          class="input"
          :placeholder="$t('auth.passwordMinLength')"
        >
      </div>

      <div>
        <label for="confirmPassword" class="label">{{ $t('auth.confirmPassword') }}</label>
        <input
          id="confirmPassword"
          v-model="confirmPassword"
          type="password"
          required
          autocomplete="new-password"
          class="input"
          :placeholder="$t('auth.confirmPasswordPlaceholder')"
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
        <span v-if="isLoading">{{ $t('auth.registering') }}</span>
        <span v-else>{{ $t('auth.register') }}</span>
      </button>

      <p class="text-center text-sm text-muted-foreground">
        {{ $t('auth.hasAccount') }}
        <NuxtLink to="/login" class="text-primary font-semibold hover:underline">
          {{ $t('auth.signIn') }}
        </NuxtLink>
      </p>
    </form>
  </div>
</template>
