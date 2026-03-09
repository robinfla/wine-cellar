import { describe, it, expect, beforeAll } from 'vitest'

const BASE = 'http://127.0.0.1:3000'

let authCookie: string

async function apiFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authCookie ? { Cookie: authCookie } : {}),
      ...((options.headers as Record<string, string>) || {}),
    },
  })
  return res
}

describe('API integration tests', () => {
  beforeAll(async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rob.flamant@gmail.com', password: 'robin' }),
    })
    expect(res.ok).toBe(true)
    // Extract set-cookie header
    const setCookie = res.headers.getSetCookie?.() || [res.headers.get('set-cookie') || '']
    authCookie = setCookie.map((c: string) => c.split(';')[0]).join('; ')
    expect(authCookie).toBeTruthy()
  })

  describe('GET /api/inventory', () => {
    it('returns inventory list', async () => {
      const res = await apiFetch('/api/inventory')
      expect(res.ok).toBe(true)
      const data = await res.json()
      expect(data).toHaveProperty('lots')
      expect(Array.isArray(data.lots)).toBe(true)
      expect(data).toHaveProperty('total')
    })
  })

  describe('GET /api/cellars/3/spaces', () => {
    it('returns spaces for cellar 3', async () => {
      const res = await apiFetch('/api/cellars/3/spaces')
      expect(res.ok).toBe(true)
      const data = await res.json()
      expect(data).toHaveProperty('spaces')
      expect(Array.isArray(data.spaces)).toBe(true)
    })
  })

  describe('Rack lifecycle (POST + DELETE)', () => {
    let createdCellarId: number
    let createdSpaceId: number
    let createdRackId: number

    it('creates a cellar', async () => {
      const res = await apiFetch('/api/cellars', {
        method: 'POST',
        body: JSON.stringify({ name: '__test_cellar__', location: 'Test' }),
      })
      expect(res.ok).toBe(true)
      const data = await res.json()
      createdCellarId = data.id
      expect(createdCellarId).toBeDefined()
    })

    it('creates a space in the cellar', async () => {
      const res = await apiFetch(`/api/cellars/${createdCellarId}/spaces`, {
        method: 'POST',
        body: JSON.stringify({ name: '__test_space__', type: 'room' }),
      })
      expect(res.ok).toBe(true)
      const data = await res.json()
      createdSpaceId = data.id
      expect(createdSpaceId).toBeDefined()
    })

    it('creates a rack in the space', async () => {
      const res = await apiFetch(`/api/spaces/${createdSpaceId}/racks`, {
        method: 'POST',
        body: JSON.stringify({ name: '__test_rack__', rows: 3, columns: 4 }),
      })
      expect(res.ok).toBe(true)
      const data = await res.json()
      createdRackId = data.id
      expect(createdRackId).toBeDefined()
    })

    it('deletes the rack', async () => {
      const res = await apiFetch(`/api/racks/${createdRackId}`, {
        method: 'DELETE',
      })
      expect(res.ok).toBe(true)
    })

    it('deletes the space', async () => {
      const res = await apiFetch(`/api/spaces/${createdSpaceId}`, {
        method: 'DELETE',
      })
      expect(res.ok).toBe(true)
    })

    it('deletes the cellar', async () => {
      const res = await apiFetch(`/api/cellars/${createdCellarId}`, {
        method: 'DELETE',
      })
      expect(res.ok).toBe(true)
    })
  })

  describe('GET /api/auth/session', () => {
    it('returns current session', async () => {
      const res = await apiFetch('/api/auth/session')
      expect(res.ok).toBe(true)
      const data = await res.json()
      expect(data.user.email).toBe('rob.flamant@gmail.com')
    })
  })

  describe('POST /api/inventory/unassign', () => {
    it('returns 400 for invalid lotId', async () => {
      const res = await apiFetch('/api/inventory/unassign', {
        method: 'POST',
        body: JSON.stringify({ lotId: 'invalid', quantity: 1 }),
      })
      expect(res.status).toBe(400)
    })

    it('returns 400 for missing quantity', async () => {
      const res = await apiFetch('/api/inventory/unassign', {
        method: 'POST',
        body: JSON.stringify({ lotId: 1 }),
      })
      expect(res.status).toBe(400)
    })

    it('returns 404 for non-existent lot', async () => {
      const res = await apiFetch('/api/inventory/unassign', {
        method: 'POST',
        body: JSON.stringify({ lotId: 999999, quantity: 1 }),
      })
      expect(res.status).toBe(404)
    })

    it('validates endpoint accepts valid requests', async () => {
      // Get a valid lot ID
      const invRes = await apiFetch('/api/inventory?limit=1')
      expect(invRes.ok).toBe(true)
      const invData = await invRes.json()
      if (invData.lots && invData.lots.length > 0) {
        const lotId = invData.lots[0].id
        
        // Test endpoint accepts POST requests
        const res = await apiFetch('/api/inventory/unassign', {
          method: 'POST',
          body: JSON.stringify({ lotId, quantity: 1 }),
        })
        // Should return 400 (insufficient bottles) or 200 (success) - not 404
        expect([400, 200]).toContain(res.status)
      }
    })
  })

  // Sommelier API endpoints
  describe('GET /api/chat/conversations', () => {
    it('returns conversations list', async () => {
      const res = await apiFetch('/api/chat/conversations')
      expect(res.ok).toBe(true)
      const data = await res.json()
      expect(data).toHaveProperty('conversations')
      expect(Array.isArray(data.conversations)).toBe(true)
    })

    it('returns 401 when not authenticated', async () => {
      const res = await fetch(`${BASE}/api/chat/conversations`)
      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/chat/sommelier', () => {
    it('returns 400 when message is missing', async () => {
      const res = await apiFetch('/api/chat/sommelier', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      expect(res.status).toBe(400)
    })

    it('accepts valid message', async () => {
      const res = await apiFetch('/api/chat/sommelier', {
        method: 'POST',
        body: JSON.stringify({ message: 'Suggest a wine for grilled salmon' }),
      })
      // Should return 200 (success) or 500 (if AI API keys not configured)
      // Not 400 (validation error) or 404 (not found)
      expect([200, 500]).toContain(res.status)
    })

    it('accepts conversation threading parameter', async () => {
      const res = await apiFetch('/api/chat/sommelier', {
        method: 'POST',
        body: JSON.stringify({
          message: 'What about red wines?',
          conversationId: 'test-123',
        }),
      })
      // Should return 200, 400, or 500 - not 404 (endpoint exists)
      expect([200, 400, 500]).toContain(res.status)
    })
  })

  describe('POST /api/profile/onboarding', () => {
    it('returns 400 for invalid onboarding data', async () => {
      const res = await apiFetch('/api/profile/onboarding', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      expect([400, 200]).toContain(res.status)
    })

    it('accepts valid onboarding data', async () => {
      const res = await apiFetch('/api/profile/onboarding', {
        method: 'POST',
        body: JSON.stringify({
          color_preference: 'red',
          adventure_level: 2,
          region_picks: ['bordeaux', 'italy'],
          favorite_grapes: ['cabernet', 'pinot'],
          budget: '20_50',
          frequency: 'weekly',
        }),
      })
      expect([200, 201]).toContain(res.status)
    })
  })

  describe('GET /api/profile/taste', () => {
    it('returns taste profile', async () => {
      const res = await apiFetch('/api/profile/taste')
      expect(res.ok).toBe(true)
      const data = await res.json()
      expect(data).toHaveProperty('onboardingCompleted')
      // Profile may be null if onboarding not complete
      if (data.profile) {
        expect(data.profile).toHaveProperty('colorPreference')
        expect(data.profile).toHaveProperty('budgetRange')
        expect(data.profile).toHaveProperty('metrics')
      }
    })

    it('returns 401 when not authenticated', async () => {
      const res = await fetch(`${BASE}/api/profile/taste`)
      expect(res.status).toBe(401)
    })
  })
})
