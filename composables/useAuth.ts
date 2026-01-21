interface User {
  id: number
  email: string
  name: string | null
  isAdmin: boolean
  preferredCurrency: string | null
}

export function useAuth() {
  const user = useState<User | null>('auth-user', () => null)
  const isAuthenticated = computed(() => !!user.value)
  const isAdmin = computed(() => !!user.value?.isAdmin)
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

  async function fetchUser() {
    try {
      const response = await $fetch<{ user: User | null }>('/api/auth/session')
      user.value = response?.user ?? null
    } catch {
      user.value = null
    }
  }

  return {
    user,
    isAuthenticated,
    isAdmin,
    isLoading,
    checkSession,
    fetchUser,
    login,
    logout,
  }
}
