import { eq, sql, gt, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import {
  inventoryLots,
  wines,
  producers,
  regions,
  cellars,
} from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const producersWithInventory = await db
    .selectDistinct({
      id: producers.id,
      name: producers.name,
    })
    .from(inventoryLots)
    .innerJoin(wines, eq(inventoryLots.wineId, wines.id))
    .innerJoin(producers, eq(wines.producerId, producers.id))
    .where(and(eq(inventoryLots.userId, userId), gt(inventoryLots.quantity, 0)))
    .orderBy(producers.name)

  const regionsWithInventory = await db
    .selectDistinct({
      id: regions.id,
      name: regions.name,
    })
    .from(inventoryLots)
    .innerJoin(wines, eq(inventoryLots.wineId, wines.id))
    .innerJoin(producers, eq(wines.producerId, producers.id))
    .innerJoin(regions, eq(producers.regionId, regions.id))
    .where(and(eq(inventoryLots.userId, userId), gt(inventoryLots.quantity, 0)))
    .orderBy(regions.name)

  const vintagesResult = await db
    .selectDistinct({
      vintage: inventoryLots.vintage,
    })
    .from(inventoryLots)
    .where(and(eq(inventoryLots.userId, userId), gt(inventoryLots.quantity, 0)))
    .orderBy(sql`${inventoryLots.vintage} DESC NULLS LAST`)

  const vintages = vintagesResult
    .map((v) => v.vintage)
    .filter((v): v is number => v !== null)

  const allCellars = await db
    .select({
      id: cellars.id,
      name: cellars.name,
    })
    .from(cellars)
    .where(eq(cellars.userId, userId))
    .orderBy(cellars.name)

  return {
    producers: producersWithInventory,
    regions: regionsWithInventory,
    vintages,
    cellars: allCellars,
  }
})
