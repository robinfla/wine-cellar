import { describe, it, expect } from 'vitest'
import { setup, $fetch } from '@nuxt/test-utils/e2e'

/**
 * SSR Smoke Tests — starts a real Nuxt server and fetches each page route.
 * Catches: undefined composables, Pinia serialization failures, broken templates.
 * Auth-protected pages redirect to /login (302) which is expected — 500 is not.
 */
describe('SSR smoke tests', async () => {
  await setup({
    server: true,
    build: true,
  })

  const publicPages = [
    { path: '/login', label: 'Login page' },
    { path: '/register', label: 'Register page' },
  ]

  const authProtectedPages = [
    { path: '/', label: 'Home page' },
    { path: '/inventory', label: 'Inventory page' },
    { path: '/inventory/add', label: 'Add wine page' },
    { path: '/inventory/import', label: 'Import page' },
    { path: '/cellars', label: 'Cellars page' },
    { path: '/producers', label: 'Producers page' },
    { path: '/allocations', label: 'Allocations page' },
    { path: '/valuation', label: 'Valuation page' },
    { path: '/history', label: 'History page' },
    { path: '/wishlist', label: 'Wishlist page' },
    { path: '/profile', label: 'Profile page' },
    { path: '/admin', label: 'Admin page' },
  ]

  describe('public pages render without errors', () => {
    publicPages.forEach(({ path, label }) => {
      it(`${label} (${path}) renders successfully`, async () => {
        const html = await $fetch<string>(path)
        expect(html).toBeDefined()
        expect(typeof html).toBe('string')
        expect(html.length).toBeGreaterThan(0)
        expect(html).not.toContain('__nuxt_error')
        expect(html).not.toContain('statusCode=500')
      })
    })
  })

  describe('auth-protected pages do not crash during SSR', () => {
    authProtectedPages.forEach(({ path, label }) => {
      it(`${label} (${path}) does not return a 500 error`, async () => {
        try {
          const html = await $fetch<string>(path, { redirect: 'manual' })
          if (typeof html === 'string') {
            expect(html).not.toContain('statusCode=500')
            expect(html).not.toContain('Server Error')
          }
        } catch (error: any) {
          // 302 (auth redirect) and 401 are acceptable; 500 means SSR crash
          const status = error?.response?.status || error?.statusCode
          expect(status, `${label} returned status ${status}`).not.toBe(500)
        }
      })
    })
  })

  describe('composable and serialization integrity', () => {
    it('useI18n is available in SSR context', async () => {
      const html = await $fetch<string>('/login')
      expect(html).not.toContain('useI18n is not defined')
      expect(html).not.toContain('is not a function')
    })

    it('Pinia state serializes without errors', async () => {
      const html = await $fetch<string>('/login')
      expect(html).not.toContain('hasOwnProperty is not a function')
    })

    it('i18n translations resolve (no raw keys rendered)', async () => {
      const html = await $fetch<string>('/login')
      expect(html).not.toContain('common.appName')
      expect(html).not.toContain('nav.home')
      expect(html).toContain('Wine Cellar')
    })
  })
})
