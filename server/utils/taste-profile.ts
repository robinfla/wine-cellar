/**
 * Taste Profile Engine
 * 
 * Two sources feed the profile:
 * 1. Onboarding answers (cold start)
 * 2. Cellar analysis (ongoing, gets stronger over time)
 * 
 * As the user adds wines, rates them, and uses the sommelier,
 * the cellar-derived signals gradually override onboarding answers.
 * 
 * The profile is stored as JSON on the user record and regenerated
 * periodically (on consume, on rating, on cellar changes).
 */

export interface TasteProfile {
  version: number
  source: 'onboarding' | 'cellar' | 'merged'
  generated: string

  // Core preferences
  colorPreference: Record<string, { pct: number; bottles?: number }>
  adventureLevel: number // 1-3
  explorationIndex: number // 0-100

  // What they like
  regionInterests: string[]
  regionProfile?: Array<{ region: string; bottles: number; pct: number }>
  favoriteGrapes: string[]
  topProducers: Array<{ name: string; bottles: number }>

  // What they don't like (strong signal)
  dislikes: string[]
  openToAnything: boolean

  // Context
  budget: string
  budgetRange: { min: number; max: number; currency: string }
  drinkingFrequency: string
  goals: string | null

  // Vintage
  vintageProfile?: {
    preference: 'youthful_freshness' | 'aged_complexity'
    avgVintage?: number
  }

  // Metrics
  metrics: {
    totalBottles: number
    uniqueWines: number
    uniqueProducers: number
    totalConsumed: number
    totalRated: number
  }

  // Derived
  tags: string[]
  loyaltyScore: number | null

  // Conversation memory
  learnedPreferences?: string[] // extracted from sommelier conversations
  consumptionHistory?: Array<{
    wine: string
    producer: string
    color: string
    vintage: number
    rating?: number
    notes?: string
    date: string
  }>
}

/**
 * Merge onboarding profile with cellar-derived data.
 * Cellar data wins when it has enough signal (>10 bottles).
 */
export function mergeProfiles(
  onboarding: Partial<TasteProfile>,
  cellar: Partial<TasteProfile> | null
): TasteProfile {
  // If no cellar data yet, return onboarding as-is
  if (!cellar || !cellar.metrics || cellar.metrics.totalBottles < 5) {
    return {
      ...onboarding,
      source: 'onboarding',
    } as TasteProfile
  }

  const totalBottles = cellar.metrics!.totalBottles
  // Weight: 0 = all onboarding, 1 = all cellar
  // Ramps up: 5 bottles = 0.3, 20 bottles = 0.7, 50+ bottles = 0.95
  const cellarWeight = Math.min(0.95, totalBottles / 60)
  const onboardingWeight = 1 - cellarWeight

  const merged: TasteProfile = {
    version: 1,
    source: 'merged',
    generated: new Date().toISOString(),

    // Color: cellar data is truth if available
    colorPreference: cellar.colorPreference || onboarding.colorPreference!,

    // Adventure: keep onboarding (it's a personality trait, not data-derivable)
    adventureLevel: onboarding.adventureLevel || 2,

    // Exploration: cellar is ground truth
    explorationIndex: cellar.explorationIndex ?? onboarding.explorationIndex ?? 50,

    // Regions: merge both (onboarding = interest, cellar = actual behavior)
    regionInterests: mergeArrays(
      onboarding.regionInterests || [],
      cellar.regionProfile?.map(r => r.region.toLowerCase().replace(/\s+/g, '_')) || []
    ),
    regionProfile: cellar.regionProfile,

    // Grapes: keep onboarding + augment with cellar data
    favoriteGrapes: onboarding.favoriteGrapes || [],

    // Producers: cellar only
    topProducers: cellar.topProducers || [],

    // Dislikes: ALWAYS keep onboarding dislikes (negative prefs are stable)
    dislikes: onboarding.dislikes || [],
    openToAnything: onboarding.openToAnything || false,

    // Context: onboarding
    budget: onboarding.budget || 'depends',
    budgetRange: onboarding.budgetRange || { min: 10, max: 50, currency: 'EUR' },
    drinkingFrequency: onboarding.drinkingFrequency || 'few_week',
    goals: onboarding.goals || null,

    // Vintage: cellar
    vintageProfile: cellar.vintageProfile,

    // Metrics: cellar
    metrics: cellar.metrics!,

    // Tags: merge both, deduplicate
    tags: mergeArrays(onboarding.tags || [], cellar.tags || []),

    // Loyalty: cellar
    loyaltyScore: cellar.loyaltyScore ?? null,

    // Conversation learnings: preserved
    learnedPreferences: onboarding.learnedPreferences || [],

    // History: cellar
    consumptionHistory: cellar.consumptionHistory,
  }

  return merged
}

function mergeArrays(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])]
}

/**
 * Generate the sommelier context injection from a taste profile.
 * This is what gets prepended to every sommelier conversation.
 * Kept tight to minimize token usage (~300-500 tokens).
 */
export function profileToSommelierContext(profile: TasteProfile): string {
  const lines: string[] = []

  lines.push('## User Wine Profile')

  // Stats
  if (profile.metrics.totalBottles > 0) {
    lines.push(`Cellar: ${profile.metrics.totalBottles} bottles, ${profile.metrics.uniqueWines} wines, ${profile.metrics.uniqueProducers} producers.`)
  } else {
    lines.push('New user — no cellar yet. Rely on onboarding preferences.')
  }

  // Color
  const colors = Object.entries(profile.colorPreference)
    .filter(([_, v]) => v.pct > 5)
    .map(([c, v]) => `${c} ${v.pct}%`)
    .join(', ')
  if (colors) lines.push(`Color preference: ${colors}`)

  // Regions
  if (profile.regionProfile?.length) {
    const topRegions = profile.regionProfile.slice(0, 5).map(r => `${r.region} (${r.pct}%)`).join(', ')
    lines.push(`Top regions: ${topRegions}`)
  } else if (profile.regionInterests.length) {
    lines.push(`Interested in: ${profile.regionInterests.join(', ')}`)
  }

  // Grapes
  if (profile.favoriteGrapes.length) {
    lines.push(`Favorite grapes: ${profile.favoriteGrapes.join(', ')}`)
  }

  // Top producers
  if (profile.topProducers.length) {
    const top5 = profile.topProducers.slice(0, 5).map(p => p.name).join(', ')
    lines.push(`Favorite producers: ${top5}`)
  }

  // DISLIKES (important — always include)
  if (profile.dislikes.length) {
    lines.push(`⚠️ Dislikes: ${profile.dislikes.join(', ')}`)
  }
  if (profile.openToAnything) {
    lines.push('Open to trying anything.')
  }

  // Budget
  if (profile.budgetRange) {
    lines.push(`Budget: €${profile.budgetRange.min}-${profile.budgetRange.max} typical`)
  }

  // Frequency
  if (profile.drinkingFrequency) {
    const freqLabels: Record<string, string> = {
      daily: 'Drinks wine almost every day',
      few_week: 'A few times a week',
      weekends: 'Mostly weekends',
      occasionally: 'Occasional drinker',
      getting_into_it: 'Just getting into wine — be welcoming and educational'
    }
    lines.push(`Frequency: ${freqLabels[profile.drinkingFrequency] || profile.drinkingFrequency}`)
  }

  // Goals
  if (profile.goals) {
    lines.push(`Goals: "${profile.goals}"`)
  }

  // Adventure level
  const adventureLabels = ['Comfort zone — stick to known styles', 'Open to suggestions', 'Loves discovery — push boundaries']
  lines.push(`Adventure: ${adventureLabels[profile.adventureLevel - 1] || 'Open'}`)

  // Vintage preference
  if (profile.vintageProfile) {
    lines.push(`Vintage preference: ${profile.vintageProfile.preference === 'youthful_freshness' ? 'Prefers younger wines' : 'Appreciates aged wines'}`)
  }

  // Tags (compact)
  if (profile.tags.length) {
    lines.push(`Style tags: ${profile.tags.join(', ')}`)
  }

  // Learned preferences from conversations
  if (profile.learnedPreferences?.length) {
    lines.push(`Learned from conversations: ${profile.learnedPreferences.join('; ')}`)
  }

  return lines.join('\n')
}

/**
 * Extract taste preferences from a sommelier conversation.
 * Called after each conversation turn with a cheap model (Haiku).
 * Returns new preferences to add to the profile.
 */
export function buildPreferenceExtractionPrompt(userMessage: string, assistantMessage: string): string {
  return `Extract any wine taste preferences expressed by the user in this exchange.
Return a JSON array of preference strings, or empty array if none found.
Only extract EXPLICIT preferences, not inferred ones.

Examples of preferences:
- "doesn't like oaky wines"
- "prefers dry whites"  
- "loves Syrah from Northern Rhône"
- "finds Pinot Noir too light"
- "interested in trying natural wines"
- "birthday dinner coming up — wants something special"

User: ${userMessage}
Assistant: ${assistantMessage}

Preferences (JSON array):`
}
