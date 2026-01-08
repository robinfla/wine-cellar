export default defineNuxtRouteMiddleware(async (to) => {
  // Skip auth check for login page
  if (to.path === '/login') {
    return
  }

  const { user, isLoading, checkSession } = useAuth()

  // Check session if not already loaded
  if (isLoading.value && !user.value) {
    await checkSession()
  }

  // Redirect to login if not authenticated
  if (!user.value) {
    return navigateTo('/login')
  }
})
