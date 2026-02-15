import { describe, it, expect } from 'vitest'
import { setup, $fetch } from '@nuxt/test-utils/e2e'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Feature Regression Tests
 *
 * Prevents features from silently disappearing across commits.
 * Tests three layers:
 *   1. File existence — every page, component, API route, composable exists on disk
 *   2. SSR rendering — pages render expected content markers (not just "no 500")
 *   3. Navigation — sidebar links to all sections are present in the layout
 *
 * If any of these tests fail, a feature has regressed and must be restored
 * before the commit is accepted.
 */

const root = resolve(__dirname, '../..')

// ─── 1. FILE EXISTENCE ──────────────────────────────────────────────────────
// These are the files that MUST exist for every implemented feature.
// If a file is missing, the feature is broken.

describe('feature file existence', () => {
  const requiredPages = [
    // Core pages
    { file: 'pages/index.vue', feature: 'Home / Dashboard' },
    { file: 'pages/login.vue', feature: 'Login' },
    { file: 'pages/register.vue', feature: 'Register' },
    { file: 'pages/profile.vue', feature: 'Profile' },
    { file: 'pages/admin.vue', feature: 'Admin panel' },

    // Inventory
    { file: 'pages/inventory/index.vue', feature: 'Inventory list' },
    { file: 'pages/inventory/add.vue', feature: 'Add wine' },
    { file: 'pages/inventory/import.vue', feature: 'CSV import' },

    // Cellars
    { file: 'pages/cellars/index.vue', feature: 'Cellar list' },
    { file: 'pages/cellars/[id].vue', feature: 'Cellar detail' },

    // Producers
    { file: 'pages/producers.vue', feature: 'Producers' },

    // Allocations
    { file: 'pages/allocations/index.vue', feature: 'Allocations' },

    // Valuation
    { file: 'pages/valuation/index.vue', feature: 'Valuation' },

    // ── Features that have regressed before ──
    { file: 'pages/history.vue', feature: 'History log' },
    { file: 'pages/wishlist.vue', feature: 'Wishlist' },
  ]

  const requiredComponents = [
    { file: 'components/AddWineModal.vue', feature: 'Add wine modal' },
    { file: 'components/CreateCellarModal.vue', feature: 'Create cellar modal' },
    { file: 'components/PairingChatModal.vue', feature: 'AI pairing chat' },
    { file: 'components/CellarLayoutBuilder.vue', feature: 'Cellar layout builder' },
    { file: 'components/CellarLayoutView.vue', feature: 'Cellar layout view' },
    { file: 'components/AllocationTimeline.vue', feature: 'Allocation timeline' },
    { file: 'components/GrapeMultiSelect.vue', feature: 'Grape multi-select' },
    { file: 'components/Toast.vue', feature: 'Toast notifications' },
  ]

  const requiredLayouts = [
    { file: 'layouts/default.vue', feature: 'Default layout with sidebar nav' },
  ]

  const requiredComposables = [
    { file: 'composables/useAuth.ts', feature: 'Auth composable' },
  ]

  const requiredApiRoutes = [
    // Auth
    { file: 'server/api/auth/login.post.ts', feature: 'Login API' },
    { file: 'server/api/auth/register.post.ts', feature: 'Register API' },
    { file: 'server/api/auth/session.get.ts', feature: 'Session API' },
    { file: 'server/api/auth/logout.post.ts', feature: 'Logout API' },

    // Inventory
    { file: 'server/api/inventory/index.get.ts', feature: 'Get inventory' },
    { file: 'server/api/inventory/index.post.ts', feature: 'Add to inventory' },
    { file: 'server/api/inventory/events.get.ts', feature: 'History events API' },
    { file: 'server/api/inventory/[id]/consume.post.ts', feature: 'Consume wine API' },
    { file: 'server/api/inventory/export.get.ts', feature: 'Export inventory' },
    { file: 'server/api/inventory/filters.get.ts', feature: 'Inventory filters' },

    // Wishlist
    { file: 'server/api/wishlist/index.get.ts', feature: 'Get wishlist' },
    { file: 'server/api/wishlist/index.post.ts', feature: 'Add to wishlist' },
    { file: 'server/api/wishlist/[id].delete.ts', feature: 'Delete wishlist item' },

    // Critic scores
    { file: 'server/api/wines/[wineId]/critic-scores.get.ts', feature: 'Get critic scores' },
    { file: 'server/api/wines/[wineId]/critic-scores.post.ts', feature: 'Add critic score' },
    { file: 'server/api/critic-scores/fetch.post.ts', feature: 'Fetch critic scores from web' },
    { file: 'server/api/critic-scores/[id].delete.ts', feature: 'Delete critic score' },

    // AI features
    { file: 'server/api/wines/parse.post.ts', feature: 'AI wine parsing' },
    { file: 'server/api/chat/pairing.post.ts', feature: 'AI pairing chat' },

    // Cellars
    { file: 'server/api/cellars/index.get.ts', feature: 'Get cellars' },
    { file: 'server/api/cellars/index.post.ts', feature: 'Create cellar' },

    // Valuations
    { file: 'server/api/valuations/index.get.ts', feature: 'Get valuations' },
    { file: 'server/api/valuations/fetch.post.ts', feature: 'Fetch valuations' },

    // Allocations
    { file: 'server/api/allocations/index.get.ts', feature: 'Get allocations' },
    { file: 'server/api/allocations/index.post.ts', feature: 'Create allocation' },
    { file: 'server/api/allocations/timeline.get.ts', feature: 'Allocation timeline' },
  ]

  const requiredI18n = [
    { file: 'locales/en.json', feature: 'English translations' },
    { file: 'locales/fr.json', feature: 'French translations' },
  ]

  const allFiles = [
    ...requiredPages,
    ...requiredComponents,
    ...requiredLayouts,
    ...requiredComposables,
    ...requiredApiRoutes,
    ...requiredI18n,
  ]

  allFiles.forEach(({ file, feature }) => {
    it(`[${feature}] file exists: ${file}`, () => {
      const fullPath = resolve(root, file)
      expect(existsSync(fullPath), `Missing file for feature "${feature}": ${file}`).toBe(true)
    })
  })
})


// ─── 2. SSR RENDERING WITH CONTENT VERIFICATION ─────────────────────────────
// Each page must render expected content markers — not just "status 200".

describe('SSR feature content verification', async () => {
  await setup({
    server: true,
    build: true,
  })

  // Public pages: verify actual rendered content
  describe('public pages render feature content', () => {
    it('Login page shows translated auth form', async () => {
      const html = await $fetch<string>('/login')
      // Must contain translated text, not raw i18n keys
      expect(html).toContain('Wine Cellar')
      expect(html).not.toContain('common.appName')
      // Must contain form fields
      expect(html).toContain('type="email"')
      expect(html).toContain('type="password"')
      // Must contain translated labels (not raw keys)
      expect(html).not.toContain('auth.email')
      expect(html).not.toContain('auth.password')
      expect(html).not.toContain('auth.signIn')
    })

    it('Register page shows registration form', async () => {
      const html = await $fetch<string>('/register')
      expect(html).toContain('Wine Cellar')
      expect(html).toContain('type="email"')
      expect(html).toContain('type="password"')
      expect(html).not.toContain('auth.createAccount')
    })
  })

  // Auth-protected pages: verify they redirect (302) or render without crashing (500)
  describe('auth-protected pages do not crash', () => {
    const protectedPages = [
      { path: '/', label: 'Home/Dashboard' },
      { path: '/inventory', label: 'Inventory' },
      { path: '/inventory/add', label: 'Add wine' },
      { path: '/inventory/import', label: 'CSV import' },
      { path: '/cellars', label: 'Cellars' },
      { path: '/producers', label: 'Producers' },
      { path: '/allocations', label: 'Allocations' },
      { path: '/valuation', label: 'Valuation' },
      { path: '/history', label: 'History log' },
      { path: '/wishlist', label: 'Wishlist' },
      { path: '/profile', label: 'Profile' },
      { path: '/admin', label: 'Admin panel' },
    ]

    protectedPages.forEach(({ path, label }) => {
      it(`${label} (${path}) does not 500`, async () => {
        try {
          const html = await $fetch<string>(path, { redirect: 'manual' })
          if (typeof html === 'string') {
            expect(html).not.toContain('statusCode=500')
            expect(html).not.toContain('Server Error')
          }
        } catch (error: any) {
          const status = error?.response?.status || error?.statusCode
          expect(status, `${label} returned ${status}`).not.toBe(500)
        }
      })
    })
  })

  // i18n: verify both languages load
  describe('i18n translations load correctly', () => {
    it('English translations render on login page', async () => {
      const html = await $fetch<string>('/login')
      // These are actual English translation values from en.json
      expect(html).toContain('Wine Cellar')
      expect(html).toContain('Email')
      expect(html).toContain('Password')
    })

    it('French translations render when cookie is set', async () => {
      const html = await $fetch<string>('/login', {
        headers: { Cookie: 'i18n_locale=fr' },
      })
      // These are actual French translation values from fr.json
      expect(html).toContain('Mot de passe')
    })

    it('No raw i18n keys leak into rendered HTML', async () => {
      const html = await $fetch<string>('/login')
      // Common keys that would leak if translations are broken
      const rawKeys = [
        'common.appName',
        'common.loading',
        'auth.email',
        'auth.password',
        'auth.signIn',
        'auth.signUp',
        'nav.home',
        'nav.inventory',
      ]
      rawKeys.forEach((key) => {
        expect(html, `Raw i18n key leaked: ${key}`).not.toContain(key)
      })
    })
  })
})


// ─── 3. NAVIGATION LINKS ────────────────────────────────────────────────────
// The default layout must contain nav links to ALL feature sections.
// This is a static file check (does not require SSR) to catch layout rewrites.

describe('navigation links in default layout', () => {
  it('default layout contains all required nav paths', async () => {
    const fs = await import('node:fs/promises')
    const layoutContent = await fs.readFile(resolve(root, 'layouts/default.vue'), 'utf-8')

    const requiredNavPaths = [
      { path: '/', feature: 'Home' },
      { path: '/inventory', feature: 'Inventory' },
      { path: '/producers', feature: 'Producers' },
      { path: '/cellars', feature: 'Cellars' },
      { path: '/allocations', feature: 'Allocations' },
      { path: '/valuation', feature: 'Valuation' },
      { path: '/wishlist', feature: 'Wishlist' },
      { path: '/history', feature: 'History' },
    ]

    requiredNavPaths.forEach(({ path, feature }) => {
      expect(
        layoutContent,
        `Missing nav link to "${feature}" (${path}) in default layout`,
      ).toContain(path)
    })
  })

  it('default layout contains language switcher', async () => {
    const fs = await import('node:fs/promises')
    const layoutContent = await fs.readFile(resolve(root, 'layouts/default.vue'), 'utf-8')

    expect(layoutContent).toContain('toggleLocale')
    expect(layoutContent).toContain('locale')
  })

  it('default layout contains logout button', async () => {
    const fs = await import('node:fs/promises')
    const layoutContent = await fs.readFile(resolve(root, 'layouts/default.vue'), 'utf-8')

    expect(layoutContent).toContain('logout')
  })
})


// ─── 4. PAGE FEATURE MARKERS (static file checks) ───────────────────────────
// Verify each page contains the expected feature-specific code/templates.
// This catches cases where a page file exists but its content was gutted.

describe('page feature markers (static content checks)', () => {
  const readFile = async (relPath: string) => {
    const fs = await import('node:fs/promises')
    return fs.readFile(resolve(root, relPath), 'utf-8')
  }

  describe('Home page (pages/index.vue)', () => {
    it('contains consume wine search CTA', async () => {
      const content = await readFile('pages/index.vue')
      expect(content).toContain('consumeSearchQuery')
      expect(content).toContain('selectWineToConsume')
    })

    it('contains add wine with AI CTA', async () => {
      const content = await readFile('pages/index.vue')
      expect(content).toContain('handleAiAdd')
      expect(content).toContain('/api/wines/parse')
    })

    it('contains stats dashboard', async () => {
      const content = await readFile('pages/index.vue')
      expect(content).toContain('/api/reports/stats')
      expect(content).toContain('totalBottles')
    })

    it('contains manual add wine link', async () => {
      const content = await readFile('pages/index.vue')
      expect(content).toContain('/inventory/add')
    })
  })

  describe('History page (pages/history.vue)', () => {
    it('contains event timeline with filters', async () => {
      const content = await readFile('pages/history.vue')
      expect(content).toContain('/api/inventory/events')
      expect(content).toContain('eventTypeFilter')
    })

    it('contains event type tabs (purchase, consume, gift, etc.)', async () => {
      const content = await readFile('pages/history.vue')
      expect(content).toContain('purchase')
      expect(content).toContain('consume')
      expect(content).toContain('gift')
      expect(content).toContain('transfer')
    })

    it('contains pagination', async () => {
      const content = await readFile('pages/history.vue')
      expect(content).toContain('totalPages')
      expect(content).toContain('canPrev')
      expect(content).toContain('canNext')
    })
  })

  describe('Wishlist page (pages/wishlist.vue)', () => {
    it('contains wishlist API integration', async () => {
      const content = await readFile('pages/wishlist.vue')
      expect(content).toContain('/api/wishlist')
    })

    it('contains wine and producer types', async () => {
      const content = await readFile('pages/wishlist.vue')
      expect(content).toContain("'wine'")
      expect(content).toContain("'producer'")
    })

    it('contains add modal with type-specific fields', async () => {
      const content = await readFile('pages/wishlist.vue')
      expect(content).toContain('showModal')
      expect(content).toContain('addItem')
      // Producer-specific fields
      expect(content).toContain('winesOfInterest')
      expect(content).toContain('regionId')
      // Wine-specific fields
      expect(content).toContain('priceTarget')
      expect(content).toContain('vintage')
    })

    it('contains delete functionality', async () => {
      const content = await readFile('pages/wishlist.vue')
      expect(content).toContain('deleteItem')
      expect(content).toContain('deletingId')
    })
  })

  describe('Inventory page (pages/inventory/index.vue)', () => {
    it('contains inventory list with filters', async () => {
      const content = await readFile('pages/inventory/index.vue')
      expect(content).toContain('/api/inventory')
      expect(content).toContain('showFilters')
    })

    it('contains tasting notes feature', async () => {
      const content = await readFile('pages/inventory/index.vue')
      expect(content).toContain('tastingNotes')
      expect(content).toContain('newTastingNote')
    })

    it('contains add wine modal integration', async () => {
      const content = await readFile('pages/inventory/index.vue')
      expect(content).toContain('showAddWineModal')
      expect(content).toContain('AddWineModal')
    })

    it('contains market valuation feature', async () => {
      const content = await readFile('pages/inventory/index.vue')
      expect(content).toContain('valuation')
      expect(content).toContain('isFetchingValuation')
    })
  })

  describe('Cellars page (pages/cellars/index.vue)', () => {
    it('contains cellar list', async () => {
      const content = await readFile('pages/cellars/index.vue')
      expect(content).toContain('/api/cellars')
    })
  })

  describe('Allocations page (pages/allocations/index.vue)', () => {
    it('contains allocations list', async () => {
      const content = await readFile('pages/allocations/index.vue')
      expect(content).toContain('/api/allocations')
    })
  })

  describe('Valuation page (pages/valuation/index.vue)', () => {
    it('contains valuation data', async () => {
      const content = await readFile('pages/valuation/index.vue')
      expect(content).toContain('/api/valuations')
    })
  })
})


// ─── 5. API ROUTE CONTENT CHECKS ────────────────────────────────────────────
// Verify key API files contain expected logic, not just empty stubs.

describe('API route content checks', () => {
  const readFile = async (relPath: string) => {
    const fs = await import('node:fs/promises')
    return fs.readFile(resolve(root, relPath), 'utf-8')
  }

  it('history events API queries inventoryEvents', async () => {
    const content = await readFile('server/api/inventory/events.get.ts')
    expect(content).toContain('inventoryEvents')
  })

  it('wishlist GET API queries wishlist table', async () => {
    const content = await readFile('server/api/wishlist/index.get.ts')
    expect(content).toContain('wishlist')
  })

  it('wishlist POST API inserts into wishlist', async () => {
    const content = await readFile('server/api/wishlist/index.post.ts')
    expect(content).toContain('wishlist')
  })

  it('critic scores GET API queries wineCriticScores', async () => {
    const content = await readFile('server/api/wines/[wineId]/critic-scores.get.ts')
    expect(content).toContain('wineCriticScores')
  })

  it('AI wine parsing API calls Anthropic', async () => {
    const content = await readFile('server/api/wines/parse.post.ts')
    expect(content).toMatch(/anthropic|Anthropic|claude/i)
  })

  it('AI pairing chat API calls Anthropic', async () => {
    const content = await readFile('server/api/chat/pairing.post.ts')
    expect(content).toMatch(/anthropic|Anthropic|claude/i)
  })
})


// ─── 6. I18N COMPLETENESS ───────────────────────────────────────────────────
// Both locale files must contain keys for every feature section.

describe('i18n key completeness', () => {
  const readJson = async (relPath: string) => {
    const fs = await import('node:fs/promises')
    const raw = await fs.readFile(resolve(root, relPath), 'utf-8')
    return JSON.parse(raw)
  }

  const requiredSections = [
    'common',
    'auth',
    'nav',
    'home',
    'inventory',
    'history',
    'wishlist',
    'cellars',
    'allocations',
    'valuation',
  ]

  it('en.json contains all required sections', async () => {
    const en = await readJson('locales/en.json')
    requiredSections.forEach((section) => {
      expect(en, `Missing section "${section}" in en.json`).toHaveProperty(section)
      expect(Object.keys(en[section]).length, `Section "${section}" in en.json is empty`).toBeGreaterThan(0)
    })
  })

  it('fr.json contains all required sections', async () => {
    const fr = await readJson('locales/fr.json')
    requiredSections.forEach((section) => {
      expect(fr, `Missing section "${section}" in fr.json`).toHaveProperty(section)
      expect(Object.keys(fr[section]).length, `Section "${section}" in fr.json is empty`).toBeGreaterThan(0)
    })
  })

  it('en.json and fr.json have matching top-level keys', async () => {
    const en = await readJson('locales/en.json')
    const fr = await readJson('locales/fr.json')
    const enKeys = Object.keys(en).sort()
    const frKeys = Object.keys(fr).sort()
    expect(frKeys, 'fr.json is missing top-level sections present in en.json').toEqual(enKeys)
  })
})
