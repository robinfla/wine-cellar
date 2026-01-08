interface User {
  id: number
  email: string
  name: string | null
  preferredCurrency: string | null
}

export function useAuth() {
  const user = useState<User | null>('auth-user', () => null)
  const isAuthenticated = computed(() => !!user.value)
  const isLoading = useState('auth-loading', () => true)

  async function checkSession() {
    try {
      isLoading.value = true
      const { data } = await useFetch<{ user: User | null }>('/api/auth/session')
      user.value = data.value?.user ?? null
    } catch {
      user.value = null
    } finally {
      isLoading.value = false
    }
  }

  async function login(email: string, password: string) {
    const response = await $fetch<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    })

    user.value = response.user
    return response.user
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
    navigateTo('/login')
  }

  return {
    user,
    isAuthenticated,
    isLoading,
    checkSession,
    login,
    logout,
  }
}
