import { eq, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { cellarSpaces, cellarRacks, rackSlots, inventoryLots, wines, producers } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const spaceId = Number(event.context.params?.spaceId)
  if (!spaceId) {
    throw createError({ statusCode: 400, message: 'Invalid space ID' })
  }

  // Verify space ownership
  const space = await db.select({ id: cellarSpaces.id }).from(cellarSpaces)
    .where(and(eq(cellarSpaces.id, spaceId), eq(cellarSpaces.userId, userId)))
    .limit(1)
  if (!space.length) {
    throw createError({ statusCode: 404, message: 'Space not found' })
  }

  const racks = await db.select().from(cellarRacks)
    .where(eq(cellarRacks.spaceId, spaceId))
    .orderBy(cellarRacks.sortOrder)

  // Get slots with inventory info for each rack
  const racksWithSlots = await Promise.all(racks.map(async (rack) => {
    const slots = await db
      .select({
        id: rackSlots.id,
        row: rackSlots.row,
        column: rackSlots.column,
        depthPosition: rackSlots.depthPosition,
        inventoryLotId: rackSlots.inventoryLotId,
        wineName: wines.name,
        producerName: producers.name,
        vintage: inventoryLots.vintage,
        color: wines.color,
      })
      .from(rackSlots)
      .leftJoin(inventoryLots, eq(inventoryLots.id, rackSlots.inventoryLotId))
      .leftJoin(wines, eq(wines.id, inventoryLots.wineId))
      .leftJoin(producers, eq(producers.id, wines.producerId))
      .where(eq(rackSlots.rackId, rack.id))

    return { ...rack, slots }
  }))

  return racksWithSlots
})
