import { desc, eq, and } from 'drizzle-orm'
import { db } from './db'
import { fxRates } from '../db/schema'

export type FxRateMap = Map<string, number>

// Fallback rates to EUR when database has no rates
// These are approximate rates and should be updated in the database for accuracy
const FALLBACK_RATES_TO_EUR: Record<string, number> = {
  EUR: 1,
  USD: 0.92,   // 1 USD ≈ 0.92 EUR
  GBP: 1.17,   // 1 GBP ≈ 1.17 EUR
  ZAR: 0.05,   // 1 ZAR ≈ 0.05 EUR (1 EUR ≈ 20 ZAR)
  CHF: 1.05,   // 1 CHF ≈ 1.05 EUR
}

/**
 * Get the latest FX rates to convert all currencies to the target currency (default EUR)
 * Returns a map of currency -> rate where rate is the multiplier to convert to target currency
 */
export async function getLatestFxRates(toCurrency = 'EUR'): Promise<FxRateMap> {
  const rateMap: FxRateMap = new Map()

  // Same currency always converts at 1:1
  rateMap.set(toCurrency, 1)

  // Get the most recent rate for each currency pair to the target currency
  const currencies = ['EUR', 'USD', 'GBP', 'ZAR', 'CHF'] as const

  for (const fromCurrency of currencies) {
    if (fromCurrency === toCurrency) continue

    const [latestRate] = await db
      .select({
        rate: fxRates.rate,
      })
      .from(fxRates)
      .where(
        and(
          eq(fxRates.fromCurrency, fromCurrency),
          eq(fxRates.toCurrency, toCurrency as any),
        ),
      )
      .orderBy(desc(fxRates.effectiveDate))
      .limit(1)

    if (latestRate) {
      rateMap.set(fromCurrency, Number(latestRate.rate))
    } else {
      // Use fallback rate if available, otherwise 1:1
      const fallbackRate = toCurrency === 'EUR'
        ? FALLBACK_RATES_TO_EUR[fromCurrency]
        : 1

      if (fallbackRate && fallbackRate !== 1) {
        console.warn(`No FX rate found for ${fromCurrency} -> ${toCurrency}, using fallback rate: ${fallbackRate}`)
      }
      rateMap.set(fromCurrency, fallbackRate ?? 1)
    }
  }

  return rateMap
}

/**
 * Convert an amount from one currency to the base currency using the rate map
 */
export function convertToBase(
  amount: number | string | null,
  fromCurrency: string | null,
  rateMap: FxRateMap,
): number {
  if (amount === null || amount === undefined) return 0

  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(numAmount)) return 0

  const currency = fromCurrency || 'EUR'
  const rate = rateMap.get(currency) ?? 1

  return numAmount * rate
}
