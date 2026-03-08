/**
 * Sommelier Onboarding Schema v1
 * 
 * Defines the questions, options, and how answers map to a taste profile.
 * The mobile app renders these as swipeable cards.
 * The mapper converts answers into a starter TasteProfile.
 */

export interface OnboardingQuestion {
  id: string
  title: string
  subtitle?: string
  type: 'single' | 'multi' | 'slider' | 'freetext'
  options?: OnboardingOption[]
  min?: number
  max?: number
  labels?: string[] // for slider
  required: boolean
  maxSelections?: number // for multi
}

export interface OnboardingOption {
  id: string
  label: string
  emoji?: string
  description?: string
}

export interface OnboardingAnswers {
  color_preference: string           // 'red' | 'white' | 'both' | 'sparkling'
  adventure_level: number            // 1-3
  region_picks: string[]             // region IDs from question 3
  favorite_grapes: string[]          // grape IDs from question 4
  dislikes: string[]                 // dislike IDs from question 5
  budget: string                     // budget range ID
  frequency: string                   // frequency ID
  goals: string                      // free text
}

export const onboardingQuestions: OnboardingQuestion[] = [
  {
    id: 'color_preference',
    title: 'What do you reach for?',
    subtitle: 'No wrong answer — we won\'t judge (much)',
    type: 'single',
    required: true,
    options: [
      { id: 'red', label: 'Red', emoji: '🍷' },
      { id: 'white', label: 'White', emoji: '🥂' },
      { id: 'both', label: 'Both', emoji: '🍷🥂', description: 'Equal opportunity drinker' },
      { id: 'sparkling', label: 'Bubbles first', emoji: '🫧', description: 'Life\'s too short for still wine' },
    ]
  },
  {
    id: 'adventure_level',
    title: 'How adventurous are you?',
    subtitle: 'Be honest — there\'s no shame in loving what you love',
    type: 'slider',
    min: 1,
    max: 3,
    labels: ['I know what I like', 'Open to suggestions', 'Surprise me always'],
    required: true,
  },
  {
    id: 'region_picks',
    title: 'Pick the wines that call to you',
    subtitle: 'Select up to 5 — your gut knows',
    type: 'multi',
    maxSelections: 5,
    required: true,
    options: [
      { id: 'bordeaux', label: 'Bordeaux', emoji: '🏰', description: 'Cabernet, Merlot, structure' },
      { id: 'burgundy', label: 'Burgundy', emoji: '🍇', description: 'Pinot Noir, Chardonnay, terroir obsession' },
      { id: 'rhone', label: 'Rhône Valley', emoji: '☀️', description: 'Syrah, Grenache, warmth' },
      { id: 'loire', label: 'Loire Valley', emoji: '🌊', description: 'Chenin, Cab Franc, freshness' },
      { id: 'champagne', label: 'Champagne', emoji: '🍾', description: 'Bubbles, celebration, craft' },
      { id: 'italy', label: 'Italy', emoji: '🇮🇹', description: 'Barolo, Chianti, Prosecco, endless variety' },
      { id: 'spain', label: 'Spain', emoji: '🇪🇸', description: 'Rioja, Priorat, Sherry, bold flavors' },
      { id: 'south_africa', label: 'South Africa', emoji: '🇿🇦', description: 'New wave, Chenin, Syrah, exciting scene' },
      { id: 'napa_california', label: 'California / Napa', emoji: '🌉', description: 'Big Cabs, bold Chardonnay' },
      { id: 'new_zealand', label: 'New Zealand', emoji: '🇳🇿', description: 'Sauvignon Blanc, Pinot Noir, purity' },
      { id: 'argentina', label: 'Argentina', emoji: '🇦🇷', description: 'Malbec, altitude, value' },
      { id: 'australia', label: 'Australia', emoji: '🇦🇺', description: 'Shiraz, Barossa, diversity' },
      { id: 'germany', label: 'Germany', emoji: '🇩🇪', description: 'Riesling, precision, elegance' },
      { id: 'portugal', label: 'Portugal', emoji: '🇵🇹', description: 'Port, Douro, indigenous grapes' },
      { id: 'natural', label: 'Natural / Orange', emoji: '🧡', description: 'Low intervention, funky, alive' },
    ]
  },
  {
    id: 'favorite_grapes',
    title: 'Any grapes you love?',
    subtitle: 'Pick your favorites — or skip if you\'re not sure yet',
    type: 'multi',
    maxSelections: 6,
    required: false,
    options: [
      // Reds
      { id: 'cabernet_sauvignon', label: 'Cabernet Sauvignon', emoji: '🔴', description: 'Bold, structured, king of reds' },
      { id: 'pinot_noir', label: 'Pinot Noir', emoji: '🔴', description: 'Elegant, silky, terroir-driven' },
      { id: 'syrah', label: 'Syrah / Shiraz', emoji: '🔴', description: 'Peppery, dark fruit, powerful' },
      { id: 'merlot', label: 'Merlot', emoji: '🔴', description: 'Soft, plummy, approachable' },
      { id: 'grenache', label: 'Grenache', emoji: '🔴', description: 'Fruity, warm, Mediterranean' },
      { id: 'malbec', label: 'Malbec', emoji: '🔴', description: 'Rich, juicy, Argentina\'s star' },
      { id: 'nebbiolo', label: 'Nebbiolo', emoji: '🔴', description: 'Tannic, complex, Barolo/Barbaresco' },
      { id: 'cab_franc', label: 'Cabernet Franc', emoji: '🔴', description: 'Herbal, elegant, Loire backbone' },
      { id: 'mourvedre', label: 'Mourvèdre', emoji: '🔴', description: 'Meaty, wild, Bandol star' },
      { id: 'sangiovese', label: 'Sangiovese', emoji: '🔴', description: 'Bright cherry, Tuscan soul' },
      { id: 'tempranillo', label: 'Tempranillo', emoji: '🔴', description: 'Leather, spice, Rioja' },
      { id: 'gamay', label: 'Gamay', emoji: '🔴', description: 'Light, crunchy, Beaujolais charm' },
      // Whites
      { id: 'chardonnay', label: 'Chardonnay', emoji: '⚪', description: 'Versatile — crisp to buttery' },
      { id: 'sauvignon_blanc', label: 'Sauvignon Blanc', emoji: '⚪', description: 'Zesty, green, refreshing' },
      { id: 'chenin_blanc', label: 'Chenin Blanc', emoji: '⚪', description: 'Honeyed to bone-dry, SA superstar' },
      { id: 'riesling', label: 'Riesling', emoji: '⚪', description: 'Aromatic, precise, age-worthy' },
      { id: 'viognier', label: 'Viognier', emoji: '⚪', description: 'Floral, peachy, aromatic' },
      { id: 'gruner_veltliner', label: 'Grüner Veltliner', emoji: '⚪', description: 'Peppery, fresh, Austrian star' },
      { id: 'gewurztraminer', label: 'Gewürztraminer', emoji: '⚪', description: 'Lychee, rose, love-it-or-hate-it' },
      { id: 'semillon', label: 'Sémillon', emoji: '⚪', description: 'Waxy, rich, blending magic' },
      { id: 'muscadet', label: 'Muscadet / Melon', emoji: '⚪', description: 'Mineral, oyster wine, Loire' },
      { id: 'vermentino', label: 'Vermentino', emoji: '⚪', description: 'Herby, Mediterranean, fresh' },
    ]
  },
  {
    id: 'dislikes',
    title: 'Anything you can\'t stand?',
    subtitle: 'This helps us avoid bad recommendations',
    type: 'multi',
    required: false,
    options: [
      { id: 'too_oaky', label: 'Too oaky / buttery', emoji: '🪵' },
      { id: 'too_sweet', label: 'Sweet wines', emoji: '🍬' },
      { id: 'too_tannic', label: 'Heavy tannins', emoji: '💪' },
      { id: 'too_acidic', label: 'Too sharp / acidic', emoji: '🍋' },
      { id: 'too_light', label: 'Too light / watery', emoji: '💧' },
      { id: 'too_funky', label: 'Natural / funky', emoji: '🧀' },
      { id: 'too_alcoholic', label: 'High alcohol / hot', emoji: '🔥' },
      { id: 'nothing', label: 'I\'ll try anything', emoji: '🤷', description: 'Respect.' },
    ]
  },
  {
    id: 'budget',
    title: 'Typical spend per bottle?',
    subtitle: 'No judgment — great wine exists at every price',
    type: 'single',
    required: true,
    options: [
      { id: 'under_10', label: 'Under €10', emoji: '💰', description: 'Smart drinking' },
      { id: '10_20', label: '€10 – €20', emoji: '💰💰', description: 'Sweet spot' },
      { id: '20_50', label: '€20 – €50', emoji: '💰💰💰', description: 'Treating yourself' },
      { id: '50_plus', label: '€50+', emoji: '💎', description: 'Life\'s too short' },
      { id: 'depends', label: 'Depends on the occasion', emoji: '🎭', description: '€8 Tuesday, €80 anniversary' },
    ]
  },
  {
    id: 'frequency',
    title: 'How often do you enjoy wine?',
    subtitle: 'No judgment — every pace is the right pace',
    type: 'single',
    required: true,
    options: [
      { id: 'daily', label: 'Almost every day', emoji: '🍷', description: 'Wine is part of the routine' },
      { id: 'few_week', label: 'A few times a week', emoji: '📅', description: 'Regular but not daily' },
      { id: 'weekends', label: 'Mostly weekends', emoji: '🎉', description: 'When there\'s time to enjoy it' },
      { id: 'occasionally', label: 'Occasionally', emoji: '✨', description: 'Special moments and dinners' },
      { id: 'getting_into_it', label: 'Just getting into it', emoji: '🌱', description: 'Starting the journey' },
    ]
  },
  {
    id: 'goals',
    title: 'What do you want us to achieve together?',
    subtitle: 'Dream big — this is your wine journey',
    type: 'freetext',
    required: false,
  },
]

/**
 * Maps onboarding answers to a starter TasteProfile
 */
export function buildProfileFromOnboarding(answers: OnboardingAnswers) {
  const profile: any = {
    version: 1,
    source: 'onboarding',
    generated: new Date().toISOString(),

    // Color preference
    colorPreference: mapColorPreference(answers.color_preference),

    // Adventure / exploration
    adventureLevel: answers.adventure_level, // 1-3
    explorationIndex: answers.adventure_level === 1 ? 15 : answers.adventure_level === 2 ? 50 : 85,

    // Region interests
    regionInterests: answers.region_picks || [],

    // Grape preferences
    favoriteGrapes: answers.favorite_grapes || [],

    // Negative preferences (very valuable signal)
    dislikes: answers.dislikes?.filter(d => d !== 'nothing') || [],
    openToAnything: answers.dislikes?.includes('nothing') || false,

    // Budget
    budget: answers.budget,
    budgetRange: mapBudget(answers.budget),

    // Usage context
    drinkingFrequency: answers.frequency,

    // Goals (free text — stored for sommelier context)
    goals: answers.goals || null,

    // Derived tags
    tags: generateOnboardingTags(answers),

    // These get populated as the user adds wines and rates them
    topProducers: [],
    consumptionHistory: [],
    vintageProfile: null,
    loyaltyScore: null,
    metrics: {
      totalBottles: 0,
      uniqueWines: 0,
      uniqueProducers: 0,
      totalConsumed: 0,
      totalRated: 0,
    }
  }

  return profile
}

function mapColorPreference(pref: string) {
  switch (pref) {
    case 'red': return { red: { pct: 75 }, white: { pct: 20 }, sparkling: { pct: 5 } }
    case 'white': return { red: { pct: 20 }, white: { pct: 75 }, sparkling: { pct: 5 } }
    case 'both': return { red: { pct: 45 }, white: { pct: 45 }, sparkling: { pct: 10 } }
    case 'sparkling': return { red: { pct: 20 }, white: { pct: 30 }, sparkling: { pct: 50 } }
    default: return { red: { pct: 40 }, white: { pct: 40 }, sparkling: { pct: 20 } }
  }
}

function mapBudget(budget: string) {
  switch (budget) {
    case 'under_10': return { min: 0, max: 10, currency: 'EUR' }
    case '10_20': return { min: 10, max: 20, currency: 'EUR' }
    case '20_50': return { min: 20, max: 50, currency: 'EUR' }
    case '50_plus': return { min: 50, max: 500, currency: 'EUR' }
    case 'depends': return { min: 8, max: 100, currency: 'EUR' }
    default: return { min: 10, max: 30, currency: 'EUR' }
  }
}

function generateOnboardingTags(answers: OnboardingAnswers): string[] {
  const tags: string[] = []

  // Color
  if (answers.color_preference === 'both') tags.push('balanced_red_white')
  if (answers.color_preference === 'red') tags.push('red_dominant')
  if (answers.color_preference === 'white') tags.push('white_dominant')
  if (answers.color_preference === 'sparkling') tags.push('bubble_lover')

  // Adventure
  if (answers.adventure_level === 1) tags.push('comfort_zone')
  if (answers.adventure_level === 2) tags.push('open_minded')
  if (answers.adventure_level === 3) tags.push('thrill_seeker')

  // Regions
  if (answers.region_picks?.includes('natural')) tags.push('natural_wine_curious')
  if (answers.region_picks?.includes('south_africa')) tags.push('south_africa_interested')
  if (answers.region_picks?.includes('bordeaux')) tags.push('classic_taste')
  if (answers.region_picks?.includes('italy')) tags.push('italian_curious')

  // Grapes
  if (answers.favorite_grapes?.includes('chenin_blanc')) tags.push('chenin_lover')
  if (answers.favorite_grapes?.includes('syrah')) tags.push('syrah_fan')
  if (answers.favorite_grapes?.includes('nebbiolo')) tags.push('nebbiolo_curious')
  if (answers.favorite_grapes?.includes('riesling')) tags.push('riesling_appreciator')

  // Dislikes
  if (answers.dislikes?.includes('too_oaky')) tags.push('anti_oak')
  if (answers.dislikes?.includes('too_sweet')) tags.push('dry_preference')
  if (answers.dislikes?.includes('nothing')) tags.push('open_palate')

  // Occasion
  if (answers.frequency === 'daily') tags.push('daily_drinker')
  if (answers.frequency === 'getting_into_it') tags.push('wine_beginner')
  if (answers.frequency === 'occasionally') tags.push('casual_enjoyer')

  return tags
}
