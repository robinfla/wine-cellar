import { eq, and, sql } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { producers, regions, wines, inventoryLots } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const id = Number(getRouterParam(event, 'id'))
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: 'Invalid producer ID' })
  }

  const result = await db
    .select({
      id: producers.id,
      name: producers.name,
      regionId: producers.regionId,
      regionName: regions.name,
      website: producers.website,
      notes: producers.notes,
      bottleCount: sql<number>`cast(coalesce(sum(${inventoryLots.quantity}), 0) as int)`,
      createdAt: producers.createdAt,
    })
    .from(producers)
    .leftJoin(regions, eq(producers.regionId, regions.id))
    .leftJoin(wines, eq(wines.producerId, producers.id))
    .leftJoin(inventoryLots, eq(inventoryLots.wineId, wines.id))
    .where(and(eq(producers.id, id), eq(producers.userId, userId)))
    .groupBy(producers.id, regions.name)

  if (!result.length) {
    throw createError({ statusCode: 404, message: 'Producer not found' })
  }

  return result[0]
})
