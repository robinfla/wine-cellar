import { eq, and, sql } from 'drizzle-orm'
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
import { getDrinkingWindow } from '~/server/utils/maturity'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const id = Number(getRouterParam(event, 'id'))
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: 'Invalid lot ID' })
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
    .where(and(eq(inventoryLots.id, id), eq(inventoryLots.userId, userId)))
    .limit(1)

  if (!result.length) {
    throw createError({ statusCode: 404, message: 'Lot not found' })
  }

  const lot = result[0]
  const maturityInfo = getDrinkingWindow({
    vintage: lot.vintage,
    color: lot.wineColor,
  })

  return {
    ...lot,
    maturity: maturityInfo,
  }
})
