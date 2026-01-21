import { eq, ilike, and, sql, gt, desc, or } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import {
  inventoryLots,
  wines,
  producers,
  appellations,
  regions,
  cellars,
  formats,
} from '~/server/db/schema'
import { getDrinkingWindow, type MaturityStatus } from '~/server/utils/maturity'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const query = getQuery(event)
  const search = query.search as string | undefined
  const cellarId = query.cellarId ? Number(query.cellarId) : undefined
  const producerId = query.producerId ? Number(query.producerId) : undefined
  const color = query.color as string | undefined
  const regionId = query.regionId ? Number(query.regionId) : undefined
  const vintage = query.vintage ? Number(query.vintage) : undefined
  const maturity = query.maturity as string | undefined // 'ready' | 'past' | 'young'
  const inStock = query.inStock !== 'false' // Default to true (only show in-stock)
  const limit = query.limit ? Number(query.limit) : 50
  const offset = query.offset ? Number(query.offset) : 0

  const conditions = [eq(inventoryLots.userId, userId)]

  if (search) {
    const searchCondition = or(
      ilike(wines.name, `%${search}%`),
      ilike(producers.name, `%${search}%`),
    )
    if (searchCondition) {
      conditions.push(searchCondition)
    }
  }

  if (cellarId) {
    conditions.push(eq(inventoryLots.cellarId, cellarId))
  }

  if (producerId) {
    conditions.push(eq(wines.producerId, producerId))
  }

  if (color) {
    conditions.push(eq(wines.color, color as any))
  }

  if (regionId) {
    conditions.push(eq(producers.regionId, regionId))
  }

  if (vintage) {
    conditions.push(eq(inventoryLots.vintage, vintage))
  }

  if (inStock) {
    conditions.push(gt(inventoryLots.quantity, 0))
  }

  const result = await db
    .select({
      id: inventoryLots.id,
      wineId: inventoryLots.wineId,
      wineName: wines.name,
      wineColor: wines.color,
      producerId: wines.producerId,
      producerName: producers.name,
      appellationId: wines.appellationId,
      appellationName: appellations.name,
      regionId: sql<number | null>`COALESCE(${wines.regionId}, ${producers.regionId})`.as('region_id'),
      wineRegionId: wines.regionId,
      regionName: sql<string | null>`COALESCE(wr.name, ${regions.name})`.as('region_name'),
      cellarId: inventoryLots.cellarId,
      cellarName: cellars.name,
      formatId: inventoryLots.formatId,
      formatName: formats.name,
      formatVolumeMl: formats.volumeMl,
      vintage: inventoryLots.vintage,
      quantity: inventoryLots.quantity,
      purchaseDate: inventoryLots.purchaseDate,
      purchasePricePerBottle: inventoryLots.purchasePricePerBottle,
      purchaseCurrency: inventoryLots.purchaseCurrency,
      purchaseSource: inventoryLots.purchaseSource,
      binLocation: inventoryLots.binLocation,
      notes: inventoryLots.notes,
      createdAt: inventoryLots.createdAt,
    })
    .from(inventoryLots)
    .innerJoin(wines, eq(inventoryLots.wineId, wines.id))
    .innerJoin(producers, eq(wines.producerId, producers.id))
    .innerJoin(cellars, eq(inventoryLots.cellarId, cellars.id))
    .innerJoin(formats, eq(inventoryLots.formatId, formats.id))
    .leftJoin(appellations, eq(wines.appellationId, appellations.id))
    .leftJoin(regions, eq(producers.regionId, regions.id))
    .leftJoin(sql`${regions} as wr`, sql`wr.id = ${wines.regionId}`)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(inventoryLots.createdAt))
    .limit(limit)
    .offset(offset)

  // Add maturity info to each lot
  const lotsWithMaturity = result.map((lot) => {
    const maturityInfo = getDrinkingWindow({
      vintage: lot.vintage,
      color: lot.wineColor,
    })
    return {
      ...lot,
      maturity: maturityInfo,
    }
  })

  // Filter by maturity status if specified
  const maturityStatusMap: Record<string, MaturityStatus[]> = {
    ready: ['ready', 'peak', 'approaching'],
    past: ['declining', 'past'],
    young: ['too_early'],
  }

  let filteredLots = lotsWithMaturity
  if (maturity && maturityStatusMap[maturity]) {
    const allowedStatuses = maturityStatusMap[maturity]
    filteredLots = lotsWithMaturity.filter((lot) =>
      allowedStatuses.includes(lot.maturity.status),
    )
  }

  // Get total count and total bottles for pagination and stats
  // Note: When maturity filter is active, we need to count differently
  const countResult = await db
    .select({
      count: sql<number>`count(*)`,
      totalBottles: sql<number>`coalesce(sum(${inventoryLots.quantity}), 0)`,
    })
    .from(inventoryLots)
    .innerJoin(wines, eq(inventoryLots.wineId, wines.id))
    .innerJoin(producers, eq(wines.producerId, producers.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)

  // If maturity filter is active, the total is the filtered count
  const total = maturity ? filteredLots.length : Number(countResult[0].count)
  const totalBottles = maturity
    ? filteredLots.reduce((sum, lot) => sum + lot.quantity, 0)
    : Number(countResult[0].totalBottles)

  return {
    lots: filteredLots,
    total,
    totalBottles,
    limit,
    offset,
  }
})
