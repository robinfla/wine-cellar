import { describe, it, expect } from 'vitest'
import { convertToBase, type FxRateMap } from '~/server/utils/currency'

describe('convertToBase', () => {
  const createRateMap = (rates: Record<string, number>): FxRateMap => {
    return new Map(Object.entries(rates))
  }

  const standardRates = createRateMap({
    EUR: 1,
    USD: 0.92,
    GBP: 1.17,
    ZAR: 0.05,
    CHF: 1.05,
  })

  describe('basic conversions', () => {
    it('converts EUR to EUR at 1:1', () => {
      const result = convertToBase(100, 'EUR', standardRates)
      expect(result).toBe(100)
    })

    it('converts USD to EUR', () => {
      const result = convertToBase(100, 'USD', standardRates)
      expect(result).toBe(92)
    })

    it('converts GBP to EUR', () => {
      const result = convertToBase(100, 'GBP', standardRates)
      expect(result).toBe(117)
    })

    it('converts ZAR to EUR', () => {
      const result = convertToBase(100, 'ZAR', standardRates)
      expect(result).toBe(5)
    })

    it('converts CHF to EUR', () => {
      const result = convertToBase(100, 'CHF', standardRates)
      expect(result).toBe(105)
    })
  })

  describe('null and undefined handling', () => {
    it('returns 0 for null amount', () => {
      const result = convertToBase(null, 'EUR', standardRates)
      expect(result).toBe(0)
    })

    it('returns 0 for undefined amount', () => {
      const result = convertToBase(undefined as unknown as null, 'EUR', standardRates)
      expect(result).toBe(0)
    })

    it('defaults to EUR for null currency', () => {
      const result = convertToBase(100, null, standardRates)
      expect(result).toBe(100)
    })
  })

  describe('string amount handling', () => {
    it('converts string number to numeric', () => {
      const result = convertToBase('100', 'EUR', standardRates)
      expect(result).toBe(100)
    })

    it('converts string decimal to numeric', () => {
      const result = convertToBase('99.99', 'EUR', standardRates)
      expect(result).toBeCloseTo(99.99)
    })

    it('returns 0 for invalid string', () => {
      const result = convertToBase('not-a-number', 'EUR', standardRates)
      expect(result).toBe(0)
    })

    it('returns 0 for empty string', () => {
      const result = convertToBase('', 'EUR', standardRates)
      expect(result).toBe(0)
    })
  })

  describe('unknown currency handling', () => {
    it('uses 1:1 rate for unknown currency', () => {
      const result = convertToBase(100, 'XYZ', standardRates)
      expect(result).toBe(100)
    })
  })

  describe('decimal precision', () => {
    it('handles decimal amounts correctly', () => {
      const result = convertToBase(49.99, 'USD', standardRates)
      expect(result).toBeCloseTo(45.99, 1)
    })

    it('handles small amounts', () => {
      const result = convertToBase(0.01, 'EUR', standardRates)
      expect(result).toBe(0.01)
    })

    it('handles large amounts', () => {
      const result = convertToBase(1000000, 'USD', standardRates)
      expect(result).toBe(920000)
    })
  })

  describe('negative amounts', () => {
    it('handles negative amounts', () => {
      const result = convertToBase(-100, 'USD', standardRates)
      expect(result).toBe(-92)
    })
  })

  describe('zero amount', () => {
    it('returns 0 for zero amount', () => {
      const result = convertToBase(0, 'USD', standardRates)
      expect(result).toBe(0)
    })
  })
})
