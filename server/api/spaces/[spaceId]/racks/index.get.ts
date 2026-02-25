import { eq, and, sql } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { cellarSpaces, cellarRacks, rackSlots, spaceWalls, inventoryLots, wines } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const spaceId = Number(getRouterParam(event, 'spaceId'))
  if (isNaN(spaceId)) throw createError({ statusCode: 400, message: 'Invalid space ID' })

  // Verify ownership
  const [space] = await db.select().from(cellarSpaces)
    .where(and(eq(cellarSpaces.id, spaceId), eq(cellarSpaces.userId, userId)))
  if (!space) throw createError({ statusCode: 404, message: 'Space not found' })

  // Get walls
  const walls = await db.select().from(spaceWalls).where(eq(spaceWalls.spaceId, spaceId))

  // Get racks with slot data
  const racks = await db.select({
    id: cellarRacks.id,
    wallId: cellarRacks.wallId,
    columns: cellarRacks.columns,
    rows: cellarRacks.rows,
    depth: cellarRacks.depth,
    sortOrder: cellarRacks.sortOrder,
  })
  .from(cellarRacks)
  .where(eq(cellarRacks.spaceId, spaceId))
  .orderBy(cellarRacks.sortOrder)

  // Get all slots with wine info for each rack
  const racksWithSlots = await Promise.all(racks.map(async (rack) => {
    const slots = await db.select({
      id: rackSlots.id,
      row: rackSlots.row,
      column: rackSlots.column,
      depthPosition: rackSlots.depthPosition,
      inventoryLotId: rackSlots.inventoryLotId,
      wineColor: wines.color,
      wineName: wines.name,
      vintage: inventoryLots.vintage,
    })
    .from(rackSlots)
    .leftJoin(inventoryLots, eq(rackSlots.inventoryLotId, inventoryLots.id))
    .leftJoin(wines, eq(inventoryLots.wineId, wines.id))
    .where(eq(rackSlots.rackId, rack.id))

    return { ...rack, slots }
  }))

  return { space, walls, racks: racksWithSlots }
})
