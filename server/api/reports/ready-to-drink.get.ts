import { eq, gt, desc } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import {
  inventoryLots,
  wines,
  producers,
  appellations,
  regions,
  cellars,
  formats,
  maturityOverrides,
} from '~/server/db/schema'
import { getDrinkingWindow, type MaturityStatus } from '~/server/utils/maturity'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const statusFilter = query.status as MaturityStatus | undefined

  // Get all lots with wine info
  const lots = await db
    .select({
      id: inventoryLots.id,
      wineId: inventoryLots.wineId,
      wineName: wines.name,
      wineColor: wines.color,
      producerName: producers.name,
      appellationName: appellations.name,
      regionName: regions.name,
      cellarName: cellars.name,
      formatName: formats.name,
      vintage: inventoryLots.vintage,
      quantity: inventoryLots.quantity,
      defaultDrinkFromYears: wines.defaultDrinkFromYears,
      defaultDrinkUntilYears: wines.defaultDrinkUntilYears,
      overrideDrinkFromYear: maturityOverrides.drinkFromYear,
      overrideDrinkUntilYear: maturityOverrides.drinkUntilYear,
    })
    .from(inventoryLots)
    .innerJoin(wines, eq(inventoryLots.wineId, wines.id))
    .innerJoin(producers, eq(wines.producerId, producers.id))
    .innerJoin(cellars, eq(inventoryLots.cellarId, cellars.id))
    .innerJoin(formats, eq(inventoryLots.formatId, formats.id))
    .leftJoin(appellations, eq(wines.appellationId, appellations.id))
    .leftJoin(regions, eq(producers.regionId, regions.id))
    .leftJoin(maturityOverrides, eq(inventoryLots.id, maturityOverrides.lotId))
    .where(gt(inventoryLots.quantity, 0))
    .orderBy(desc(inventoryLots.vintage))

  // Calculate maturity for each lot and filter
  const lotsWithMaturity = lots.map(lot => {
    const window = getDrinkingWindow({
      vintage: lot.vintage,
      color: lot.wineColor,
      defaultDrinkFromYears: lot.defaultDrinkFromYears,
      defaultDrinkUntilYears: lot.defaultDrinkUntilYears,
      overrideDrinkFromYear: lot.overrideDrinkFromYear,
      overrideDrinkUntilYear: lot.overrideDrinkUntilYear,
    })

    return {
      ...lot,
      maturity: window,
    }
  })

  // Filter by status if provided
  let filtered = lotsWithMaturity
  if (statusFilter) {
    filtered = lotsWithMaturity.filter(lot => lot.maturity.status === statusFilter)
  } else {
    // Default: show ready, peak, and approaching
    filtered = lotsWithMaturity.filter(lot =>
      ['ready', 'peak', 'approaching'].includes(lot.maturity.status)
    )
  }

  // Sort: peak first, then ready, then approaching
  const statusOrder: Record<string, number> = {
    peak: 0,
    ready: 1,
    approaching: 2,
    declining: 3,
    too_early: 4,
    past: 5,
    unknown: 6,
  }

  filtered.sort((a, b) => {
    const orderDiff = statusOrder[a.maturity.status] - statusOrder[b.maturity.status]
    if (orderDiff !== 0) return orderDiff
    // Within same status, sort by vintage (older first for ready, newer first for approaching)
    if (a.maturity.status === 'approaching') {
      return (b.vintage || 0) - (a.vintage || 0)
    }
    return (a.vintage || 0) - (b.vintage || 0)
  })

  // Calculate summary
  const summary = {
    peak: lotsWithMaturity.filter(l => l.maturity.status === 'peak').reduce((sum, l) => sum + l.quantity, 0),
    ready: lotsWithMaturity.filter(l => l.maturity.status === 'ready').reduce((sum, l) => sum + l.quantity, 0),
    approaching: lotsWithMaturity.filter(l => l.maturity.status === 'approaching').reduce((sum, l) => sum + l.quantity, 0),
    declining: lotsWithMaturity.filter(l => l.maturity.status === 'declining').reduce((sum, l) => sum + l.quantity, 0),
    too_early: lotsWithMaturity.filter(l => l.maturity.status === 'too_early').reduce((sum, l) => sum + l.quantity, 0),
    past: lotsWithMaturity.filter(l => l.maturity.status === 'past').reduce((sum, l) => sum + l.quantity, 0),
  }

  return {
    lots: filtered,
    summary,
    total: filtered.reduce((sum, l) => sum + l.quantity, 0),
  }
})
