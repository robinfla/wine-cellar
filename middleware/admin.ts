export default defineNuxtRouteMiddleware(() => {
  const { isAuthenticated, isAdmin } = useAuth()

  if (!isAuthenticated.value) {
    return navigateTo('/login')
  }

  if (!isAdmin.value) {
    return navigateTo('/')
  }
})
