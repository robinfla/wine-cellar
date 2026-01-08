import { eq, like, and, sql, gt, desc } from 'drizzle-orm'
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

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const search = query.search as string | undefined
  const cellarId = query.cellarId ? Number(query.cellarId) : undefined
  const color = query.color as string | undefined
  const regionId = query.regionId ? Number(query.regionId) : undefined
  const vintage = query.vintage ? Number(query.vintage) : undefined
  const inStock = query.inStock === 'true'
  const limit = query.limit ? Number(query.limit) : 50
  const offset = query.offset ? Number(query.offset) : 0

  const conditions = []

  if (search) {
    conditions.push(like(wines.name, `%${search}%`))
  }

  if (cellarId) {
    conditions.push(eq(inventoryLots.cellarId, cellarId))
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
      regionId: producers.regionId,
      regionName: regions.name,
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
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(inventoryLots.createdAt))
    .limit(limit)
    .offset(offset)

  // Get total count and total bottles for pagination and stats
  const countResult = await db
    .select({
      count: sql<number>`count(*)`,
      totalBottles: sql<number>`coalesce(sum(${inventoryLots.quantity}), 0)`,
    })
    .from(inventoryLots)
    .innerJoin(wines, eq(inventoryLots.wineId, wines.id))
    .innerJoin(producers, eq(wines.producerId, producers.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)

  return {
    lots: result,
    total: Number(countResult[0].count),
    totalBottles: Number(countResult[0].totalBottles),
    limit,
    offset,
  }
})
