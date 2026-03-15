import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const BASE = 'http://127.0.0.1:3000'

let authCookie: string

async function apiFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...(authCookie ? { Cookie: authCookie } : {}),
      ...((options.headers as Record<string, string>) || {}),
    },
  })
  return res
}

describe('Upload API tests', () => {
  beforeAll(async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rob.flamant@gmail.com', password: 'robin' }),
    })
    expect(res.ok).toBe(true)
    const setCookie = res.headers.getSetCookie?.() || [res.headers.get('set-cookie') || '']
    authCookie = setCookie.map((c: string) => c.split(';')[0]).join('; ')
    expect(authCookie).toBeTruthy()
  })

  describe('POST /api/upload/audio', () => {
    it('returns 401 when not authenticated', async () => {
      const res = await fetch(`${BASE}/api/upload/audio`, {
        method: 'POST',
      })
      expect(res.status).toBe(401)
    })

    // Note: FormData auth tests are complex - skipping for now
    // Actual file upload would require a real audio file and proper multipart/form-data auth
  })

  describe('POST /api/upload/image', () => {
    it('returns 401 when not authenticated', async () => {
      const res = await fetch(`${BASE}/api/upload/image`, {
        method: 'POST',
      })
      expect(res.status).toBe(401)
    })

    // Note: FormData auth tests are complex - skipping for now
    // Actual file upload would require a real image file and proper multipart/form-data auth
  })

  describe('POST /api/chat/sommelier with media', () => {
    // Note: These tests call the actual Anthropic API which is slow
    // Skipping full integration tests - validation tests below are sufficient

    it.skip('accepts voice message type', async () => {
      const res = await apiFetch('/api/chat/sommelier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'voice',
          audioUrl: '/uploads/audio/test.m4a',
          duration: 5,
        }),
      })
      expect(res.ok).toBe(true)
      const data = await res.json()
      expect(data).toHaveProperty('message')
      expect(data).toHaveProperty('conversationId')
    })

    it.skip('accepts photo message type', async () => {
      const res = await apiFetch('/api/chat/sommelier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'photo',
          imageUrl: '/uploads/images/test.jpg',
        }),
      })
      expect(res.ok).toBe(true)
      const data = await res.json()
      expect(data).toHaveProperty('message')
      expect(data).toHaveProperty('conversationId')
    })

    it('returns 400 for voice type without audioUrl', async () => {
      const res = await apiFetch('/api/chat/sommelier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'voice',
          duration: 5,
        }),
      })
      expect(res.status).toBe(400)
    })

    it('returns 400 for photo type without imageUrl', async () => {
      const res = await apiFetch('/api/chat/sommelier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'photo',
        }),
      })
      expect(res.status).toBe(400)
    })
  })
})
