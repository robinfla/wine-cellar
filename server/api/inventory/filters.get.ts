import { eq, sql, gt } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import {
  inventoryLots,
  wines,
  producers,
  regions,
  cellars,
} from '~/server/db/schema'

export default defineEventHandler(async () => {
  // Get producers that have inventory
  const producersWithInventory = await db
    .selectDistinct({
      id: producers.id,
      name: producers.name,
    })
    .from(inventoryLots)
    .innerJoin(wines, eq(inventoryLots.wineId, wines.id))
    .innerJoin(producers, eq(wines.producerId, producers.id))
    .where(gt(inventoryLots.quantity, 0))
    .orderBy(producers.name)

  // Get regions that have inventory
  const regionsWithInventory = await db
    .selectDistinct({
      id: regions.id,
      name: regions.name,
    })
    .from(inventoryLots)
    .innerJoin(wines, eq(inventoryLots.wineId, wines.id))
    .innerJoin(producers, eq(wines.producerId, producers.id))
    .innerJoin(regions, eq(producers.regionId, regions.id))
    .where(gt(inventoryLots.quantity, 0))
    .orderBy(regions.name)

  // Get distinct vintages from inventory
  const vintagesResult = await db
    .selectDistinct({
      vintage: inventoryLots.vintage,
    })
    .from(inventoryLots)
    .where(gt(inventoryLots.quantity, 0))
    .orderBy(sql`${inventoryLots.vintage} DESC NULLS LAST`)

  const vintages = vintagesResult
    .map((v) => v.vintage)
    .filter((v): v is number => v !== null)

  // Get all cellars
  const allCellars = await db
    .select({
      id: cellars.id,
      name: cellars.name,
    })
    .from(cellars)
    .orderBy(cellars.name)

  return {
    producers: producersWithInventory,
    regions: regionsWithInventory,
    vintages,
    cellars: allCellars,
  }
})
