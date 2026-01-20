import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '~/server/utils/auth'

describe('hashPassword', () => {
  it('returns a hash string different from the input', async () => {
    const password = 'testPassword123!'
    const hash = await hashPassword(password)

    expect(hash).toBeDefined()
    expect(typeof hash).toBe('string')
    expect(hash).not.toBe(password)
    expect(hash.length).toBeGreaterThan(0)
  })

  it('produces different hashes for the same password', async () => {
    const password = 'testPassword123!'
    const hash1 = await hashPassword(password)
    const hash2 = await hashPassword(password)

    expect(hash1).not.toBe(hash2)
  })

  it('produces different hashes for different passwords', async () => {
    const hash1 = await hashPassword('password1')
    const hash2 = await hashPassword('password2')

    expect(hash1).not.toBe(hash2)
  })

  it('handles empty password', async () => {
    const hash = await hashPassword('')

    expect(hash).toBeDefined()
    expect(typeof hash).toBe('string')
  })

  it('handles unicode characters', async () => {
    const hash = await hashPassword('пароль123中文密码')

    expect(hash).toBeDefined()
    expect(typeof hash).toBe('string')
  })

  it('handles very long passwords', async () => {
    const longPassword = 'a'.repeat(1000)
    const hash = await hashPassword(longPassword)

    expect(hash).toBeDefined()
    expect(typeof hash).toBe('string')
  })
})

describe('verifyPassword', () => {
  it('returns true for correct password', async () => {
    const password = 'testPassword123!'
    const hash = await hashPassword(password)
    const result = await verifyPassword(hash, password)

    expect(result).toBe(true)
  })

  it('returns false for incorrect password', async () => {
    const password = 'testPassword123!'
    const hash = await hashPassword(password)
    const result = await verifyPassword(hash, 'wrongPassword')

    expect(result).toBe(false)
  })

  it('returns false for empty password when original was not empty', async () => {
    const password = 'testPassword123!'
    const hash = await hashPassword(password)
    const result = await verifyPassword(hash, '')

    expect(result).toBe(false)
  })

  it('returns true for empty password when original was empty', async () => {
    const hash = await hashPassword('')
    const result = await verifyPassword(hash, '')

    expect(result).toBe(true)
  })

  it('returns false for invalid hash format', async () => {
    const result = await verifyPassword('invalid-hash', 'password')

    expect(result).toBe(false)
  })

  it('returns false for empty hash', async () => {
    const result = await verifyPassword('', 'password')

    expect(result).toBe(false)
  })

  it('handles unicode characters correctly', async () => {
    const password = 'пароль123中文密码'
    const hash = await hashPassword(password)
    const result = await verifyPassword(hash, password)

    expect(result).toBe(true)
  })

  it('handles case-sensitive passwords', async () => {
    const hash = await hashPassword('Password123')
    
    expect(await verifyPassword(hash, 'Password123')).toBe(true)
    expect(await verifyPassword(hash, 'password123')).toBe(false)
    expect(await verifyPassword(hash, 'PASSWORD123')).toBe(false)
  })
})
