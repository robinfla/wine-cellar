import { eq, and, sql } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { cellarSpaces, spaceWalls, cellarRacks, rackSlots, cellars } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const cellarId = Number(getRouterParam(event, 'cellarId'))
  if (isNaN(cellarId)) throw createError({ statusCode: 400, message: 'Invalid cellar ID' })

  // Verify cellar ownership
  const [cellar] = await db.select().from(cellars)
    .where(and(eq(cellars.id, cellarId), eq(cellars.userId, userId)))
  if (!cellar) throw createError({ statusCode: 404, message: 'Cellar not found' })

  const spaces = await db.select({
    id: cellarSpaces.id,
    name: cellarSpaces.name,
    type: cellarSpaces.type,
    createdAt: cellarSpaces.createdAt,
    wallCount: sql<number>`(SELECT count(*) FROM space_walls WHERE space_id = ${cellarSpaces.id})::int`,
    rackCount: sql<number>`(SELECT count(*) FROM cellar_racks WHERE space_id = ${cellarSpaces.id})::int`,
    totalSlots: sql<number>`(SELECT count(*) FROM rack_slots rs JOIN cellar_racks cr ON cr.id = rs.rack_id WHERE cr.space_id = ${cellarSpaces.id})::int`,
    filledSlots: sql<number>`(SELECT count(*) FROM rack_slots rs JOIN cellar_racks cr ON cr.id = rs.rack_id WHERE cr.space_id = ${cellarSpaces.id} AND rs.inventory_lot_id IS NOT NULL)::int`,
  })
  .from(cellarSpaces)
  .where(and(eq(cellarSpaces.cellarId, cellarId), eq(cellarSpaces.userId, userId)))

  return spaces
})
