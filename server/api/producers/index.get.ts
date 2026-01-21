import { eq, ilike, and, sql } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { producers, regions, wines, inventoryLots } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const query = getQuery(event)
  const search = query.search as string | undefined
  const regionId = query.regionId ? Number(query.regionId) : undefined

  const conditions = [eq(producers.userId, userId)]

  if (search) {
    conditions.push(ilike(producers.name, `%${search}%`))
  }

  if (regionId) {
    conditions.push(eq(producers.regionId, regionId))
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
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(producers.id, regions.name)
    .orderBy(producers.name)

  return result
})
