<script setup lang="ts">
const { user, logout } = useAuth()
const route = useRoute()

const navigation = [
  { name: 'Home', path: '/', icon: 'home' },
  { name: 'Inventory', path: '/inventory', icon: 'wine' },
  { name: 'Producers', path: '/producers', icon: 'building' },
  { name: 'Cellars', path: '/cellars', icon: 'warehouse' },
  { name: 'Allocations', path: '/allocations', icon: 'calendar' },
  { name: 'Valuation', path: '/valuation', icon: 'currency' },
]

const isActive = (path: string) => {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}
</script>

<template>
  <div class="min-h-screen bg-muted-50">
    <!-- Mobile header -->
    <header class="sticky top-0 z-10 bg-white border-b-2 border-muted-200 lg:hidden">
      <div class="flex items-center justify-between px-4 h-14">
        <h1 class="text-lg font-bold text-primary">Wine Cellar</h1>
        <div class="flex items-center gap-3">
          <NuxtLink
            to="/profile"
            class="text-muted-500 hover:text-muted-700 hover:scale-110 transition-all duration-200"
          >
            <span class="sr-only">Profile</span>
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </NuxtLink>
          <button
            type="button"
            class="text-muted-500 hover:text-muted-700 hover:scale-110 transition-all duration-200"
            @click="logout"
          >
            <span class="sr-only">Sign out</span>
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </header>

    <!-- Desktop sidebar -->
    <aside class="fixed inset-y-0 left-0 z-20 hidden w-64 bg-white border-r-2 border-muted-200 lg:block">
      <div class="flex flex-col h-full">
        <div class="flex items-center h-16 px-6 border-b-2 border-muted-200">
          <h1 class="text-xl font-bold text-primary">Wine Cellar</h1>
        </div>

        <nav class="flex-1 px-3 py-4 space-y-1">
          <NuxtLink
            v-for="item in navigation"
            :key="item.path"
            :to="item.path"
            class="flex items-center px-3 py-2 text-sm font-semibold rounded-lg transition-all duration-200 hover:scale-102"
            :class="isActive(item.path)
              ? 'bg-primary-100 text-primary-700'
              : 'text-muted-600 hover:bg-muted-100 hover:text-muted-900'"
          >
            {{ item.name }}
          </NuxtLink>
        </nav>

        <div class="p-4 border-t-2 border-muted-200">
          <div class="flex items-center justify-between">
            <NuxtLink to="/profile" class="text-sm hover:text-primary transition-colors">
              <p class="font-semibold text-muted-900 hover:text-primary">{{ user?.name || user?.email }}</p>
            </NuxtLink>
            <button
              type="button"
              class="text-muted-400 hover:text-muted-600 hover:scale-110 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
              @click="logout"
            >
              <span class="sr-only">Sign out</span>
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </aside>

    <!-- Main content -->
    <main class="lg:pl-64">
      <div class="px-4 py-6 lg:px-8">
        <slot />
      </div>
    </main>

    <!-- Mobile bottom navigation -->
    <nav class="fixed bottom-0 left-0 right-0 z-10 bg-white border-t-2 border-muted-200 lg:hidden">
      <div class="grid h-16 grid-cols-6">
        <NuxtLink
          v-for="item in navigation"
          :key="item.path"
          :to="item.path"
          class="flex flex-col items-center justify-center text-xs font-semibold transition-all duration-200"
          :class="isActive(item.path)
            ? 'text-primary'
            : 'text-muted-500'"
        >
          <span class="mt-1">{{ item.name }}</span>
        </NuxtLink>
      </div>
    </nav>

    <!-- Mobile bottom padding to account for bottom nav -->
    <div class="h-16 lg:hidden" />
  </div>
</template>
