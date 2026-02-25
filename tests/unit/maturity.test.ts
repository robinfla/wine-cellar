import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getDrinkingWindow } from '~/server/utils/maturity'

describe('getDrinkingWindow', () => {
  // Fix "current year" to 2026 for deterministic tests
  const CURRENT_YEAR = 2026

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(CURRENT_YEAR, 5, 15)) // June 15, 2026
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('non-vintage wines', () => {
    it('returns unknown status for null vintage', () => {
      const result = getDrinkingWindow({ vintage: null, color: 'red' })
      expect(result.status).toBe('unknown')
      expect(result.message).toBe('Non-vintage wine - drink at your discretion')
      expect(result.drinkFrom).toBeUndefined()
      expect(result.drinkUntil).toBeUndefined()
    })
  })

  describe('color-based defaults', () => {
    it('red: 3-15 years', () => {
      const result = getDrinkingWindow({ vintage: 2020, color: 'red' })
      expect(result.drinkFrom).toBe(2023)
      expect(result.drinkUntil).toBe(2035)
      expect(result.source).toBe('color (red)')
    })

    it('white: 1-8 years', () => {
      const result = getDrinkingWindow({ vintage: 2020, color: 'white' })
      expect(result.drinkFrom).toBe(2021)
      expect(result.drinkUntil).toBe(2028)
    })

    it('rosé: 0-3 years', () => {
      const result = getDrinkingWindow({ vintage: 2020, color: 'rosé' })
      expect(result.drinkFrom).toBe(2020)
      expect(result.drinkUntil).toBe(2023)
    })

    it('sparkling: 0-10 years', () => {
      const result = getDrinkingWindow({ vintage: 2020, color: 'sparkling' })
      expect(result.drinkFrom).toBe(2020)
      expect(result.drinkUntil).toBe(2030)
    })

    it('dessert: 2-30 years', () => {
      const result = getDrinkingWindow({ vintage: 2020, color: 'dessert' })
      expect(result.drinkFrom).toBe(2022)
      expect(result.drinkUntil).toBe(2050)
    })

    it('fortified: 0-50 years', () => {
      const result = getDrinkingWindow({ vintage: 2020, color: 'fortified' })
      expect(result.drinkFrom).toBe(2020)
      expect(result.drinkUntil).toBe(2070)
    })

    it('unknown color falls back to red defaults', () => {
      const result = getDrinkingWindow({ vintage: 2020, color: 'orange' })
      expect(result.drinkFrom).toBe(2023)
      expect(result.drinkUntil).toBe(2035)
    })
  })

  describe('appellation-based windows', () => {
    it('Margaux red: 7-25 years', () => {
      const result = getDrinkingWindow({
        vintage: 2015, color: 'red',
        appellationName: 'Margaux',
      })
      expect(result.drinkFrom).toBe(2022)
      expect(result.drinkUntil).toBe(2040)
      expect(result.source).toContain('appellation')
    })

    it('Saint-Julien red: 7-25 years', () => {
      const result = getDrinkingWindow({
        vintage: 2015, color: 'red',
        appellationName: 'Saint-Julien',
      })
      expect(result.drinkFrom).toBe(2022)
      expect(result.drinkUntil).toBe(2040)
    })

    it('Sauternes white: 5-40 years', () => {
      const result = getDrinkingWindow({
        vintage: 2010, color: 'white',
        appellationName: 'Sauternes',
      })
      expect(result.drinkFrom).toBe(2015)
      expect(result.drinkUntil).toBe(2050)
    })

    it('Côtes de Provence rosé: 0-2 years', () => {
      const result = getDrinkingWindow({
        vintage: 2024, color: 'rosé',
        appellationName: 'Côtes de Provence',
      })
      expect(result.drinkFrom).toBe(2024)
      expect(result.drinkUntil).toBe(2026)
    })

    it('unknown appellation falls through to region', () => {
      const result = getDrinkingWindow({
        vintage: 2020, color: 'red',
        appellationName: 'Fake Appellation',
        regionName: 'Bordeaux',
      })
      expect(result.source).toContain('region')
    })

    it('unknown appellation + no region falls to color', () => {
      const result = getDrinkingWindow({
        vintage: 2020, color: 'red',
        appellationName: 'Fake Appellation',
      })
      expect(result.source).toBe('color (red)')
    })
  })

  describe('region + grape combos', () => {
    it('Swartland Syrah red: 4-18 years', () => {
      const result = getDrinkingWindow({
        vintage: 2018, color: 'red',
        regionName: 'Swartland',
        grapeName: 'Syrah',
      })
      expect(result.drinkFrom).toBe(2022)
      expect(result.drinkUntil).toBe(2036)
      expect(result.source).toContain('region+grape')
    })

    it('Stellenbosch Cabernet Sauvignon red: 5-18 years', () => {
      const result = getDrinkingWindow({
        vintage: 2018, color: 'red',
        regionName: 'Stellenbosch',
        grapeName: 'Cabernet Sauvignon',
      })
      expect(result.drinkFrom).toBe(2023)
      expect(result.drinkUntil).toBe(2036)
    })

    it('unknown grape falls to region-only', () => {
      const result = getDrinkingWindow({
        vintage: 2020, color: 'red',
        regionName: 'Swartland',
        grapeName: 'Unknown Grape',
      })
      expect(result.source).toContain('region (Swartland)')
      expect(result.drinkFrom).toBe(2023)
      expect(result.drinkUntil).toBe(2035)
    })
  })

  describe('region-only fallback', () => {
    it('Bordeaux red: 4-15 years', () => {
      const result = getDrinkingWindow({
        vintage: 2018, color: 'red',
        regionName: 'Bordeaux',
      })
      expect(result.drinkFrom).toBe(2022)
      expect(result.drinkUntil).toBe(2033)
      expect(result.source).toContain('region')
    })
  })

  describe('priority cascade', () => {
    it('lot override > AI defaults > appellation > region > color', () => {
      // Lot override wins
      const result = getDrinkingWindow({
        vintage: 2015, color: 'red',
        appellationName: 'Margaux',
        defaultDrinkFromYears: 5,
        defaultDrinkUntilYears: 20,
        overrideDrinkFromYear: 2030,
        overrideDrinkUntilYear: 2050,
      })
      expect(result.drinkFrom).toBe(2030)
      expect(result.drinkUntil).toBe(2050)
      expect(result.source).toBe('manual override')
    })

    it('AI defaults > appellation when no lot override', () => {
      const result = getDrinkingWindow({
        vintage: 2015, color: 'red',
        appellationName: 'Margaux',
        defaultDrinkFromYears: 10,
        defaultDrinkUntilYears: 35,
      })
      expect(result.drinkFrom).toBe(2025)
      expect(result.drinkUntil).toBe(2050)
      expect(result.source).toBe('AI estimate')
    })

    it('appellation > region when no AI defaults', () => {
      const result = getDrinkingWindow({
        vintage: 2015, color: 'red',
        appellationName: 'Margaux',
        regionName: 'Bordeaux',
      })
      expect(result.drinkFrom).toBe(2022)
      expect(result.drinkUntil).toBe(2040)
      expect(result.source).toContain('appellation')
    })
  })

  describe('status calculation', () => {
    it('to_age: before drinking window', () => {
      // Red 2025 → window 2028-2040, current 2026
      const result = getDrinkingWindow({ vintage: 2025, color: 'red' })
      expect(result.status).toBe('to_age')
      expect(result.yearsUntilReady).toBe(2)
      expect(result.message).toContain('To age')
    })

    it('approaching: first third of window', () => {
      // Red 2020 → window 2023-2035 (12yr window, thirds at 4yr each)
      // peakStart = 2023 + 4 = 2027, current = 2026 → approaching
      const result = getDrinkingWindow({ vintage: 2020, color: 'red' })
      expect(result.status).toBe('approaching')
      expect(result.message).toContain('Approaching peak')
    })

    it('peak: middle third of window', () => {
      // Red 2015 → window 2018-2030, peakStart=2022, peakEnd=2026
      // current = 2026 → peak
      const result = getDrinkingWindow({ vintage: 2015, color: 'red' })
      expect(result.status).toBe('peak')
      expect(result.message).toContain('At peak')
    })

    it('past_prime: last third of window', () => {
      // Red 2008 → window 2011-2023, peakStart=2015, peakEnd=2019
      // current=2026 > peakEnd=2019 but <= drinkUntil=2023? No, 2026>2023
      // Actually that's declining. Let me pick better:
      // Red 2010 → window 2013-2025, thirds=4, peakStart=2017, peakEnd=2021
      // current=2026 > peakEnd=2021, but 2026>drinkUntil=2025 → declining
      // Need: peakEnd < current <= drinkUntil
      // White 2016 → window 2017-2024, thirds=round(7/3)=2, peakStart=2019, peakEnd=2021
      // current=2026 > 2024 → declining
      // Fortified 2020 → window 2020-2070, thirds=round(50/3)=17, peakStart=2037, peakEnd=2054
      // current=2026 < peakStart → approaching
      // Hmm, let me use explicit override
      const result = getDrinkingWindow({
        vintage: 2010, color: 'red',
        overrideDrinkFromYear: 2015,
        overrideDrinkUntilYear: 2030,
      })
      // window=15yr, third=5, peakStart=2020, peakEnd=2025
      // current=2026 > peakEnd=2025, <= drinkUntil=2030 → past_prime
      expect(result.status).toBe('past_prime')
      expect(result.message).toContain('Past prime')
    })

    it('declining: beyond drinking window', () => {
      const result = getDrinkingWindow({ vintage: 2000, color: 'white' })
      // window 2001-2008, current=2026 → declining
      expect(result.status).toBe('declining')
      expect(result.yearsPastPeak).toBeGreaterThan(0)
      expect(result.message).toContain('Declining')
    })
  })

  describe('peak window thirds', () => {
    it('splits window into thirds correctly', () => {
      // Red 2020 → 2023-2035, 12yr window, third=4
      const result = getDrinkingWindow({ vintage: 2020, color: 'red' })
      expect(result.peakStart).toBe(2027)
      expect(result.peakEnd).toBe(2031)
    })
  })

  describe('message formatting', () => {
    it('singular year', () => {
      const result = getDrinkingWindow({
        vintage: 2020, color: 'red',
        overrideDrinkFromYear: 2027,
        overrideDrinkUntilYear: 2040,
      })
      // current=2026, drinkFrom=2027, 1 year until ready
      expect(result.status).toBe('to_age')
      expect(result.message).toContain('1 year')
      expect(result.message).not.toContain('1 years')
    })

    it('plural years', () => {
      const result = getDrinkingWindow({
        vintage: 2020, color: 'red',
        overrideDrinkFromYear: 2029,
        overrideDrinkUntilYear: 2040,
      })
      expect(result.message).toContain('3 years')
    })
  })
})
