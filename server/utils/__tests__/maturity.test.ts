import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getDrinkingWindow } from '../maturity'

// Mock the current year for deterministic tests
const MOCK_YEAR = 2025

describe('getDrinkingWindow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(MOCK_YEAR, 0, 1))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('appellation lookup', () => {
    it('returns correct window for Margaux red', () => {
      const result = getDrinkingWindow({
        vintage: 2015,
        color: 'red',
        appellationName: 'Margaux',
      })
      // Margaux red: [7, 25] → drinkFrom=2022, drinkUntil=2040
      expect(result.drinkFrom).toBe(2022)
      expect(result.drinkUntil).toBe(2040)
      expect(result.source).toContain('appellation')
      expect(result.source).toContain('Margaux')
    })

    it('returns correct window for Sauternes white', () => {
      const result = getDrinkingWindow({
        vintage: 2010,
        color: 'white',
        appellationName: 'Sauternes',
      })
      // Sauternes white: [5, 40] → drinkFrom=2015, drinkUntil=2050
      expect(result.drinkFrom).toBe(2015)
      expect(result.drinkUntil).toBe(2050)
    })

    it('handles case-insensitive appellation names', () => {
      const result = getDrinkingWindow({
        vintage: 2018,
        color: 'red',
        appellationName: 'PAUILLAC',
      })
      // Pauillac red: [8, 30] → drinkFrom=2026, drinkUntil=2048
      expect(result.drinkFrom).toBe(2026)
      expect(result.drinkUntil).toBe(2048)
    })
  })

  describe('region + grape fallback', () => {
    it('falls back to region+grape when appellation not found', () => {
      const result = getDrinkingWindow({
        vintage: 2020,
        color: 'red',
        appellationName: 'Unknown Appellation',
        regionName: 'Swartland',
        grapeName: 'Syrah',
      })
      // swartland|syrah|red: [4, 18] → drinkFrom=2024, drinkUntil=2038
      expect(result.drinkFrom).toBe(2024)
      expect(result.drinkUntil).toBe(2038)
      expect(result.source).toContain('region+grape')
    })

    it('falls back to region+grape when no appellation provided', () => {
      const result = getDrinkingWindow({
        vintage: 2020,
        color: 'white',
        regionName: 'Stellenbosch',
        grapeName: 'Chenin Blanc',
      })
      // stellenbosch|chenin blanc|white: [2, 8]
      expect(result.drinkFrom).toBe(2022)
      expect(result.drinkUntil).toBe(2028)
      expect(result.source).toContain('region+grape')
    })
  })

  describe('region-only fallback', () => {
    it('falls back to region when grape not found', () => {
      const result = getDrinkingWindow({
        vintage: 2020,
        color: 'red',
        regionName: 'Bordeaux',
        grapeName: 'Unknown Grape',
      })
      // bordeaux|red: [4, 15]
      expect(result.drinkFrom).toBe(2024)
      expect(result.drinkUntil).toBe(2035)
      expect(result.source).toContain('region')
    })
  })

  describe('color-only fallback', () => {
    it('falls back to color defaults when no appellation or region', () => {
      const result = getDrinkingWindow({
        vintage: 2020,
        color: 'red',
      })
      // red: [3, 15]
      expect(result.drinkFrom).toBe(2023)
      expect(result.drinkUntil).toBe(2035)
      expect(result.source).toContain('color')
    })

    it('handles rosé defaults', () => {
      const result = getDrinkingWindow({
        vintage: 2023,
        color: 'rosé',
      })
      // rosé: [0, 3]
      expect(result.drinkFrom).toBe(2023)
      expect(result.drinkUntil).toBe(2026)
    })
  })

  describe('status calculation', () => {
    it('returns to_age when before drinking window', () => {
      const result = getDrinkingWindow({
        vintage: 2023,
        color: 'red',
        appellationName: 'Pauillac',
      })
      // Pauillac red: [8, 30] → drinkFrom=2031, drinkUntil=2053
      // 2025 < 2031 → to_age
      expect(result.status).toBe('to_age')
      expect(result.yearsUntilReady).toBe(6)
    })

    it('returns approaching when in first third of window', () => {
      // Need a wine where 2025 is in first third
      // Côtes du Rhône red: [1, 5] → vintage 2023 → drinkFrom=2024, drinkUntil=2028
      // windowLength=4, thirdLength=1, peakStart=2025, peakEnd=2026
      // 2025 is exactly at peakStart, so it would be 'peak'
      // Let's use a different example: Bordeaux red [4,15] vintage 2020
      // drinkFrom=2024, drinkUntil=2035, windowLength=11, thirdLength=4
      // peakStart=2028, peakEnd=2032
      // 2025 is between 2024 and 2028 → approaching
      const result = getDrinkingWindow({
        vintage: 2020,
        color: 'red',
        regionName: 'Bordeaux',
      })
      expect(result.status).toBe('approaching')
    })

    it('returns peak when in middle third of window', () => {
      // Margaux 2015 red: drinkFrom=2022, drinkUntil=2040
      // windowLength=18, thirdLength=6, peakStart=2028, peakEnd=2034
      // 2025 is between 2022 and 2028 → approaching
      // Let's use: Côtes du Rhône red [1,5] vintage 2021
      // drinkFrom=2022, drinkUntil=2026, windowLength=4, thirdLength=1
      // peakStart=2023, peakEnd=2024
      // 2025 > 2024 → past_prime
      // Let's find one at peak: Beaune red [3,12] vintage 2016
      // drinkFrom=2019, drinkUntil=2028, windowLength=9, thirdLength=3
      // peakStart=2022, peakEnd=2025
      // 2025 == 2025 → peak (<=)
      const result = getDrinkingWindow({
        vintage: 2016,
        color: 'red',
        appellationName: 'Beaune',
      })
      expect(result.status).toBe('peak')
    })

    it('returns past_prime when in last third of window', () => {
      // Bourgogne red [2,7] vintage 2017
      // drinkFrom=2019, drinkUntil=2024, windowLength=5, thirdLength=2
      // peakStart=2021, peakEnd=2023
      // 2025 > 2024 → declining actually
      // Let's try: Morgon red [2,10] vintage 2015
      // drinkFrom=2017, drinkUntil=2025, windowLength=8, thirdLength=3
      // peakStart=2020, peakEnd=2023
      // 2025 <= 2025 → past_prime
      const result = getDrinkingWindow({
        vintage: 2015,
        color: 'red',
        appellationName: 'Morgon',
      })
      expect(result.status).toBe('past_prime')
    })

    it('returns declining when past drinking window', () => {
      const result = getDrinkingWindow({
        vintage: 2000,
        color: 'rosé',
      })
      // rosé: [0, 3] → drinkFrom=2000, drinkUntil=2003
      // 2025 >> 2003 → declining
      expect(result.status).toBe('declining')
      expect(result.yearsPastPeak).toBe(22)
    })

    it('returns unknown for non-vintage wines', () => {
      const result = getDrinkingWindow({
        vintage: null,
        color: 'red',
      })
      expect(result.status).toBe('unknown')
    })
  })

  describe('overrides and AI defaults', () => {
    it('lot-level overrides take priority', () => {
      const result = getDrinkingWindow({
        vintage: 2020,
        color: 'red',
        appellationName: 'Margaux',
        overrideDrinkFromYear: 2030,
        overrideDrinkUntilYear: 2050,
      })
      expect(result.drinkFrom).toBe(2030)
      expect(result.drinkUntil).toBe(2050)
      expect(result.source).toBe('manual override')
    })

    it('AI defaults take priority over appellation lookup', () => {
      const result = getDrinkingWindow({
        vintage: 2020,
        color: 'red',
        appellationName: 'Margaux',
        defaultDrinkFromYears: 10,
        defaultDrinkUntilYears: 35,
      })
      expect(result.drinkFrom).toBe(2030)
      expect(result.drinkUntil).toBe(2055)
      expect(result.source).toBe('AI estimate')
    })
  })
})
