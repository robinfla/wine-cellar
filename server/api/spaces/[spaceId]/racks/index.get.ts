import { eq, and, sql } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { cellarSpaces, cellarRacks, rackSlots, spaceWalls, inventoryLots, wines, binBottles } from '~/server/db/schema'

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

  // Get racks
  const racks = await db.select({
    id: cellarRacks.id,
    wallId: cellarRacks.wallId,
    name: cellarRacks.name,
    type: cellarRacks.type,
    columns: cellarRacks.columns,
    rows: cellarRacks.rows,
    depth: cellarRacks.depth,
    capacity: cellarRacks.capacity,
    binLabels: cellarRacks.binLabels,
    sortOrder: cellarRacks.sortOrder,
  })
  .from(cellarRacks)
  .where(eq(cellarRacks.spaceId, spaceId))
  .orderBy(cellarRacks.sortOrder)

  // Get data for each rack based on type
  const racksWithData = await Promise.all(racks.map(async (rack) => {
    if (rack.type === 'bin') {
      // Bin type: get bottles per bin
      const bottles = await db.select({
        id: binBottles.id,
        binRow: binBottles.binRow,
        binColumn: binBottles.binColumn,
        inventoryLotId: binBottles.inventoryLotId,
        wineColor: wines.color,
        wineName: wines.name,
        producerName: sql<string>`(SELECT p.name FROM producers p JOIN wines w2 ON w2.producer_id = p.id WHERE w2.id = ${inventoryLots.wineId})`,
        vintage: inventoryLots.vintage,
      })
      .from(binBottles)
      .leftJoin(inventoryLots, eq(binBottles.inventoryLotId, inventoryLots.id))
      .leftJoin(wines, eq(inventoryLots.wineId, wines.id))
      .where(eq(binBottles.rackId, rack.id))

      return { ...rack, bottles, slots: [] }
    } else {
      // Grid type: get slots
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

      return { ...rack, slots, bottles: [] }
    }
  }))

  return { space, walls, racks: racksWithData }
})
