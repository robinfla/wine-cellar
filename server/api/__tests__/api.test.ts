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
      expect(Array.isArray(data)).toBe(true)
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
})
