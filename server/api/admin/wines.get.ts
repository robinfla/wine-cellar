import { eq, sql, asc } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { wines, producers, inventoryLots } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user?.isAdmin) {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const result = await db
    .select({
      id: wines.id,
      name: wines.name,
      color: wines.color,
      producerId: wines.producerId,
      producerName: producers.name,
      userId: wines.userId,
      inventoryCount: sql<number>`(
        SELECT COUNT(*) FROM ${inventoryLots} 
        WHERE ${inventoryLots.wineId} = ${wines.id}
      )`.as('inventory_count'),
      createdAt: wines.createdAt,
    })
    .from(wines)
    .innerJoin(producers, eq(wines.producerId, producers.id))
    .orderBy(asc(wines.name), asc(producers.name))

  return result
})
