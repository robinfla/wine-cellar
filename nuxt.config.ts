// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
    '@pinia/nuxt',
    '@nuxtjs/tailwindcss',
    '@vueuse/nuxt',
  ],

  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL || 'postgresql://wine:password@localhost:5432/wine_cellar',
    sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  },

  tailwindcss: {
    cssPath: '~/assets/css/main.css',
  },

  typescript: {
    strict: true,
  },

  // Enable auto-imports for composables
  imports: {
    dirs: ['composables', 'stores'],
  },

  // App configuration
  app: {
    head: {
      title: 'Wine Cellar',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1' },
        { name: 'description', content: 'Personal wine cellar management' },
      ],
    },
  },
})
