import { eq, sql } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { cellars, inventoryLots } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const result = await db
    .select({
      id: cellars.id,
      name: cellars.name,
      countryCode: cellars.countryCode,
      isVirtual: cellars.isVirtual,
      notes: cellars.notes,
      createdAt: cellars.createdAt,
      bottleCount: sql<number>`COALESCE(SUM(${inventoryLots.quantity}), 0)::int`,
    })
    .from(cellars)
    .leftJoin(inventoryLots, eq(inventoryLots.cellarId, cellars.id))
    .where(eq(cellars.userId, userId))
    .groupBy(cellars.id)
    .orderBy(cellars.name)

  return result
})
