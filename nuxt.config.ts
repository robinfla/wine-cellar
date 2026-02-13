// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
    '@pinia/nuxt',
    '@nuxtjs/tailwindcss',
    '@vueuse/nuxt',
    '@nuxt/eslint',
    '@nuxtjs/i18n',
  ],

  i18n: {
    restructureDir: '',
    langDir: 'locales',
    defaultLocale: 'en',
    strategy: 'no_prefix',
    locales: [
      { code: 'en', file: 'en.json', name: 'English' },
      { code: 'fr', file: 'fr.json', name: 'French' },
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_locale',
      fallbackLocale: 'en',
    },
  },

  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL || 'postgresql://wine:password@localhost:5432/wine_cellar',
    sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
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

  nitro: {
    experimental: {
      tasks: true,
    },
    scheduledTasks: {
      '0 3 * * 0': ['valuations:update'],
    },
  },

  // App configuration
  app: {
    head: {
      title: 'Wine Cellar',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1' },
        { name: 'description', content: 'Personal wine cellar management' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap' },
      ],
    },
  },
})
