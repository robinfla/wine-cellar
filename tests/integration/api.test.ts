import { describe, it, expect, beforeAll } from 'vitest'

const BASE = 'http://127.0.0.1:3000'

async function api(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts.headers },
  })
  const body = await res.json().catch(() => null)
  return { status: res.status, body, headers: res.headers }
}

describe('API Integration Tests', () => {
  let sessionToken: string
  let cellarId: number
  let spaceId: number
  let gridRackId: number
  let binRackId: number

  // ─── Auth ─────────────────────────────────────────────
  describe('POST /api/auth/login', () => {
    it('rejects invalid credentials', async () => {
      const { status } = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'nobody@example.com', password: 'wrong' }),
      })
      expect(status).toBe(401)
    })

    it('accepts valid credentials and returns token', async () => {
      const { status, body } = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'rob.flamant@gmail.com', password: 'robin' }),
      })
      expect(status).toBe(200)
      expect(body.token).toBeDefined()
      expect(body.user.email).toBe('rob.flamant@gmail.com')
      sessionToken = body.token
    })

    it('rejects malformed input', async () => {
      const { status } = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'not-an-email', password: '' }),
      })
      expect(status).toBe(400)
    })
  })

  // Helper for authenticated requests
  function authed(path: string, opts: RequestInit = {}) {
    return api(path, {
      ...opts,
      headers: { Cookie: `wine_session=${sessionToken}`, ...opts.headers },
    })
  }

  // ─── Inventory ────────────────────────────────────────
  describe('GET /api/inventory', () => {
    it('requires auth', async () => {
      const { status } = await api('/api/inventory')
      expect(status).toBe(401)
    })

    it('returns lots with correct structure', async () => {
      const { status, body } = await authed('/api/inventory')
      expect(status).toBe(200)
      expect(body.lots).toBeDefined()
      expect(Array.isArray(body.lots)).toBe(true)
      if (body.lots.length > 0) {
        const lot = body.lots[0]
        expect(lot).toHaveProperty('id')
        expect(lot).toHaveProperty('quantity')
        // Wine data is joined flat (wineName, wineId, etc.)
        expect(lot).toHaveProperty('wineId')
      }
    })
  })

  // ─── Cellars & Spaces ────────────────────────────────
  describe('Cellars and Spaces', () => {
    it('GET /api/cellars — lists cellars', async () => {
      const { status, body } = await authed('/api/cellars')
      expect(status).toBe(200)
      expect(Array.isArray(body)).toBe(true)
      expect(body.length).toBeGreaterThan(0)
      cellarId = body[0].id
    })

    it('GET /api/cellars/:id/spaces — returns spaces with fill counts', async () => {
      // Find a cellar that has spaces
      const { body: cellars } = await authed('/api/cellars')
      for (const c of cellars) {
        const { status, body } = await authed(`/api/cellars/${c.id}/spaces`)
        expect(status).toBe(200)
        expect(body).toHaveProperty('spaces')
        expect(Array.isArray(body.spaces)).toBe(true)
        if (body.spaces.length > 0) {
          const space = body.spaces[0]
          expect(space).toHaveProperty('id')
          expect(space).toHaveProperty('name')
          spaceId = space.id
          cellarId = c.id
          break
        }
      }
      expect(spaceId).toBeDefined()
    })
  })

  // ─── Racks ───────────────────────────────────────────
  describe('Racks CRUD', () => {
    it('GET /api/spaces/:id/racks — returns racks with slots/bottles', async () => {
      if (!spaceId) return
      const { status, body } = await authed(`/api/spaces/${spaceId}/racks`)
      expect(status).toBe(200)
      expect(body).toHaveProperty('racks')
      expect(Array.isArray(body.racks)).toBe(true)
      expect(body).toHaveProperty('walls')
      expect(body).toHaveProperty('space')
    })

    it('POST /api/spaces/:id/racks — create grid rack', async () => {
      if (!spaceId) return
      const { status, body } = await authed(`/api/spaces/${spaceId}/racks`, {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Grid Rack',
          type: 'grid',
          rows: 3,
          columns: 4,
        }),
      })
      expect(status).toBe(200)
      expect(body.id).toBeDefined()
      gridRackId = body.id
    })

    it('POST /api/spaces/:id/racks — create bin rack', async () => {
      if (!spaceId) return
      const { status, body } = await authed(`/api/spaces/${spaceId}/racks`, {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Bin Rack',
          type: 'bin',
          columns: 2,
          rows: 1,
          capacity: 6,
        }),
      })
      expect(status).toBe(200)
      expect(body.id).toBeDefined()
      binRackId = body.id
    })

    it('PATCH /api/racks/:id/labels — update bin labels and rack name', async () => {
      if (!binRackId) return
      const { status } = await authed(`/api/racks/${binRackId}/labels`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: 'Renamed Bin Rack',
          binLabels: { '1-1': 'Bin A', '1-2': 'Bin B' },
        }),
      })
      expect(status).toBe(200)
    })

    it('POST /api/racks/:id/bins/add — add bottle to bin', async () => {
      if (!binRackId) return
      // Get inventory to find a lot
      const { body: inv } = await authed('/api/inventory')
      if (!inv.lots || inv.lots.length === 0) return

      const lotId = inv.lots[0].id
      const { status } = await authed(`/api/racks/${binRackId}/bins/add`, {
        method: 'POST',
        body: JSON.stringify({ inventoryLotId: lotId, binRow: 1, binColumn: 1 }),
      })
      expect([200, 400, 404]).toContain(status)
    })

    it('POST /api/racks/:id/bins/remove — remove bottle from bin', async () => {
      if (!binRackId) return
      const { status } = await authed(`/api/racks/${binRackId}/bins/remove`, {
        method: 'POST',
        body: JSON.stringify({ binRow: 1, binColumn: 1 }),
      })
      expect([200, 400, 404]).toContain(status)
    })

    it('DELETE /api/racks/:id — delete grid rack', async () => {
      if (!gridRackId) return
      const { status } = await authed(`/api/racks/${gridRackId}`, { method: 'DELETE' })
      expect(status).toBe(200)
    })

    it('DELETE /api/racks/:id — delete bin rack', async () => {
      if (!binRackId) return
      const { status } = await authed(`/api/racks/${binRackId}`, { method: 'DELETE' })
      expect(status).toBe(200)
    })
  })
})
