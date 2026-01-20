import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getDrinkingWindow, type MaturityStatus } from '~/server/utils/maturity'

describe('getDrinkingWindow', () => {
  const currentYear = new Date().getFullYear()

  describe('non-vintage wines', () => {
    it('returns unknown status for null vintage', () => {
      const result = getDrinkingWindow({ vintage: null, color: 'red' })

      expect(result.status).toBe('unknown')
      expect(result.message).toBe('Non-vintage wine - drink at your discretion')
      expect(result.drinkFrom).toBeUndefined()
      expect(result.drinkUntil).toBeUndefined()
    })
  })

  describe('wine color defaults', () => {
    it('uses red wine defaults (3-15 years)', () => {
      const vintage = currentYear - 10
      const result = getDrinkingWindow({ vintage, color: 'red' })

      expect(result.drinkFrom).toBe(vintage + 3)
      expect(result.drinkUntil).toBe(vintage + 15)
    })

    it('uses white wine defaults (1-8 years)', () => {
      const vintage = currentYear - 5
      const result = getDrinkingWindow({ vintage, color: 'white' })

      expect(result.drinkFrom).toBe(vintage + 1)
      expect(result.drinkUntil).toBe(vintage + 8)
    })

    it('uses rose wine defaults (0-3 years)', () => {
      const vintage = currentYear - 2
      const result = getDrinkingWindow({ vintage, color: 'rose' })

      expect(result.drinkFrom).toBe(vintage + 0)
      expect(result.drinkUntil).toBe(vintage + 3)
    })

    it('uses sparkling wine defaults (0-10 years)', () => {
      const vintage = currentYear - 5
      const result = getDrinkingWindow({ vintage, color: 'sparkling' })

      expect(result.drinkFrom).toBe(vintage + 0)
      expect(result.drinkUntil).toBe(vintage + 10)
    })

    it('uses dessert wine defaults (2-30 years)', () => {
      const vintage = currentYear - 15
      const result = getDrinkingWindow({ vintage, color: 'dessert' })

      expect(result.drinkFrom).toBe(vintage + 2)
      expect(result.drinkUntil).toBe(vintage + 30)
    })

    it('uses fortified wine defaults (0-50 years)', () => {
      const vintage = currentYear - 25
      const result = getDrinkingWindow({ vintage, color: 'fortified' })

      expect(result.drinkFrom).toBe(vintage + 0)
      expect(result.drinkUntil).toBe(vintage + 50)
    })

    it('falls back to red wine defaults for unknown color', () => {
      const vintage = currentYear - 10
      const result = getDrinkingWindow({ vintage, color: 'unknown_color' })

      expect(result.drinkFrom).toBe(vintage + 3)
      expect(result.drinkUntil).toBe(vintage + 15)
    })
  })

  describe('wine-level defaults override color defaults', () => {
    it('uses defaultDrinkFromYears when provided', () => {
      const vintage = currentYear - 5
      const result = getDrinkingWindow({
        vintage,
        color: 'red',
        defaultDrinkFromYears: 5,
      })

      expect(result.drinkFrom).toBe(vintage + 5)
    })

    it('uses defaultDrinkUntilYears when provided', () => {
      const vintage = currentYear - 5
      const result = getDrinkingWindow({
        vintage,
        color: 'red',
        defaultDrinkUntilYears: 20,
      })

      expect(result.drinkUntil).toBe(vintage + 20)
    })

    it('allows zero for defaultDrinkFromYears', () => {
      const vintage = currentYear
      const result = getDrinkingWindow({
        vintage,
        color: 'red',
        defaultDrinkFromYears: 0,
      })

      expect(result.drinkFrom).toBe(vintage)
    })
  })

  describe('lot-level overrides take highest priority', () => {
    it('uses overrideDrinkFromYear when provided', () => {
      const result = getDrinkingWindow({
        vintage: currentYear - 5,
        color: 'red',
        defaultDrinkFromYears: 3,
        overrideDrinkFromYear: 2025,
      })

      expect(result.drinkFrom).toBe(2025)
    })

    it('uses overrideDrinkUntilYear when provided', () => {
      const result = getDrinkingWindow({
        vintage: currentYear - 5,
        color: 'red',
        defaultDrinkUntilYears: 15,
        overrideDrinkUntilYear: 2040,
      })

      expect(result.drinkUntil).toBe(2040)
    })
  })

  describe('maturity status calculation', () => {
    it('returns too_early for wines far from ready', () => {
      const result = getDrinkingWindow({
        vintage: currentYear,
        color: 'red',
      })

      expect(result.status).toBe('too_early')
      expect(result.yearsUntilReady).toBe(3)
      expect(result.message).toContain('Too young')
    })

    it('returns approaching for wines close to ready', () => {
      const result = getDrinkingWindow({
        vintage: currentYear - 2,
        color: 'red',
      })

      expect(result.status).toBe('approaching')
      expect(result.yearsUntilReady).toBe(1)
      expect(result.message).toContain('Approaching')
    })

    it('returns ready for wines in drinking window', () => {
      const result = getDrinkingWindow({
        vintage: currentYear - 3,
        color: 'red',
      })

      expect(result.status).toBe('ready')
      expect(result.message).toBe('Ready to drink')
    })

    it('returns peak for wines at optimal maturity', () => {
      const result = getDrinkingWindow({
        vintage: currentYear - 8,
        color: 'red',
      })

      expect(result.status).toBe('peak')
      expect(result.message).toBe('At peak - ideal drinking window')
    })

    it('returns declining for wines just past optimal', () => {
      const result = getDrinkingWindow({
        vintage: currentYear - 16,
        color: 'red',
      })

      expect(result.status).toBe('declining')
      expect(result.yearsPastPeak).toBeGreaterThan(0)
      expect(result.message).toContain('Past peak')
    })

    it('returns past for wines well past optimal', () => {
      const result = getDrinkingWindow({
        vintage: currentYear - 25,
        color: 'red',
      })

      expect(result.status).toBe('past')
      expect(result.yearsPastPeak).toBeGreaterThan(0)
      expect(result.message).toContain('Past its prime')
    })
  })

  describe('peak window calculation', () => {
    it('calculates peak window as middle portion of drinking window', () => {
      const vintage = currentYear - 10
      const result = getDrinkingWindow({ vintage, color: 'red' })

      const windowLength = result.drinkUntil! - result.drinkFrom!
      const expectedPeakStart = result.drinkFrom! + Math.floor(windowLength * 0.2)
      const expectedPeakEnd = result.drinkUntil! - Math.floor(windowLength * 0.2)

      expect(result.peakStart).toBe(expectedPeakStart)
      expect(result.peakEnd).toBe(expectedPeakEnd)
    })
  })

  describe('message formatting', () => {
    it('uses singular year for 1 year', () => {
      const result = getDrinkingWindow({
        vintage: currentYear - 2,
        color: 'red',
      })

      expect(result.message).toContain('1 year')
      expect(result.message).not.toContain('1 years')
    })

    it('uses plural years for multiple years', () => {
      const result = getDrinkingWindow({
        vintage: currentYear,
        color: 'red',
      })

      expect(result.message).toContain('years')
    })
  })
})
