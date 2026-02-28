import { eq, and, sql, desc, gt } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import {
  inventoryLots,
  wines,
  producers,
  regions,
  maturityOverrides,
} from '~/server/db/schema'
import { getDrinkingWindow } from '~/server/utils/maturity'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const query = getQuery(event)
  const limit = query.limit ? Number(query.limit) : 10

  // Fetch wines with maturity data
  const lotsWithMaturity = await db
    .select({
      lotId: inventoryLots.id,
      wineId: wines.id,
      wineName: wines.name,
      producerName: producers.name,
      regionName: regions.name,
      wineColor: wines.color,
      vintage: inventoryLots.vintage,
      quantity: inventoryLots.quantity,
      defaultDrinkFromYears: wines.defaultDrinkFromYears,
      defaultDrinkUntilYears: wines.defaultDrinkUntilYears,
      overrideDrinkFromYear: maturityOverrides.drinkFromYear,
      overrideDrinkUntilYear: maturityOverrides.drinkUntilYear,
      bottleImageUrl: wines.bottleImageUrl,
    })
    .from(inventoryLots)
    .innerJoin(wines, eq(inventoryLots.wineId, wines.id))
    .innerJoin(producers, eq(wines.producerId, producers.id))
    .innerJoin(regions, eq(producers.regionId, regions.id))
    .leftJoin(maturityOverrides, eq(inventoryLots.id, maturityOverrides.lotId))
    .where(
      and(
        eq(inventoryLots.userId, userId),
        gt(inventoryLots.quantity, 0),
      ),
    )
    .orderBy(desc(inventoryLots.vintage))

  // Filter wines that are ready (peak, approaching, ready)
  const readyWines = lotsWithMaturity
    .map((row) => {
      const maturityInfo = getDrinkingWindow({
        vintage: row.vintage,
        color: row.wineColor,
        appellationName: null,
        regionName: row.regionName,
        grapeName: null,
        defaultDrinkFromYears: row.defaultDrinkFromYears,
        defaultDrinkUntilYears: row.defaultDrinkUntilYears,
        overrideDrinkFromYear: row.overrideDrinkFromYear ?? undefined,
        overrideDrinkUntilYear: row.overrideDrinkUntilYear ?? undefined,
      })

      return {
        id: String(row.lotId),
        wineId: row.wineId,
        name: `${row.producerName} ${row.wineName}`,
        vintage: row.vintage,
        region: row.regionName,
        imageUrl: row.bottleImageUrl,
        maturityStatus: maturityInfo.status,
        quantity: row.quantity,
      }
    })
    .filter((wine) =>
      wine.maturityStatus === 'peak' ||
      wine.maturityStatus === 'approaching'
    )
    .slice(0, limit)

  return {
    wines: readyWines,
    total: readyWines.length,
  }
})
