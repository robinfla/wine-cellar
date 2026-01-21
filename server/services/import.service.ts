import { createHash } from 'crypto'
import { eq, and, like } from 'drizzle-orm'
import { db } from '../utils/db'
import {
  wines,
  producers,
  regions,
  appellations,
  grapes,
  formats,
  cellars,
  inventoryLots,
  inventoryEvents,
  wineGrapes,
} from '../db/schema'

export interface ImportRow {
  cellar: string
  producer: string
  wineName: string
  color: string
  region?: string
  appellation?: string
  grapes?: string // semicolon separated
  vintage?: number | string
  format?: string
  quantity: number | string
  purchaseDate?: string
  purchasePricePerBottle?: number | string
  purchaseCurrency?: string
  purchaseSource?: string
  notes?: string
}

export interface ValidatedRow extends ImportRow {
  rowIndex: number
  isValid: boolean
  errors: string[]
  warnings: string[]
  // Resolved IDs
  cellarId?: number
  producerId?: number
  regionId?: number
  appellationId?: number
  wineId?: number
  formatId?: number
  grapeIds?: number[]
  // Deduplication
  importHash: string
  isDuplicate: boolean
}

export interface ImportResult {
  success: boolean
  imported: number
  skipped: number
  errors: { row: number; message: string }[]
}

/**
 * Generate a hash for deduplication based on key fields
 */
export function generateImportHash(row: ImportRow): string {
  const normalized = [
    row.producer?.toLowerCase().trim(),
    row.wineName?.toLowerCase().trim(),
    row.vintage?.toString() || 'nv',
    row.format?.toLowerCase().trim() || 'standard',
    row.cellar?.toLowerCase().trim(),
  ].join('|')

  return createHash('sha256').update(normalized).digest('hex').substring(0, 32)
}

/**
 * Normalize color input to enum value
 */
function normalizeColor(color: string): string | null {
  const colorMap: Record<string, string> = {
    red: 'red',
    rouge: 'red',
    white: 'white',
    blanc: 'white',
    rose: 'rose',
    rosé: 'rose',
    pink: 'rose',
    sparkling: 'sparkling',
    champagne: 'sparkling',
    effervescent: 'sparkling',
    dessert: 'dessert',
    sweet: 'dessert',
    liquoreux: 'dessert',
    fortified: 'fortified',
    porto: 'fortified',
    port: 'fortified',
    sherry: 'fortified',
  }

  const normalized = color?.toLowerCase().trim()
  return colorMap[normalized] || null
}

/**
 * Find or create a region
 */
async function findOrCreateRegion(name: string): Promise<number> {
  const trimmedName = name.trim()

  // Try to find existing (case-insensitive)
  const existing = await db
    .select()
    .from(regions)
    .where(like(regions.name, trimmedName))
    .limit(1)

  if (existing.length > 0) {
    return existing[0].id
  }

  // Create new - default to FR country code, can be updated later
  const [created] = await db
    .insert(regions)
    .values({ name: trimmedName, countryCode: 'FR' })
    .returning()

  return created.id
}

/**
 * Find or create an appellation
 */
async function findOrCreateAppellation(name: string, regionId?: number): Promise<number> {
  const trimmedName = name.trim()

  // Try to find existing (case-insensitive)
  const existing = await db
    .select()
    .from(appellations)
    .where(like(appellations.name, trimmedName))
    .limit(1)

  if (existing.length > 0) {
    return existing[0].id
  }

  // Create new
  const [created] = await db
    .insert(appellations)
    .values({ name: trimmedName, regionId })
    .returning()

  return created.id
}

async function findOrCreateProducer(
  name: string,
  userId: number,
  regionId?: number,
): Promise<number> {
  const existing = await db
    .select()
    .from(producers)
    .where(and(eq(producers.name, name), eq(producers.userId, userId)))
    .limit(1)

  if (existing.length > 0) {
    return existing[0].id
  }

  const [created] = await db
    .insert(producers)
    .values({ name, userId, regionId })
    .returning()

  return created.id
}

async function findOrCreateWine(
  name: string,
  producerId: number,
  userId: number,
  color: string,
  appellationId?: number,
): Promise<number> {
  const existing = await db
    .select()
    .from(wines)
    .where(and(eq(wines.name, name), eq(wines.producerId, producerId), eq(wines.userId, userId)))
    .limit(1)

  if (existing.length > 0) {
    return existing[0].id
  }

  const [created] = await db
    .insert(wines)
    .values({
      name,
      userId,
      producerId,
      color: color as any,
      appellationId,
    })
    .returning()

  return created.id
}

export async function validateImportRows(
  rows: ImportRow[],
  userId: number,
): Promise<ValidatedRow[]> {
  const [allCellars, allRegions, allAppellations, allGrapes, allFormats, existingHashes] =
    await Promise.all([
      db.select().from(cellars).where(eq(cellars.userId, userId)),
      db.select().from(regions),
      db.select().from(appellations),
      db.select().from(grapes),
      db.select().from(formats),
      db.select({ hash: inventoryLots.importHash }).from(inventoryLots).where(eq(inventoryLots.userId, userId)),
    ])

  const hashSet = new Set(existingHashes.map((h) => h.hash).filter(Boolean))

  const validated: ValidatedRow[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const errors: string[] = []
    const warnings: string[] = []

    // Generate hash for deduplication
    const importHash = generateImportHash(row)
    const isDuplicate = hashSet.has(importHash)

    if (isDuplicate) {
      warnings.push('This row appears to be a duplicate of an existing entry')
    }

    // Validate required fields
    if (!row.cellar) errors.push('Cellar is required')
    if (!row.producer) errors.push('Producer is required')
    if (!row.wineName) errors.push('Wine name is required')
    if (!row.color) errors.push('Color is required')
    if (!row.quantity || Number(row.quantity) < 1) errors.push('Quantity must be at least 1')

    // Resolve cellar (required - must exist)
    const cellar = allCellars.find(
      (c) => c.name.toLowerCase() === row.cellar?.toLowerCase().trim(),
    )
    if (!cellar && row.cellar) {
      errors.push(`Cellar "${row.cellar}" not found`)
    }

    // Normalize and validate color
    const normalizedColor = normalizeColor(row.color)
    if (!normalizedColor && row.color) {
      errors.push(`Invalid color "${row.color}"`)
    }

    // Resolve region (optional - try to match, will create if not found)
    let regionId: number | undefined
    if (row.region) {
      const regionName = row.region.trim()
      const region = allRegions.find(
        (r) => r.name.toLowerCase() === regionName.toLowerCase(),
      )
      if (region) {
        regionId = region.id
      }
      // No warning - will create new region during import if needed
    }

    // Resolve appellation (optional - try to match, will create if not found)
    let appellationId: number | undefined
    if (row.appellation) {
      const appellationName = row.appellation.trim()
      const appellation = allAppellations.find(
        (a) => a.name.toLowerCase() === appellationName.toLowerCase(),
      )
      if (appellation) {
        appellationId = appellation.id
      }
      // No warning - will create new appellation during import if needed
    }

    // Resolve format
    let formatId: number | undefined
    const formatName = row.format?.toLowerCase().trim() || 'standard'
    const format = allFormats.find(
      (f) => f.name.toLowerCase() === formatName ||
             (formatName === '75cl' && f.volumeMl === 750) ||
             (formatName === '750ml' && f.volumeMl === 750) ||
             (formatName === '150cl' && f.volumeMl === 1500) ||
             (formatName === '1500ml' && f.volumeMl === 1500),
    )
    if (format) {
      formatId = format.id
    } else {
      // Default to standard
      const standard = allFormats.find((f) => f.volumeMl === 750)
      if (standard) {
        formatId = standard.id
        if (row.format && row.format.toLowerCase() !== 'standard') {
          warnings.push(`Format "${row.format}" not found, defaulting to Standard`)
        }
      } else {
        errors.push('Could not resolve bottle format')
      }
    }

    // Resolve grapes (optional - try to match, skip unmatched)
    const grapeIds: number[] = []
    if (row.grapes) {
      const grapeNames = row.grapes.split(';').map((g) => g.trim()).filter(Boolean)
      for (const grapeName of grapeNames) {
        const grape = allGrapes.find((g) => g.name.toLowerCase() === grapeName.toLowerCase())
        if (grape) {
          grapeIds.push(grape.id)
        }
        // No warning - just skip unmatched grapes
      }
    }

    // Parse vintage
    let vintage: number | undefined
    if (row.vintage && row.vintage !== 'NV' && row.vintage !== 'nv' && row.vintage.toString().trim() !== '') {
      const v = Number(row.vintage)
      if (isNaN(v) || v < 1900 || v > 2100) {
        warnings.push(`Invalid vintage "${row.vintage}", will be treated as NV`)
      } else {
        vintage = v
      }
    }

    validated.push({
      ...row,
      rowIndex: i + 1, // 1-indexed for user display
      isValid: errors.length === 0,
      errors,
      warnings,
      cellarId: cellar?.id,
      regionId,
      appellationId,
      formatId,
      grapeIds,
      importHash,
      isDuplicate,
      color: normalizedColor || row.color,
      vintage,
      quantity: Number(row.quantity) || 0,
    })
  }

  return validated
}

export async function executeImport(
  rows: ValidatedRow[],
  userId: number,
  skipDuplicates: boolean = true,
): Promise<ImportResult> {
  const errors: { row: number; message: string }[] = []
  let imported = 0
  let skipped = 0

  const validRows = rows.filter((row) => {
    if (!row.isValid) {
      errors.push({ row: row.rowIndex, message: row.errors.join(', ') })
      return false
    }
    if (row.isDuplicate && skipDuplicates) {
      skipped++
      return false
    }
    return true
  })

  if (validRows.length === 0) {
    return { success: true, imported: 0, skipped, errors }
  }

  const [existingRegions, existingAppellations, existingProducers, existingWines] = await Promise.all([
    db.select().from(regions),
    db.select().from(appellations),
    db.select().from(producers).where(eq(producers.userId, userId)),
    db.select().from(wines).where(eq(wines.userId, userId)),
  ])

  const regionMap = new Map(existingRegions.map(r => [r.name.toLowerCase(), r.id]))
  const appellationMap = new Map(existingAppellations.map(a => [a.name.toLowerCase(), a.id]))
  const producerMap = new Map(existingProducers.map(p => [p.name.toLowerCase(), p.id]))
  const wineMap = new Map(existingWines.map(w => [`${w.name.toLowerCase()}|${w.producerId}`, w.id]))

  const uniqueRegions = [...new Set(validRows.map(r => r.region?.trim()).filter(Boolean))]
  const newRegions = uniqueRegions.filter(name => !regionMap.has(name!.toLowerCase()))
  
  if (newRegions.length > 0) {
    const inserted = await db
      .insert(regions)
      .values(newRegions.map(name => ({ name: name!, countryCode: 'ZA' })))
      .onConflictDoNothing()
      .returning()
    inserted.forEach(r => regionMap.set(r.name.toLowerCase(), r.id))
  }

  const uniqueAppellations = [...new Set(validRows.map(r => r.appellation?.trim()).filter(Boolean))]
  const newAppellations = uniqueAppellations.filter(name => !appellationMap.has(name!.toLowerCase()))
  
  if (newAppellations.length > 0) {
    const inserted = await db
      .insert(appellations)
      .values(newAppellations.map(name => ({ name: name! })))
      .onConflictDoNothing()
      .returning()
    inserted.forEach(a => appellationMap.set(a.name.toLowerCase(), a.id))
  }

  const uniqueProducers = [...new Set(validRows.map(r => r.producer.trim()))]
  const newProducers = uniqueProducers.filter(name => !producerMap.has(name.toLowerCase()))
  
  if (newProducers.length > 0) {
    const inserted = await db
      .insert(producers)
      .values(newProducers.map(name => {
        const row = validRows.find(r => r.producer.trim() === name)
        const regionId = row?.region ? regionMap.get(row.region.toLowerCase().trim()) : undefined
        return { name, userId, regionId }
      }))
      .onConflictDoNothing()
      .returning()
    inserted.forEach(p => producerMap.set(p.name.toLowerCase(), p.id))
  }

  const wineEntries: { name: string; producerId: number; color: string; appellationId?: number }[] = []
  for (const row of validRows) {
    const producerId = producerMap.get(row.producer.toLowerCase().trim())
    if (!producerId) continue
    const key = `${row.wineName.toLowerCase().trim()}|${producerId}`
    if (!wineMap.has(key)) {
      const appellationId = row.appellation ? appellationMap.get(row.appellation.toLowerCase().trim()) : undefined
      wineEntries.push({ name: row.wineName.trim(), producerId, color: row.color, appellationId })
      wineMap.set(key, -1)
    }
  }

  const uniqueWineEntries = wineEntries.filter((w, i, arr) => 
    arr.findIndex(x => `${x.name.toLowerCase()}|${x.producerId}` === `${w.name.toLowerCase()}|${w.producerId}`) === i
  )

  if (uniqueWineEntries.length > 0) {
    const inserted = await db
      .insert(wines)
      .values(uniqueWineEntries.map(w => ({
        name: w.name,
        userId,
        producerId: w.producerId,
        color: w.color as any,
        appellationId: w.appellationId,
      })))
      .onConflictDoNothing()
      .returning()
    inserted.forEach(w => wineMap.set(`${w.name.toLowerCase()}|${w.producerId}`, w.id))
  }

  const refreshedWines = await db.select().from(wines).where(eq(wines.userId, userId))
  refreshedWines.forEach(w => wineMap.set(`${w.name.toLowerCase()}|${w.producerId}`, w.id))

  const lotValues: any[] = []
  const rowToLotIndex: Map<number, number> = new Map()

  for (const row of validRows) {
    const producerId = producerMap.get(row.producer.toLowerCase().trim())
    if (!producerId) {
      errors.push({ row: row.rowIndex, message: 'Producer not found' })
      continue
    }
    const wineId = wineMap.get(`${row.wineName.toLowerCase().trim()}|${producerId}`)
    if (!wineId || wineId === -1) {
      errors.push({ row: row.rowIndex, message: 'Wine not found' })
      continue
    }

    rowToLotIndex.set(row.rowIndex, lotValues.length)
    lotValues.push({
      userId,
      wineId,
      cellarId: row.cellarId!,
      formatId: row.formatId!,
      vintage: row.vintage as number | undefined,
      quantity: row.quantity as number,
      purchaseDate: row.purchaseDate ? new Date(row.purchaseDate) : null,
      purchasePricePerBottle: row.purchasePricePerBottle?.toString(),
      purchaseCurrency: (row.purchaseCurrency as any) || 'EUR',
      purchaseSource: row.purchaseSource,
      importHash: row.importHash,
      notes: row.notes,
    })
  }

  if (lotValues.length > 0) {
    const insertedLots = await db.insert(inventoryLots).values(lotValues).returning()
    
    const eventValues = insertedLots.map((lot, idx) => {
      const row = validRows.find(r => rowToLotIndex.get(r.rowIndex) === idx)
      return {
        lotId: lot.id,
        eventType: 'purchase' as const,
        quantityChange: lot.quantity,
        eventDate: row?.purchaseDate ? new Date(row.purchaseDate) : new Date(),
        notes: 'Imported from CSV',
      }
    })

    await db.insert(inventoryEvents).values(eventValues)
    imported = insertedLots.length
  }

  return {
    success: errors.length === 0,
    imported,
    skipped,
    errors,
  }
}
