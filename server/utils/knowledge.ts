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
