<script setup lang="ts">
const { user, logout } = useAuth()
const route = useRoute()

const navigation = [
  { name: 'Home', path: '/', icon: 'home' },
  { name: 'Inventory', path: '/inventory', icon: 'wine' },
  { name: 'Cellars', path: '/cellars', icon: 'warehouse' },
  { name: 'Reports', path: '/reports', icon: 'chart' },
]

const isActive = (path: string) => {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Mobile header -->
    <header class="sticky top-0 z-10 bg-white border-b border-gray-200 lg:hidden">
      <div class="flex items-center justify-between px-4 h-14">
        <h1 class="text-lg font-semibold text-gray-900">Wine Cellar</h1>
        <button
          type="button"
          class="text-gray-500 hover:text-gray-700"
          @click="logout"
        >
          <span class="sr-only">Sign out</span>
          <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </header>

    <!-- Desktop sidebar -->
    <aside class="fixed inset-y-0 left-0 z-20 hidden w-64 bg-white border-r border-gray-200 lg:block">
      <div class="flex flex-col h-full">
        <div class="flex items-center h-16 px-6 border-b border-gray-200">
          <h1 class="text-xl font-bold text-wine-700">Wine Cellar</h1>
        </div>

        <nav class="flex-1 px-3 py-4 space-y-1">
          <NuxtLink
            v-for="item in navigation"
            :key="item.path"
            :to="item.path"
            class="flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors"
            :class="isActive(item.path)
              ? 'bg-wine-50 text-wine-700'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'"
          >
            {{ item.name }}
          </NuxtLink>
        </nav>

        <div class="p-4 border-t border-gray-200">
          <div class="flex items-center justify-between">
            <div class="text-sm">
              <p class="font-medium text-gray-900">{{ user?.name || user?.email }}</p>
            </div>
            <button
              type="button"
              class="text-gray-400 hover:text-gray-600"
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
    <nav class="fixed bottom-0 left-0 right-0 z-10 bg-white border-t border-gray-200 lg:hidden">
      <div class="grid h-16 grid-cols-4">
        <NuxtLink
          v-for="item in navigation"
          :key="item.path"
          :to="item.path"
          class="flex flex-col items-center justify-center text-xs"
          :class="isActive(item.path)
            ? 'text-wine-600'
            : 'text-gray-500'"
        >
          <span class="mt-1">{{ item.name }}</span>
        </NuxtLink>
      </div>
    </nav>

    <!-- Mobile bottom padding to account for bottom nav -->
    <div class="h-16 lg:hidden" />
  </div>
</template>
