import { eq, and, sql } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { cellarSpaces, cellars } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const cellarId = Number(getRouterParam(event, 'cellarId'))
  if (isNaN(cellarId)) throw createError({ statusCode: 400, message: 'Invalid cellar ID' })

  // Verify cellar ownership
  const [cellar] = await db.select().from(cellars)
    .where(and(eq(cellars.id, cellarId), eq(cellars.userId, userId)))
  if (!cellar) throw createError({ statusCode: 404, message: 'Cellar not found' })

  // Simple query first, then enrich with raw SQL
  const spaces = await db.execute(sql`
    SELECT
      cs.id,
      cs.name,
      cs.type,
      cs.created_at as "createdAt",
      (SELECT count(*)::int FROM space_walls sw WHERE sw.space_id = cs.id) as "wallCount",
      (SELECT count(*)::int FROM cellar_racks cr WHERE cr.space_id = cs.id) as "rackCount",
      (SELECT count(*)::int FROM rack_slots rs INNER JOIN cellar_racks cr ON cr.id = rs.rack_id WHERE cr.space_id = cs.id) as "totalSlots",
      (SELECT count(*)::int FROM rack_slots rs INNER JOIN cellar_racks cr ON cr.id = rs.rack_id WHERE cr.space_id = cs.id AND rs.inventory_lot_id IS NOT NULL) as "filledSlots"
    FROM cellar_spaces cs
    WHERE cs.cellar_id = ${cellarId} AND cs.user_id = ${userId}
    ORDER BY cs.created_at
  `)

  return spaces
})
