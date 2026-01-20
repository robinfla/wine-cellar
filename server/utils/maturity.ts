export type MaturityStatus = 'too_early' | 'approaching' | 'ready' | 'peak' | 'declining' | 'past' | 'unknown'

export interface DrinkingWindow {
  status: MaturityStatus
  drinkFrom?: number
  drinkUntil?: number
  peakStart?: number
  peakEnd?: number
  message: string
  yearsUntilReady?: number
  yearsPastPeak?: number
}

/**
 * Default drinking windows by wine color (years after vintage)
 */
const DEFAULT_WINDOWS: Record<string, { drinkFrom: number; drinkUntil: number; peakStart: number; peakEnd: number }> = {
  red: { drinkFrom: 3, drinkUntil: 15, peakStart: 5, peakEnd: 12 },
  white: { drinkFrom: 1, drinkUntil: 8, peakStart: 2, peakEnd: 5 },
  rose: { drinkFrom: 0, drinkUntil: 3, peakStart: 1, peakEnd: 2 },
  sparkling: { drinkFrom: 0, drinkUntil: 10, peakStart: 3, peakEnd: 7 },
  dessert: { drinkFrom: 2, drinkUntil: 30, peakStart: 5, peakEnd: 20 },
  fortified: { drinkFrom: 0, drinkUntil: 50, peakStart: 5, peakEnd: 30 },
}

interface MaturityInput {
  vintage: number | null
  color: string
  // Wine-level defaults
  defaultDrinkFromYears?: number | null
  defaultDrinkUntilYears?: number | null
  // Lot-level overrides
  overrideDrinkFromYear?: number | null
  overrideDrinkUntilYear?: number | null
}

/**
 * Calculate the drinking window and maturity status for a wine
 */
export function getDrinkingWindow(input: MaturityInput): DrinkingWindow {
  const { vintage, color, defaultDrinkFromYears, defaultDrinkUntilYears, overrideDrinkFromYear, overrideDrinkUntilYear } = input
  const currentYear = new Date().getFullYear()

  // Non-vintage wines
  if (!vintage) {
    return {
      status: 'unknown',
      message: 'Non-vintage wine - drink at your discretion',
    }
  }

  // Get defaults for this color
  const defaults = DEFAULT_WINDOWS[color] || DEFAULT_WINDOWS.red

  // Calculate drinking window
  // Priority: lot override > wine default > color default
  let drinkFrom: number
  let drinkUntil: number

  if (overrideDrinkFromYear) {
    drinkFrom = overrideDrinkFromYear
  } else if (defaultDrinkFromYears !== null && defaultDrinkFromYears !== undefined) {
    drinkFrom = vintage + defaultDrinkFromYears
  } else {
    drinkFrom = vintage + defaults.drinkFrom
  }

  if (overrideDrinkUntilYear) {
    drinkUntil = overrideDrinkUntilYear
  } else if (defaultDrinkUntilYears !== null && defaultDrinkUntilYears !== undefined) {
    drinkUntil = vintage + defaultDrinkUntilYears
  } else {
    drinkUntil = vintage + defaults.drinkUntil
  }

  // Calculate peak window (estimate based on drinking window)
  const windowLength = drinkUntil - drinkFrom
  const peakStart = drinkFrom + Math.floor(windowLength * 0.2)
  const peakEnd = drinkUntil - Math.floor(windowLength * 0.2)

  // Determine status
  let status: MaturityStatus
  let message: string
  let yearsUntilReady: number | undefined
  let yearsPastPeak: number | undefined

  if (currentYear < drinkFrom - 2) {
    status = 'too_early'
    yearsUntilReady = drinkFrom - currentYear
    message = `Too young - wait ${yearsUntilReady} more year${yearsUntilReady > 1 ? 's' : ''}`
  } else if (currentYear < drinkFrom) {
    status = 'approaching'
    yearsUntilReady = drinkFrom - currentYear
    message = `Approaching - ready in ${yearsUntilReady} year${yearsUntilReady > 1 ? 's' : ''}`
  } else if (currentYear >= peakStart && currentYear <= peakEnd) {
    status = 'peak'
    message = 'At peak - ideal drinking window'
  } else if (currentYear >= drinkFrom && currentYear <= drinkUntil) {
    status = 'ready'
    message = 'Ready to drink'
  } else if (currentYear <= drinkUntil + 3) {
    status = 'declining'
    yearsPastPeak = currentYear - drinkUntil
    message = `Past peak but still enjoyable - ${yearsPastPeak} year${yearsPastPeak > 1 ? 's' : ''} past optimal`
  } else {
    status = 'past'
    yearsPastPeak = currentYear - drinkUntil
    message = `Past its prime - ${yearsPastPeak} years past optimal window`
  }

  return {
    status,
    drinkFrom,
    drinkUntil,
    peakStart,
    peakEnd,
    message,
    yearsUntilReady,
    yearsPastPeak,
  }
}


