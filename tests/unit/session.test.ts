import { describe, it, expect } from 'vitest'
import { randomBytes } from 'crypto'

const generateSessionToken = (): string => {
  return randomBytes(32).toString('hex')
}

describe('generateSessionToken', () => {
  it('returns a 64-character hex string', () => {
    const token = generateSessionToken()

    expect(token).toBeDefined()
    expect(typeof token).toBe('string')
    expect(token.length).toBe(64)
    expect(/^[a-f0-9]+$/.test(token)).toBe(true)
  })

  it('generates unique tokens on each call', () => {
    const tokens = new Set<string>()
    const iterations = 100

    for (let i = 0; i < iterations; i++) {
      tokens.add(generateSessionToken())
    }

    expect(tokens.size).toBe(iterations)
  })

  it('generates cryptographically random tokens', () => {
    const token1 = generateSessionToken()
    const token2 = generateSessionToken()

    expect(token1).not.toBe(token2)
    
    const sharedChars = [...token1].filter((char, i) => char === token2[i]).length
    expect(sharedChars).toBeLessThan(token1.length / 2)
  })
})
