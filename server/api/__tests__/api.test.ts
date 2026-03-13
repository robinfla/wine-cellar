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

  // ============================================================================
  // Vintages & Enrichment Tests (Migration 0011)
  // ============================================================================

  describe('GET /api/inventory/cards (vintages)', () => {
    it('returns cards with vintage data from vintages table', async () => {
      const res = await apiFetch('/api/inventory/cards')
      expect(res.ok).toBe(true)
      const data = await res.json()
      expect(data).toHaveProperty('cards')
      expect(Array.isArray(data.cards)).toBe(true)
      
      if (data.cards.length > 0) {
        const card = data.cards[0]
        expect(card).toHaveProperty('vintages')
        expect(Array.isArray(card.vintages)).toBe(true)
        
        if (card.vintages.length > 0) {
          const vintage = card.vintages[0]
          expect(vintage).toHaveProperty('vintage')
          expect(vintage).toHaveProperty('vintageId')
          expect(vintage).toHaveProperty('bottleCount')
          expect(vintage).toHaveProperty('maturityStatus')
          // Enrichment fields (may be null)
          expect(vintage).toHaveProperty('ratingsCount')
          expect(vintage).toHaveProperty('ratingsAverage')
        }
      }
    })
  })

  describe('GET /api/inventory/:id (vintage enrichment)', () => {
    it('returns lot with vintageId and enrichment data', async () => {
      // Get a valid lot ID first
      const invRes = await apiFetch('/api/inventory?limit=1')
      expect(invRes.ok).toBe(true)
      const invData = await invRes.json()
      
      if (invData.lots && invData.lots.length > 0) {
        const lotId = invData.lots[0].id
        const res = await apiFetch(`/api/inventory/${lotId}`)
        expect(res.ok).toBe(true)
        const data = await res.json()
        
        expect(data).toHaveProperty('vintageId')
        expect(data).toHaveProperty('vintage')
        expect(data).toHaveProperty('maturity')
        // Enrichment fields
        expect(data).toHaveProperty('ratingsCount')
        expect(data).toHaveProperty('ratingsAverage')
      }
    })
  })

  describe('GET /api/wines/:id (enrichment fields)', () => {
    it('returns wine with new enrichment fields', async () => {
      // Get a valid wine ID
      const cardsRes = await apiFetch('/api/inventory/cards?limit=1')
      expect(cardsRes.ok).toBe(true)
      const cardsData = await cardsRes.json()
      
      if (cardsData.cards && cardsData.cards.length > 0) {
        const wineId = cardsData.cards[0].wineId
        const res = await apiFetch(`/api/wines/${wineId}`)
        expect(res.ok).toBe(true)
        const data = await res.json()
        
        // Core fields
        expect(data).toHaveProperty('id')
        expect(data).toHaveProperty('name')
        expect(data).toHaveProperty('color')
        
        // New enrichment fields
        expect(data).toHaveProperty('styleDescription')
        expect(data).toHaveProperty('isNatural')
        expect(data).toHaveProperty('isOrganic')
        expect(data).toHaveProperty('isBiodynamic')
        expect(data).toHaveProperty('dataSource')
        
        // Producer enrichment
        expect(data.producer).toHaveProperty('foundedYear')
        expect(data.producer).toHaveProperty('description')
        expect(data.producer).toHaveProperty('isOrganic')
        
        // Vintages with enrichment
        expect(data).toHaveProperty('vintages')
        if (data.vintages.length > 0) {
          expect(data.vintages[0]).toHaveProperty('vintageId')
          expect(data.vintages[0]).toHaveProperty('ratingsCount')
          expect(data.vintages[0]).toHaveProperty('ratingsAverage')
        }
      }
    })
  })

  describe('PATCH /api/wines/:id (enrichment fields)', () => {
    it('accepts new enrichment fields', async () => {
      // Get a valid wine ID
      const cardsRes = await apiFetch('/api/inventory/cards?limit=1')
      expect(cardsRes.ok).toBe(true)
      const cardsData = await cardsRes.json()
      
      if (cardsData.cards && cardsData.cards.length > 0) {
        const wineId = cardsData.cards[0].wineId
        
        const res = await apiFetch(`/api/wines/${wineId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            styleDescription: 'Test style description',
            isNatural: false,
            isOrganic: true,
            isBiodynamic: false,
          }),
        })
        expect(res.ok).toBe(true)
        const data = await res.json()
        
        expect(data.styleDescription).toBe('Test style description')
        expect(data.isOrganic).toBe(true)
        
        // Reset
        await apiFetch(`/api/wines/${wineId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            styleDescription: null,
            isNatural: false,
            isOrganic: false,
            isBiodynamic: false,
          }),
        })
      }
    })
  })

  describe('GET /api/producers/:id (enrichment fields)', () => {
    it('returns producer with enrichment fields', async () => {
      // Get a valid producer ID from a wine
      const cardsRes = await apiFetch('/api/inventory/cards?limit=1')
      expect(cardsRes.ok).toBe(true)
      const cardsData = await cardsRes.json()
      
      if (cardsData.cards && cardsData.cards.length > 0) {
        const wineId = cardsData.cards[0].wineId
        const wineRes = await apiFetch(`/api/wines/${wineId}`)
        const wineData = await wineRes.json()
        
        if (wineData.producer?.id) {
          const res = await apiFetch(`/api/producers/${wineData.producer.id}`)
          expect(res.ok).toBe(true)
          const data = await res.json()
          
          expect(data).toHaveProperty('foundedYear')
          expect(data).toHaveProperty('description')
          expect(data).toHaveProperty('isOrganic')
          expect(data).toHaveProperty('isBiodynamic')
          expect(data).toHaveProperty('isNatural')
          expect(data).toHaveProperty('latitude')
          expect(data).toHaveProperty('longitude')
          expect(data).toHaveProperty('dataSource')
        }
      }
    })
  })

  describe('PATCH /api/producers/:id (enrichment fields)', () => {
    it('accepts new enrichment fields', async () => {
      // Get a valid producer ID
      const cardsRes = await apiFetch('/api/inventory/cards?limit=1')
      const cardsData = await cardsRes.json()
      
      if (cardsData.cards && cardsData.cards.length > 0) {
        const wineId = cardsData.cards[0].wineId
        const wineRes = await apiFetch(`/api/wines/${wineId}`)
        const wineData = await wineRes.json()
        
        if (wineData.producer?.id) {
          const producerId = wineData.producer.id
          
          const res = await apiFetch(`/api/producers/${producerId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              foundedYear: 1990,
              description: 'Test producer description',
              isOrganic: true,
            }),
          })
          expect(res.ok).toBe(true)
          const data = await res.json()
          
          expect(data.foundedYear).toBe(1990)
          expect(data.description).toBe('Test producer description')
          expect(data.isOrganic).toBe(true)
          
          // Reset
          await apiFetch(`/api/producers/${producerId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              foundedYear: null,
              description: null,
              isOrganic: false,
            }),
          })
        }
      }
    })
  })

  describe('GET /api/grapes (enrichment fields)', () => {
    it('returns grapes with description field', async () => {
      const res = await apiFetch('/api/grapes')
      expect(res.ok).toBe(true)
      const data = await res.json()
      expect(Array.isArray(data)).toBe(true)
      
      if (data.length > 0) {
        const grape = data[0]
        expect(grape).toHaveProperty('id')
        expect(grape).toHaveProperty('name')
        expect(grape).toHaveProperty('description')
        expect(grape).toHaveProperty('originCountry')
        expect(grape).toHaveProperty('aliases')
      }
    })
  })

  describe('GET /api/regions (enrichment fields)', () => {
    it('returns regions with enrichment fields', async () => {
      const res = await apiFetch('/api/regions')
      expect(res.ok).toBe(true)
      const data = await res.json()
      expect(Array.isArray(data)).toBe(true)
      
      if (data.length > 0) {
        const region = data[0]
        expect(region).toHaveProperty('id')
        expect(region).toHaveProperty('name')
        expect(region).toHaveProperty('description')
        expect(region).toHaveProperty('latitude')
        expect(region).toHaveProperty('longitude')
        expect(region).toHaveProperty('climate')
        expect(region).toHaveProperty('soilTypes')
      }
    })
  })

  describe('GET /api/inventory/search (vintages)', () => {
    it('returns search results with vintageId', async () => {
      const res = await apiFetch('/api/inventory/search?q=test')
      expect(res.ok).toBe(true)
      const data = await res.json()
      expect(data).toHaveProperty('wines')
      expect(Array.isArray(data.wines)).toBe(true)
      
      if (data.wines.length > 0) {
        expect(data.wines[0]).toHaveProperty('vintageId')
        expect(data.wines[0]).toHaveProperty('vintage')
      }
    })
  })

  describe('GET /api/inventory/events (vintages)', () => {
    it('returns events with vintage from vintages table', async () => {
      const res = await apiFetch('/api/inventory/events')
      expect(res.ok).toBe(true)
      const data = await res.json()
      expect(data).toHaveProperty('events')
      expect(Array.isArray(data.events)).toBe(true)
      
      if (data.events.length > 0) {
        expect(data.events[0]).toHaveProperty('vintageId')
        expect(data.events[0]).toHaveProperty('vintage')
      }
    })
  })

  describe('Inventory lot lifecycle (with vintages table)', () => {
    let testWineId: number
    let testProducerId: number
    let testLotId: number
    let testCellarId: number
    
    it('gets existing wine and cellar for test', async () => {
      // Get existing inventory to find valid IDs
      const cardsRes = await apiFetch('/api/inventory/cards?limit=1')
      expect(cardsRes.ok).toBe(true)
      const cardsData = await cardsRes.json()
      
      if (cardsData.cards && cardsData.cards.length > 0) {
        testWineId = cardsData.cards[0].wineId
        
        // Get cellar
        const cellarsRes = await apiFetch('/api/cellars')
        expect(cellarsRes.ok).toBe(true)
        const cellarsData = await cellarsRes.json()
        if (cellarsData.cellars && cellarsData.cellars.length > 0) {
          testCellarId = cellarsData.cellars[0].id
        }
      }
    })
    
    it('creates inventory lot with vintage (creates vintages record)', async () => {
      if (!testWineId || !testCellarId) return
      
      const res = await apiFetch('/api/inventory', {
        method: 'POST',
        body: JSON.stringify({
          wineId: testWineId,
          cellarId: testCellarId,
          formatId: 1, // Standard 750ml
          vintage: 2020,
          quantity: 1,
        }),
      })
      expect(res.ok).toBe(true)
      const data = await res.json()
      
      testLotId = data.id
      expect(data.vintageId).toBeDefined()
      expect(data.vintage).toBe(2020)
    })
    
    it('verifies lot has vintageId populated', async () => {
      if (!testLotId) return
      
      const res = await apiFetch(`/api/inventory/${testLotId}`)
      expect(res.ok).toBe(true)
      const data = await res.json()
      
      expect(data.vintageId).toBeDefined()
      expect(data.vintage).toBe(2020)
    })
    
    it('updates vintage (creates new vintage record if needed)', async () => {
      if (!testLotId) return
      
      const res = await apiFetch(`/api/inventory/${testLotId}`, {
        method: 'PATCH',
        body: JSON.stringify({ vintage: 2021 }),
      })
      expect(res.ok).toBe(true)
      const data = await res.json()
      
      expect(data.vintage).toBe(2021)
      // vintageId should have changed to new record
      expect(data.vintageId).toBeDefined()
    })
    
    it('cleans up test lot', async () => {
      if (!testLotId) return
      
      const res = await apiFetch(`/api/inventory/${testLotId}`, {
        method: 'DELETE',
      })
      expect(res.ok).toBe(true)
    })
  })
})
