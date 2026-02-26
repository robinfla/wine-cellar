export type MaturityStatus = 'to_age' | 'approaching' | 'peak' | 'past_prime' | 'declining' | 'unknown'

export interface DrinkingWindow {
  status: MaturityStatus
  drinkFrom?: number
  drinkUntil?: number
  peakStart?: number
  peakEnd?: number
  message: string
  yearsUntilReady?: number
  yearsPastPeak?: number
  source?: string // what resolved the window
}

/**
 * Appellation-based drinking windows: [drinkFromYears, drinkUntilYears]
 * Key: "appellationName|color" (lowercase)
 */
const APPELLATION_WINDOWS: Record<string, [number, number]> = {
  // BORDEAUX
  'pauillac|red': [8, 30],
  'margaux|red': [7, 25],
  'saint-julien|red': [7, 25],
  'saint-émilion grand cru|red': [6, 25],
  'saint-estèphe|red': [8, 30],
  'pessac-léognan|red': [5, 20],
  'pessac-léognan|white': [3, 12],
  'haut-médoc|red': [4, 15],
  'graves|white': [2, 10],
  'graves|red': [4, 15],
  'sauternes|white': [5, 40],
  'médoc|red': [4, 15],
  'moulis|red': [4, 15],
  'listrac-médoc|red': [4, 15],
  'fronsac|red': [3, 12],
  'canon-fronsac|red': [4, 15],
  'lalande-de-pomerol|red': [3, 12],
  'pomerol|red': [5, 25],
  'saint-émilion|red': [4, 18],
  'côtes de bordeaux|red': [2, 8],
  'entre-deux-mers|white': [1, 3],

  // BURGUNDY
  'bourgogne|red': [2, 7],
  'bourgogne|white': [1, 5],
  'bourgogne aligoté|white': [1, 4],
  'aloxe-corton|red': [5, 15],
  'pernand-vergelesses|white': [2, 8],
  'pernand-vergelesses|red': [4, 12],
  'saint-véran|white': [1, 5],
  'mâcon-villages|white': [1, 4],
  'mâcon|white': [1, 4],
  'chablis|white': [2, 10],
  'chablis premier cru|white': [3, 12],
  'chablis grand cru|white': [5, 20],
  'meursault|white': [3, 15],
  'puligny-montrachet|white': [4, 15],
  'chassagne-montrachet|white': [4, 15],
  'chassagne-montrachet|red': [4, 12],
  'gevrey-chambertin|red': [5, 20],
  'nuits-saint-georges|red': [5, 18],
  'vosne-romanée|red': [5, 20],
  'pommard|red': [5, 18],
  'volnay|red': [4, 15],
  'chambolle-musigny|red': [5, 18],
  'corton|red': [6, 20],
  'corton-charlemagne|white': [5, 20],
  'beaune|red': [3, 12],
  'savigny-lès-beaune|red': [3, 10],
  'santenay|red': [3, 10],
  'mercurey|red': [3, 10],
  'givry|red': [3, 10],
  'rully|white': [2, 7],
  'rully|red': [2, 7],
  'pouilly-fuissé|white': [2, 8],
  'marsannay|red': [3, 10],
  'fixin|red': [4, 12],
  'morey-saint-denis|red': [5, 18],

  // RHÔNE
  'côtes du rhône|red': [1, 5],
  'côtes du rhône|white': [1, 3],
  'côtes du rhône villages|red': [2, 8],
  'vacqueyras|red': [3, 12],
  'vacqueyras|white': [1, 5],
  'saint-joseph|red': [3, 12],
  'saint-joseph|white': [1, 6],
  'côte-rôtie|red': [5, 20],
  'hermitage|red': [8, 30],
  'hermitage|white': [5, 20],
  'châteauneuf-du-pape|red': [5, 20],
  'châteauneuf-du-pape|white': [2, 10],
  'crozes-hermitage|red': [2, 8],
  'crozes-hermitage|white': [1, 5],
  'gigondas|red': [3, 15],
  'condrieu|white': [1, 5],
  'lirac|red': [2, 8],
  'rasteau|red': [3, 10],
  'vinsobres|red': [3, 10],
  'cairanne|red': [3, 10],
  'cornas|red': [5, 20],

  // LOIRE
  'vouvray|white': [2, 20],
  'savennières|white': [3, 15],
  'montlouis-sur-loire|white': [2, 15],
  'anjou|white': [2, 10],
  'anjou|red': [2, 8],
  'muscadet|white': [1, 5],
  'muscadet sèvre et maine|white': [1, 6],
  'quincy|white': [1, 4],
  'saumur champigny|red': [2, 8],
  'saumur|white': [1, 6],
  'chinon|red': [3, 12],
  'bourgueil|red': [3, 10],
  'saint-nicolas-de-bourgueil|red': [2, 8],
  'sancerre|white': [1, 6],
  'sancerre|red': [2, 7],
  'pouilly-fumé|white': [1, 6],
  'bonnezeaux|white': [5, 30],
  'quarts de chaume|white': [5, 30],
  'coteaux du layon|white': [3, 20],
  'jasnières|white': [3, 15],

  // LANGUEDOC/ROUSSILLON
  'terrasses du larzac|red': [3, 12],
  'terrasses du larzac|white': [1, 6],
  'pic saint-loup|red': [3, 10],
  'côtes catalanes|red': [2, 8],
  'côtes catalanes|white': [1, 5],
  'montpeyroux|white': [1, 6],
  'montpeyroux|red': [3, 12],
  'montagnes de cucugnan|red': [2, 8],
  'faugères|red': [3, 12],
  'faugères|white': [1, 5],
  'corbières|red': [2, 8],
  'minervois|red': [2, 8],
  'saint-chinian|red': [2, 8],
  'languedoc|red': [2, 8],
  'languedoc|white': [1, 4],
  'collioure|red': [3, 12],
  'banyuls|red': [5, 30],
  'maury|red': [5, 30],
  'rivesaltes|white': [5, 30],
  'fitou|red': [3, 10],
  'limoux|white': [1, 5],

  // PROVENCE
  'bandol|red': [5, 20],
  'bandol|rosé': [1, 4],
  'palette|red': [3, 15],
  'palette|white': [2, 10],
  'cassis|white': [1, 5],
  'côtes de provence|rosé': [0, 2],
  'côtes de provence|red': [2, 8],

  // BEAUJOLAIS
  'morgon|red': [2, 10],
  'morgon|white': [1, 4],
  'fleurie|red': [2, 8],
  'moulin-à-vent|red': [3, 12],
  'brouilly|red': [1, 5],
  'côte de brouilly|red': [2, 7],
  'beaujolais-villages|red': [1, 3],
  'beaujolais|red': [0, 3],
  'chénas|red': [2, 8],
  'juliénas|red': [2, 7],
  'saint-amour|red': [1, 5],
  'régnié|red': [1, 5],
  'chiroubles|red': [1, 4],

  // ALSACE
  'alsace aop|white': [2, 10],
  'alsace grand cru|white': [5, 20],

  // JURA / SAVOIE
  'arbois|red': [2, 8],
  'arbois|white': [2, 10],
  'côtes du jura|white': [2, 10],
  'vin jaune|white': [10, 50],
  'château-chalon|white': [10, 50],

  // SOUTH WEST
  'madiran|red': [5, 18],
  'cahors|red': [4, 15],
  'irouléguy|red': [3, 10],
  'jurançon|white': [2, 15],
  'bergerac|red': [2, 8],

  // OTHER FRANCE
  'vin de france|red': [1, 5],
  'vin de france|white': [1, 3],
  'vin de france|rosé': [0, 2],
  'igp alpilles|red': [2, 8],

  // SOUTH AFRICA
  'swartland|red': [3, 15],
  'swartland|white': [2, 8],
  'stellenbosch|red': [3, 15],
  'stellenbosch|white': [2, 8],
  'hemel-en-aarde|red': [3, 12],
  'hemel-en-aarde|white': [2, 8],
  'constantia|white': [2, 10],
  'elgin|white': [2, 8],
  'elgin|red': [3, 10],
  'franschhoek|red': [3, 12],
  'paarl|red': [3, 12],

  // SWITZERLAND
  'dézaley|white': [3, 12],
  'valais aoc|white': [2, 8],

  // ITALY
  'barolo|red': [8, 30],
  'barbaresco|red': [6, 25],
  'brunello di montalcino|red': [6, 25],
  'chianti classico|red': [3, 12],
  'chianti classico riserva|red': [4, 18],
  'amarone|red': [5, 25],
  'bolgheri|red': [4, 18],
  'etna|red': [3, 15],
  'etna|white': [2, 8],
  'soave|white': [1, 5],

  // SPAIN
  'rioja|red': [3, 15],
  'ribera del duero|red': [4, 18],
  'priorat|red': [5, 20],
  'rueda|white': [1, 4],
  'rías baixas|white': [1, 5],

  // PORTUGAL
  'douro|red': [3, 15],
  'dão|red': [3, 12],
  'port|red': [10, 50],

  // SOUTH AMERICA
  'mendoza|red': [2, 10],
  'maipo valley|red': [3, 12],
  'colchagua|red': [2, 10],
  'uco valley|red': [3, 12],

  // GERMANY / AUSTRIA
  'mosel|white': [2, 15],
  'rheingau|white': [2, 12],
  'wachau|white': [2, 10],
  'kamptal|white': [2, 8],
}

/**
 * Region + grape lookup: [drinkFromYears, drinkUntilYears]
 * Key: "regionName|grapeName|color" (lowercase)
 */
const REGION_GRAPE_WINDOWS: Record<string, [number, number]> = {
  // SWARTLAND
  'swartland|syrah|red': [4, 18],
  'swartland|chenin blanc|white': [2, 10],
  'swartland|red blend|red': [3, 12],
  'swartland|white blend|white': [2, 8],
  'swartland|cinsault|red': [2, 8],
  'swartland|grenache|red': [3, 12],
  'swartland|mourvèdre|red': [4, 15],
  'swartland|pinotage|red': [3, 10],
  'swartland|cabernet sauvignon|red': [4, 15],
  'swartland|carignan|red': [3, 12],
  'swartland|tinta barocca|red': [3, 12],
  'swartland|touriga nacional|red': [3, 12],
  'swartland|semillon|white': [2, 10],
  'swartland|viognier|white': [1, 5],
  'swartland|colombar|white': [1, 5],
  'swartland|vermentino|white': [1, 5],
  'swartland|verdelho|white': [1, 6],
  'swartland|chardonnay|white': [2, 8],
  'swartland|sauvignon blanc|white': [1, 4],

  // STELLENBOSCH
  'stellenbosch|cabernet sauvignon|red': [5, 18],
  'stellenbosch|syrah|red': [4, 15],
  'stellenbosch|chenin blanc|white': [2, 8],
  'stellenbosch|chardonnay|white': [2, 8],
  'stellenbosch|pinotage|red': [3, 10],
  'stellenbosch|red blend|red': [4, 15],
  'stellenbosch|merlot|red': [3, 10],
  'stellenbosch|semillon|white': [2, 8],

  // HEMEL-EN-AARDE / WALKER BAY
  'hemel-en-aarde|pinot noir|red': [3, 12],
  'hemel-en-aarde|chardonnay|white': [2, 10],
  'walker bay|pinot noir|red': [3, 12],
  'walker bay|chardonnay|white': [2, 10],

  // CONSTANTIA
  'constantia|sauvignon blanc|white': [1, 5],
  'constantia|semillon|white': [2, 8],

  // ELGIN
  'elgin|pinot noir|red': [3, 10],
  'elgin|chardonnay|white': [2, 8],
  'elgin|sauvignon blanc|white': [1, 4],

  // FRANSCHHOEK
  'franschhoek|semillon|white': [2, 10],
  'franschhoek|chenin blanc|white': [2, 8],
  'franschhoek|cabernet sauvignon|red': [4, 15],

  // PAARL
  'paarl|syrah|red': [3, 12],
  'paarl|chenin blanc|white': [2, 8],

  // CAPE SOUTH COAST
  'cape south coast|pinot noir|red': [3, 10],
  'cape south coast|chardonnay|white': [2, 8],
  'cape south coast|sauvignon blanc|white': [1, 5],

  // DARLING
  'darling|chenin blanc|white': [1, 6],
  'darling|sauvignon blanc|white': [1, 4],

  // OVERBERG
  'overberg|pinot noir|red': [3, 10],
  'overberg|chardonnay|white': [2, 8],

  // FRENCH REGIONS (fallback when no appellation)
  'bordeaux|cabernet sauvignon|red': [4, 15],
  'bordeaux|merlot|red': [3, 12],
  'burgundy|pinot noir|red': [3, 12],
  'burgundy|chardonnay|white': [2, 10],
  'rhône|syrah|red': [3, 15],
  'rhône|grenache|red': [3, 12],
  'loire|chenin blanc|white': [2, 12],
  'loire|cabernet franc|red': [2, 10],
  'loire|sauvignon blanc|white': [1, 5],
  'languedoc|syrah|red': [2, 10],
  'languedoc|grenache|red': [2, 8],
  'languedoc|carignan|red': [2, 8],
  'provence|mourvèdre|red': [4, 15],
  'provence|grenache|red': [2, 8],
}

/**
 * Region-only fallback: [drinkFromYears, drinkUntilYears]
 * Key: "regionName|color" (lowercase)
 */
const REGION_WINDOWS: Record<string, [number, number]> = {
  'swartland|red': [3, 15],
  'swartland|white': [2, 8],
  'stellenbosch|red': [3, 15],
  'stellenbosch|white': [2, 8],
  'hemel-en-aarde|red': [3, 12],
  'hemel-en-aarde|white': [2, 8],
  'walker bay|red': [3, 12],
  'walker bay|white': [2, 8],
  'constantia|white': [2, 10],
  'constantia|red': [3, 10],
  'elgin|red': [3, 10],
  'elgin|white': [2, 8],
  'franschhoek|red': [3, 12],
  'franschhoek|white': [2, 8],
  'paarl|red': [3, 12],
  'paarl|white': [2, 8],
  'cape south coast|red': [3, 10],
  'cape south coast|white': [2, 8],
  'coastal region|red': [3, 12],
  'coastal region|white': [2, 8],
  'western cape|red': [2, 10],
  'western cape|white': [1, 6],
  'darling|white': [1, 6],
  'overberg|red': [3, 10],
  'overberg|white': [2, 8],
  'bordeaux|red': [4, 15],
  'bordeaux|white': [2, 8],
  'burgundy|red': [3, 12],
  'burgundy|white': [2, 10],
  'bourgogne|red': [3, 12],
  'bourgogne|white': [2, 10],
  'rhône|red': [3, 12],
  'rhône|white': [1, 6],
  'provence|red': [3, 12],
  'provence|white': [1, 5],
  'provence|rosé': [0, 2],
  'loire|red': [2, 8],
  'loire|white': [2, 10],
  'languedoc|red': [2, 8],
  'languedoc|white': [1, 4],
  'languedoc-roussillon|red': [2, 8],
  'languedoc-roussillon|white': [1, 4],
  'alsace|white': [2, 10],
  'beaujolais|red': [1, 5],
  'jura|white': [2, 10],
  'savoie|white': [1, 5],
  'south west|red': [3, 10],
  'tuscany|red': [3, 15],
  'piedmont|red': [5, 20],
  'veneto|red': [3, 12],
  'rioja|red': [3, 15],
  'mendoza|red': [2, 10],
  'colchagua|red': [2, 10],
  'maipo|red': [3, 12],
}

/**
 * Color-only fallback (original defaults)
 */
const COLOR_WINDOWS: Record<string, [number, number]> = {
  red: [3, 15],
  white: [1, 8],
  rosé: [0, 3],
  rose: [0, 3],
  sparkling: [0, 10],
  dessert: [2, 30],
  fortified: [0, 50],
}

interface MaturityInput {
  vintage: number | null
  color: string
  appellationName?: string | null
  regionName?: string | null
  grapeName?: string | null
  // Wine-level defaults (from AI backfill)
  defaultDrinkFromYears?: number | null
  defaultDrinkUntilYears?: number | null
  // Lot-level overrides
  overrideDrinkFromYear?: number | null
  overrideDrinkUntilYear?: number | null
}

/**
 * Calculate the drinking window and maturity status for a wine.
 *
 * Priority:
 * 1. Lot-level overrides (absolute years)
 * 2. Wine-level AI defaults (years after vintage)
 * 3. Appellation + color lookup
 * 4. Region + grape + color lookup
 * 5. Region + color lookup
 * 6. Color-only fallback
 */
export function getDrinkingWindow(input: MaturityInput): DrinkingWindow {
  const {
    vintage, color,
    appellationName, regionName, grapeName,
    defaultDrinkFromYears, defaultDrinkUntilYears,
    overrideDrinkFromYear, overrideDrinkUntilYear,
  } = input
  const currentYear = new Date().getFullYear()
  const lColor = color.toLowerCase()

  // Non-vintage wines
  if (!vintage) {
    return {
      status: 'unknown',
      message: 'Non-vintage wine - drink at your discretion',
    }
  }

  let drinkFrom: number
  let drinkUntil: number
  let source: string

  // 1. Lot-level overrides (absolute years)
  if (overrideDrinkFromYear && overrideDrinkUntilYear) {
    drinkFrom = overrideDrinkFromYear
    drinkUntil = overrideDrinkUntilYear
    source = 'manual override'
  }
  // 2. Wine-level AI defaults
  else if (defaultDrinkFromYears != null && defaultDrinkUntilYears != null) {
    drinkFrom = vintage + defaultDrinkFromYears
    drinkUntil = vintage + defaultDrinkUntilYears
    source = 'AI estimate'
  }
  // 3. Appellation lookup
  else if (appellationName) {
    const appKey = `${appellationName.toLowerCase().trim()}|${lColor}`
    const appWindow = APPELLATION_WINDOWS[appKey]
    if (appWindow) {
      drinkFrom = vintage + appWindow[0]
      drinkUntil = vintage + appWindow[1]
      source = `appellation (${appellationName})`
    } else {
      // Appellation not in table — fall through to region
      ;[drinkFrom, drinkUntil, source] = resolveByRegion(vintage, lColor, regionName, grapeName)
    }
  }
  // 4-6. Region/grape/color fallback
  else {
    ;[drinkFrom, drinkUntil, source] = resolveByRegion(vintage, lColor, regionName, grapeName)
  }

  // Split drinking window into thirds: approaching | peak | past_prime
  const windowLength = drinkUntil - drinkFrom
  const thirdLength = Math.max(1, Math.round(windowLength / 3))
  const peakStart = drinkFrom + thirdLength
  const peakEnd = drinkFrom + thirdLength * 2

  // Determine status
  let status: MaturityStatus
  let message: string
  let yearsUntilReady: number | undefined
  let yearsPastPeak: number | undefined

  if (currentYear < drinkFrom) {
    // Before the drinking window — cellar it
    status = 'to_age'
    yearsUntilReady = drinkFrom - currentYear
    message = `To age - ${yearsUntilReady} year${yearsUntilReady > 1 ? 's' : ''} until drinking window`
  } else if (currentYear < peakStart) {
    // First third of window — approaching peak
    status = 'approaching'
    yearsUntilReady = peakStart - currentYear
    message = `Approaching peak - ${yearsUntilReady} year${yearsUntilReady > 1 ? 's' : ''} to go`
  } else if (currentYear <= peakEnd) {
    // Middle third — peak
    status = 'peak'
    message = 'At peak - ideal drinking window'
  } else if (currentYear <= drinkUntil) {
    // Last third — past prime
    status = 'past_prime'
    yearsPastPeak = currentYear - peakEnd
    message = `Past prime - still drinkable but ${yearsPastPeak} year${yearsPastPeak > 1 ? 's' : ''} past peak`
  } else {
    // Beyond the drinking window
    status = 'declining'
    yearsPastPeak = currentYear - drinkUntil
    message = `Declining - ${yearsPastPeak} year${yearsPastPeak > 1 ? 's' : ''} past drinking window`
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
    source,
  }
}

/**
 * Map maturity status to design phase with emoji
 */
export function getAgingPhase(status: MaturityStatus): {
  emoji: string
  label: string
  phase: string
} {
  switch (status) {
    case 'to_age':
      return { emoji: '🍇', label: 'Youth', phase: 'to_age' }
    case 'approaching':
      return { emoji: '😊', label: 'Maturity', phase: 'approaching' }
    case 'peak':
      return { emoji: '😍', label: 'Peak', phase: 'peak' }
    case 'past_prime':
      return { emoji: '📉', label: 'Past Prime', phase: 'past_prime' }
    case 'declining':
      return { emoji: '⚠️', label: 'Declining', phase: 'declining' }
    default:
      return { emoji: '❓', label: 'Unknown', phase: 'unknown' }
  }
}

/**
 * Resolve drinking window by region + grape, then region, then color fallback.
 * Returns [drinkFrom, drinkUntil, source]
 */
function resolveByRegion(
  vintage: number,
  color: string,
  regionName?: string | null,
  grapeName?: string | null,
): [number, number, string] {
  if (regionName) {
    const lRegion = regionName.toLowerCase().trim()
    const lGrape = grapeName?.toLowerCase().trim()

    // 4. Region + grape + color
    if (lGrape) {
      const rgKey = `${lRegion}|${lGrape}|${color}`
      const rgWindow = REGION_GRAPE_WINDOWS[rgKey]
      if (rgWindow) {
        return [vintage + rgWindow[0], vintage + rgWindow[1], `region+grape (${regionName}/${grapeName})`]
      }
    }

    // 5. Region + color
    const rKey = `${lRegion}|${color}`
    const rWindow = REGION_WINDOWS[rKey]
    if (rWindow) {
      return [vintage + rWindow[0], vintage + rWindow[1], `region (${regionName})`]
    }
  }

  // 6. Color-only fallback
  const cWindow = COLOR_WINDOWS[color] || COLOR_WINDOWS.red
  return [vintage + cWindow[0], vintage + cWindow[1], `color (${color})`]
}
