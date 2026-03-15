/**
 * Wine Knowledge Base integration.
 * Provides fast local lookups (293K+ wines) to avoid expensive LLM calls.
 * 
 * Flow:
 *   1. Text input → FTS search against knowledge DB
 *   2. If strong match found → return structured data (skip LLM)
 *   3. If no match → fall through to Anthropic API
 */
import Database from 'better-sqlite3'
import { join } from 'path'
import { existsSync } from 'fs'

// In Docker: mounted at /app/knowledge/wine-knowledge.db
// In dev: relative path from wine-cellar to bibo-knowledge
const KB_PATH = process.env.KB_PATH 
  || (existsSync('/app/knowledge/wine-knowledge.db') 
    ? '/app/knowledge/wine-knowledge.db' 
    : join(process.cwd(), '..', 'bibo-knowledge', 'db', 'wine-knowledge.db'))

let _db: ReturnType<typeof Database> | null = null

function getDb() {
  if (!_db) {
    try {
      _db = new Database(KB_PATH, { readonly: true })
      _db.pragma('journal_mode = WAL')
    } catch (e) {
      console.warn('[knowledge] Could not open knowledge DB:', (e as Error).message)
      return null
    }
  }
  return _db
}

function cleanQuery(query: string): string {
  return query.replace(/[^a-zA-ZÀ-ÿ0-9\s''-]/g, '').trim()
}

interface KBWineResult {
  wine_name: string
  producer_name: string
  region_name: string | null
  country_name: string | null
  country_code: string | null
  appellation_name: string | null
  color: string | null
  rank: number
}

interface ParsedWine {
  producer: string
  wineName: string
  vintage: number | null
  color: string
  region: string | null
  appellation: string | null
}

/**
 * Search knowledge base for wines matching free text.
 * Returns structured results or empty array.
 */
export function searchKnowledge(text: string, limit = 10): KBWineResult[] {
  const db = getDb()
  if (!db) return []

  const cleaned = cleanQuery(text)
  const terms = cleaned.split(/\s+/).filter(t => t.length > 1)
  if (terms.length === 0) return []

  // Strip vintage from search terms
  const vintageMatch = text.match(/\b(19|20)\d{2}\b/)
  const nonVintageTerms = terms.filter(t => !t.match(/^(19|20)\d{2}$/))

  if (nonVintageTerms.length === 0) return []

  try {
    // Try exact phrase match first
    const exact = nonVintageTerms.map(t => `"${t}"`).join(' ')
    let results = db.prepare(`
      SELECT 
        w.name as wine_name,
        p.name as producer_name,
        r.name as region_name,
        c.name as country_name,
        c.code as country_code,
        a.name as appellation_name,
        w.color
      FROM wines_fts fts
      JOIN wines w ON w.id = CAST(fts.rowid AS INTEGER)
      JOIN producers p ON w.producer_id = p.id
      LEFT JOIN regions r ON p.region_id = r.id
      LEFT JOIN countries c ON p.country_id = c.id
      LEFT JOIN appellations a ON w.appellation_id = a.id
      WHERE wines_fts MATCH ?
      ORDER BY fts.rank
      LIMIT ?
    `).all(exact, limit) as KBWineResult[]

    // Fallback to prefix search
    if (results.length === 0) {
      const prefix = nonVintageTerms.map(t => `${t}*`).join(' ')
      results = db.prepare(`
        SELECT 
          w.name as wine_name,
          p.name as producer_name,
          r.name as region_name,
          c.name as country_name,
          c.code as country_code,
          a.name as appellation_name,
          w.color
        FROM wines_fts fts
        JOIN wines w ON w.id = CAST(fts.rowid AS INTEGER)
        JOIN producers p ON w.producer_id = p.id
        LEFT JOIN regions r ON p.region_id = r.id
        LEFT JOIN countries c ON p.country_id = c.id
        LEFT JOIN appellations a ON w.appellation_id = a.id
        WHERE wines_fts MATCH ?
        ORDER BY fts.rank
        LIMIT ?
      `).all(prefix, limit) as KBWineResult[]
    }

    // Also search producers directly
    if (results.length === 0) {
      const prefix = nonVintageTerms.map(t => `${t}*`).join(' ')
      results = db.prepare(`
        SELECT 
          w.name as wine_name,
          p.name as producer_name,
          r.name as region_name,
          c.name as country_name,
          c.code as country_code,
          a.name as appellation_name,
          w.color
        FROM producers_fts pfts
        JOIN producers p ON p.id = CAST(pfts.rowid AS INTEGER)
        JOIN wines w ON w.producer_id = p.id
        LEFT JOIN regions r ON p.region_id = r.id
        LEFT JOIN countries c ON p.country_id = c.id
        LEFT JOIN appellations a ON w.appellation_id = a.id
        WHERE producers_fts MATCH ?
        ORDER BY pfts.rank
        LIMIT ?
      `).all(prefix, limit) as KBWineResult[]
    }

    return results
  } catch (e) {
    console.warn('[knowledge] Search error:', (e as Error).message)
    return []
  }
}

/**
 * Try to parse wine text using knowledge base alone (no LLM).
 * Returns parsed wine data if confident match found, null otherwise.
 */
export function tryParseFromKnowledge(text: string): ParsedWine | null {
  const results = searchKnowledge(text, 5)
  if (results.length === 0) return null

  const best = results[0]

  // Extract vintage from original text
  const vintageMatch = text.match(/\b(19|20)\d{2}\b/)
  const vintage = vintageMatch ? parseInt(vintageMatch[0]) : null

  // Confidence check: the top result should contain key terms from the input
  const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const inputNorm = normalize(text)
  const producerNorm = normalize(best.producer_name || '')
  const wineNorm = normalize(best.wine_name || '')

  // Check if any significant word from producer or wine appears in input
  const producerWords = producerNorm.split(/\s+/).filter(w => w.length > 2)
  const wineWords = wineNorm.split(/\s+/).filter(w => w.length > 2)
  
  const producerMatch = producerWords.some(w => inputNorm.includes(w))
  const wineMatch = wineWords.some(w => inputNorm.includes(w))

  // Need at least producer or wine name match
  if (!producerMatch && !wineMatch) return null

  // Map KB color to our enum
  const colorMap: Record<string, string> = {
    red: 'red', white: 'white', rose: 'rose', rosé: 'rose',
    sparkling: 'sparkling', dessert: 'dessert', fortified: 'fortified',
  }
  const color = colorMap[best.color?.toLowerCase() || ''] || 'red'

  // Clean duplicated text from FTS (stores "Original Normalized" pairs)
  const cleanDup = (s: string) => {
    const half = Math.floor(s.length / 2)
    const first = s.substring(0, half).trim()
    const second = s.substring(half).trim()
    // If first half ≈ second half, return just the first (accented) version
    if (first.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 
        second.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')) {
      return first
    }
    return s
  }

  return {
    producer: cleanDup(best.producer_name),
    wineName: cleanDup(best.wine_name),
    vintage,
    color,
    region: best.region_name ? cleanDup(best.region_name) : null,
    appellation: best.appellation_name?.trim() || null,
  }
}

/**
 * Enrich AI-parsed results with knowledge base data.
 * Fills in missing region/appellation/color from KB if available.
 */
export function enrichWithKnowledge(parsed: ParsedWine): ParsedWine {
  const db = getDb()
  if (!db) return parsed

  try {
    // Search by producer + wine name
    const searchTerms = [parsed.producer, parsed.wineName].filter(Boolean).join(' ')
    const results = searchKnowledge(searchTerms, 3)

    if (results.length === 0) return parsed

    const best = results[0]

    // Only fill in missing fields, don't override AI results
    return {
      ...parsed,
      region: parsed.region || best.region_name,
      appellation: parsed.appellation || best.appellation_name,
      color: parsed.color || (best.color as string) || 'red',
    }
  } catch {
    return parsed
  }
}

/**
 * Get knowledge base stats
 */
export function knowledgeStats() {
  const db = getDb()
  if (!db) return null

  try {
    return {
      wines: (db.prepare('SELECT COUNT(*) as n FROM wines').get() as any).n,
      producers: (db.prepare('SELECT COUNT(*) as n FROM producers').get() as any).n,
    }
  } catch {
    return null
  }
}

// ============================================================================
// EXTENDED ENRICHMENT - Images, Tasting Notes, Food Pairings, Taste Structure
// ============================================================================

export interface WineEnrichment {
  // Basic info
  wineName: string
  producer: string
  region: string | null
  country: string | null
  countryCode: string | null
  appellation: string | null
  color: string | null
  grape: string | null
  
  // Images
  imageUrl: string | null
  thumbnailUrl: string | null
  
  // Taste structure (1-5 scale)
  acidity: number | null
  intensity: number | null
  sweetness: number | null
  tannin: number | null
  
  // Aging windows (years from vintage)
  agingPeakMin: number | null
  agingPeakMax: number | null
  agingDeclineMin: number | null
  
  // Food pairings
  foodPairings: string[]
  
  // Critic reviews
  criticReviews: {
    vintage: number | null
    score: number | null
    tastingNote: string | null
    critic: string | null
    source: string
  }[]
}

/**
 * Get full enrichment data for a wine by ID.
 */
export function getWineEnrichment(wineId: number): WineEnrichment | null {
  const db = getDb()
  if (!db) return null

  try {
    const wine = db.prepare(`
      SELECT 
        w.name as wine_name,
        w.color,
        w.image_url,
        w.thumbnail_url,
        w.acidity,
        w.intensity,
        w.sweetness,
        w.tannin,
        w.aging_peak_min,
        w.aging_peak_max,
        w.aging_decline_min,
        p.name as producer_name,
        r.name as region_name,
        c.name as country_name,
        c.code as country_code,
        a.name as appellation_name,
        g.name as grape_name
      FROM wines w
      JOIN producers p ON w.producer_id = p.id
      LEFT JOIN regions r ON p.region_id = r.id
      LEFT JOIN countries c ON p.country_id = c.id
      LEFT JOIN appellations a ON w.appellation_id = a.id
      LEFT JOIN grapes g ON w.grape_id = g.id
      WHERE w.id = ?
    `).get(wineId) as any

    if (!wine) return null

    // Get food pairings
    const pairings = db.prepare(`
      SELECT fc.display_name
      FROM wine_food_pairings wfp
      JOIN food_categories fc ON wfp.food_category_id = fc.id
      WHERE wfp.wine_id = ?
    `).all(wineId) as { display_name: string }[]

    // Get critic reviews
    const reviews = db.prepare(`
      SELECT vintage, score, tasting_note, critic, source
      FROM critic_reviews
      WHERE wine_id = ?
      ORDER BY vintage DESC
      LIMIT 10
    `).all(wineId) as any[]

    return {
      wineName: wine.wine_name,
      producer: wine.producer_name,
      region: wine.region_name,
      country: wine.country_name,
      countryCode: wine.country_code,
      appellation: wine.appellation_name,
      color: wine.color,
      grape: wine.grape_name,
      imageUrl: wine.image_url,
      thumbnailUrl: wine.thumbnail_url,
      acidity: wine.acidity,
      intensity: wine.intensity,
      sweetness: wine.sweetness,
      tannin: wine.tannin,
      agingPeakMin: wine.aging_peak_min,
      agingPeakMax: wine.aging_peak_max,
      agingDeclineMin: wine.aging_decline_min,
      foodPairings: pairings.map(p => p.display_name),
      criticReviews: reviews.map(r => ({
        vintage: r.vintage,
        score: r.score,
        tastingNote: r.tasting_note,
        critic: r.critic,
        source: r.source,
      })),
    }
  } catch (e) {
    console.warn('[knowledge] Enrichment error:', (e as Error).message)
    return null
  }
}

export interface KBSearchResult {
  id: number
  wineName: string
  producer: string
  region: string | null
  country: string | null
  countryCode: string | null
  appellation: string | null
  color: string | null
  imageUrl: string | null
  thumbnailUrl: string | null
  // Preview data
  score: number | null  // Best critic score
  foodPairings: string[]  // First 3
}

/**
 * Search knowledge base and return rich results for display.
 */
export function searchKnowledgeRich(text: string, limit = 20): KBSearchResult[] {
  const db = getDb()
  if (!db) return []

  const cleaned = cleanQuery(text)
  const terms = cleaned.split(/\s+/).filter(t => t.length > 1)
  if (terms.length === 0) return []

  // Strip vintage
  const nonVintageTerms = terms.filter(t => !t.match(/^(19|20)\d{2}$/))
  if (nonVintageTerms.length === 0) return []

  try {
    // FTS search with enrichment data
    const prefix = nonVintageTerms.map(t => `${t}*`).join(' ')
    
    const results = db.prepare(`
      SELECT DISTINCT
        w.id,
        w.name as wine_name,
        w.color,
        w.image_url,
        w.thumbnail_url,
        p.name as producer_name,
        r.name as region_name,
        c.name as country_name,
        c.code as country_code,
        a.name as appellation_name,
        (SELECT MAX(score) FROM critic_reviews WHERE wine_id = w.id) as best_score
      FROM wines_fts fts
      JOIN wines w ON w.id = CAST(fts.rowid AS INTEGER)
      JOIN producers p ON w.producer_id = p.id
      LEFT JOIN regions r ON p.region_id = r.id
      LEFT JOIN countries c ON p.country_id = c.id
      LEFT JOIN appellations a ON w.appellation_id = a.id
      WHERE wines_fts MATCH ?
      ORDER BY 
        CASE WHEN w.image_url IS NOT NULL THEN 0 ELSE 1 END,
        fts.rank
      LIMIT ?
    `).all(prefix, limit) as any[]

    // Get food pairings for each result
    const pairingStmt = db.prepare(`
      SELECT fc.display_name
      FROM wine_food_pairings wfp
      JOIN food_categories fc ON wfp.food_category_id = fc.id
      WHERE wfp.wine_id = ?
      LIMIT 3
    `)

    return results.map(r => ({
      id: r.id,
      wineName: r.wine_name,
      producer: r.producer_name,
      region: r.region_name,
      country: r.country_name,
      countryCode: r.country_code,
      appellation: r.appellation_name,
      color: r.color,
      imageUrl: r.image_url,
      thumbnailUrl: r.thumbnail_url,
      score: r.best_score,
      foodPairings: (pairingStmt.all(r.id) as { display_name: string }[]).map(p => p.display_name),
    }))
  } catch (e) {
    console.warn('[knowledge] Rich search error:', (e as Error).message)
    return []
  }
}

/**
 * Find best match for scanned label text and return full enrichment.
 */
export function matchAndEnrich(labelText: string): (WineEnrichment & { confidence: number }) | null {
  const db = getDb()
  if (!db) return null

  const cleaned = cleanQuery(labelText)
  const terms = cleaned.split(/\s+/).filter(t => t.length > 1)
  if (terms.length === 0) return null

  // Strip vintage
  const nonVintageTerms = terms.filter(t => !t.match(/^(19|20)\d{2}$/))
  if (nonVintageTerms.length === 0) return null

  try {
    const prefix = nonVintageTerms.map(t => `${t}*`).join(' ')
    
    const match = db.prepare(`
      SELECT w.id, w.name, p.name as producer_name, fts.rank
      FROM wines_fts fts
      JOIN wines w ON w.id = CAST(fts.rowid AS INTEGER)
      JOIN producers p ON w.producer_id = p.id
      WHERE wines_fts MATCH ?
      ORDER BY fts.rank
      LIMIT 1
    `).get(prefix) as { id: number; name: string; producer_name: string; rank: number } | undefined

    if (!match) return null

    // Calculate confidence based on term overlap
    const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const inputNorm = normalize(labelText)
    const producerNorm = normalize(match.producer_name)
    const wineNorm = normalize(match.name)

    const producerWords = producerNorm.split(/\s+/).filter(w => w.length > 2)
    const wineWords = wineNorm.split(/\s+/).filter(w => w.length > 2)
    
    const matchedProducer = producerWords.filter(w => inputNorm.includes(w)).length
    const matchedWine = wineWords.filter(w => inputNorm.includes(w)).length
    const totalWords = producerWords.length + wineWords.length

    const confidence = totalWords > 0 
      ? Math.round(((matchedProducer + matchedWine) / totalWords) * 100)
      : 0

    if (confidence < 30) return null  // Too low confidence

    const enrichment = getWineEnrichment(match.id)
    if (!enrichment) return null

    return { ...enrichment, confidence }
  } catch (e) {
    console.warn('[knowledge] Match error:', (e as Error).message)
    return null
  }
}
