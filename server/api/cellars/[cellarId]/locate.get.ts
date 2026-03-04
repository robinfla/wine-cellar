import { eq, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { inventoryLots, wines, producers, cellars, wineGrapes, grapes } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const cellarId = Number(event.context.params?.cellarId)
  const query = getQuery(event)
  const wineId = query.wineId ? Number(query.wineId) : undefined

  if (!wineId) {
    throw createError({ statusCode: 400, message: 'wineId query param required' })
  }

  // Find the lot in this cellar
  const lots = await db
    .select({
      lotId: inventoryLots.id,
      binLocation: inventoryLots.binLocation,
      quantity: inventoryLots.quantity,
      vintage: inventoryLots.vintage,
      wineName: wines.name,
      producerName: producers.name,
      cellarName: cellars.name,
    })
    .from(inventoryLots)
    .innerJoin(wines, eq(inventoryLots.wineId, wines.id))
    .innerJoin(producers, eq(wines.producerId, producers.id))
    .innerJoin(cellars, eq(inventoryLots.cellarId, cellars.id))
    .where(
      and(
        eq(inventoryLots.userId, userId),
        eq(inventoryLots.cellarId, cellarId),
        eq(inventoryLots.wineId, wineId)
      )
    )
    .limit(10)

  if (lots.length === 0) {
    throw createError({
      statusCode: 404,
      message: "This wine hasn't been assigned a location yet",
    })
  }

  // Get grape info for filter context
  const grapeData = await db
    .select({
      grapeName: grapes.name,
    })
    .from(wineGrapes)
    .innerJoin(grapes, eq(wineGrapes.grapeId, grapes.id))
    .where(eq(wineGrapes.wineId, wineId))
    .limit(1)

  const firstLot = lots[0]

  // Parse binLocation as "row-slot" format if possible
  let position = { row: 1, slot: 1 }
  if (firstLot.binLocation) {
    const match = firstLot.binLocation.match(/(\d+)-(\d+)/)
    if (match) {
      position = { row: Number(match[1]), slot: Number(match[2]) }
    }
  }

  return {
    cellarId,
    cellarName: firstLot.cellarName,
    locations: lots.map((lot) => ({
      lotId: lot.lotId,
      binLocation: lot.binLocation,
      quantity: lot.quantity,
      vintage: lot.vintage,
    })),
    position, // Primary position
    filters: {
      wineName: `${firstLot.producerName} ${firstLot.wineName}`,
      grape: grapeData[0]?.grapeName || null,
      vintage: firstLot.vintage,
    },
  }
})
