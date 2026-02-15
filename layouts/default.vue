<script setup lang="ts">
const { user, logout } = useAuth()
const { t, locale } = useI18n({ useScope: 'global' })
const route = useRoute()

const navigation = computed(() => [
  { name: t('nav.home'), path: '/', icon: 'home' },
  { name: t('nav.inventory'), path: '/inventory', icon: 'wine' },
  { name: t('nav.producers'), path: '/producers', icon: 'building' },
  { name: t('nav.cellars'), path: '/cellars', icon: 'warehouse' },
  { name: t('nav.allocations'), path: '/allocations', icon: 'calendar' },
  { name: t('nav.valuation'), path: '/valuation', icon: 'currency' },
  { name: t('nav.wishlist'), path: '/wishlist', icon: 'heart' },
  { name: t('nav.history'), path: '/history', icon: 'clock' },
])

const isActive = (path: string) => {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

const mobileMenuOpen = ref(false)

// Close mobile menu on route change
watch(() => route.path, () => {
  mobileMenuOpen.value = false
})

const toggleLocale = () => {
  locale.value = locale.value === 'en' ? 'fr' : 'en'
}
</script>

<template>
  <div class="min-h-screen bg-muted-50">
     <!-- Mobile header -->
     <header class="sticky top-0 z-30 bg-white border-b-2 border-muted-200 lg:hidden">
       <div class="flex items-center justify-between px-4 h-14">
         <button
           type="button"
           class="text-muted-600 hover:text-muted-900 transition-colors"
           @click="mobileMenuOpen = true"
         >
           <span class="sr-only">Open menu</span>
           <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
           </svg>
         </button>
         <NuxtLink to="/" class="text-lg font-bold text-primary">{{ $t('common.appName') }}</NuxtLink>
         <NuxtLink
           to="/profile"
           class="text-muted-500 hover:text-muted-700 transition-all"
         >
           <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
           </svg>
         </NuxtLink>
       </div>
     </header>

     <!-- Mobile sidebar overlay -->
     <Teleport to="body">
       <Transition
         enter-active-class="transition-opacity duration-300"
         enter-from-class="opacity-0"
         enter-to-class="opacity-100"
         leave-active-class="transition-opacity duration-300"
         leave-from-class="opacity-100"
         leave-to-class="opacity-0"
       >
         <div
           v-if="mobileMenuOpen"
           class="fixed inset-0 z-40 bg-black/50 lg:hidden"
           @click="mobileMenuOpen = false"
         />
       </Transition>
       <Transition
         enter-active-class="transition-transform duration-300 ease-out"
         enter-from-class="-translate-x-full"
         enter-to-class="translate-x-0"
         leave-active-class="transition-transform duration-300 ease-in"
         leave-from-class="translate-x-0"
         leave-to-class="-translate-x-full"
       >
         <aside
           v-if="mobileMenuOpen"
           class="fixed inset-y-0 left-0 z-50 w-72 bg-white border-r-2 border-muted-200 flex flex-col lg:hidden"
         >
           <div class="flex items-center justify-between h-14 px-4 border-b-2 border-muted-200">
             <NuxtLink to="/" class="text-lg font-bold text-primary" @click="mobileMenuOpen = false">{{ $t('common.appName') }}</NuxtLink>
             <button
               type="button"
               class="text-muted-400 hover:text-muted-600 transition-colors"
               @click="mobileMenuOpen = false"
             >
               <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
               </svg>
             </button>
           </div>
           <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
             <NuxtLink
               v-for="item in navigation"
               :key="item.path"
               :to="item.path"
               class="flex items-center px-3 py-3 text-sm font-semibold rounded-lg transition-all duration-200"
               :class="isActive(item.path)
                 ? 'bg-primary-100 text-primary-700'
                 : 'text-muted-600 hover:bg-muted-100 hover:text-muted-900'"
             >
               {{ item.name }}
             </NuxtLink>
           </nav>
           <div class="p-4 border-t-2 border-muted-200">
             <div class="flex items-center justify-between mb-3">
               <button
                 type="button"
                 class="text-xs font-semibold text-muted-500 hover:text-primary px-2 py-1 rounded transition-colors"
                 @click="toggleLocale"
               >
                 {{ locale === 'en' ? 'FR' : 'EN' }}
               </button>
             </div>
             <div class="flex items-center justify-between">
               <NuxtLink to="/profile" class="text-sm hover:text-primary transition-colors">
                 <p class="font-semibold text-muted-900 hover:text-primary">{{ user?.name || user?.email }}</p>
               </NuxtLink>
               <button
                 type="button"
                 class="text-muted-400 hover:text-muted-600 transition-all"
                 @click="logout"
               >
                 <span class="sr-only">{{ $t('common.signOut') }}</span>
                 <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                 </svg>
               </button>
             </div>
           </div>
         </aside>
       </Transition>
     </Teleport>

     <!-- Desktop sidebar -->
     <aside class="fixed inset-y-0 left-0 z-20 hidden w-64 bg-white border-r-2 border-muted-200 lg:block">
       <div class="flex flex-col h-full">
         <div class="flex items-center h-16 px-6 border-b-2 border-muted-200">
           <NuxtLink to="/" class="text-xl font-bold text-primary">{{ $t('common.appName') }}</NuxtLink>
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
           <div class="flex items-center justify-between mb-3">
             <button
               type="button"
               class="text-xs font-semibold text-muted-500 hover:text-primary px-2 py-1 rounded transition-colors"
               @click="toggleLocale"
             >
               {{ locale === 'en' ? 'FR' : 'EN' }}
             </button>
           </div>
           <div class="flex items-center justify-between">
             <NuxtLink to="/profile" class="text-sm hover:text-primary transition-colors">
               <p class="font-semibold text-muted-900 hover:text-primary">{{ user?.name || user?.email }}</p>
             </NuxtLink>
             <button
               type="button"
               class="text-muted-400 hover:text-muted-600 hover:scale-110 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
               @click="logout"
             >
               <span class="sr-only">{{ $t('common.signOut') }}</span>
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

    <!-- Bottom nav removed — mobile uses slide-out sidebar instead -->
  </div>
</template>
