import { eq, sql, asc } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { producers, regions, wines } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user?.isAdmin) {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const result = await db
    .select({
      id: producers.id,
      name: producers.name,
      regionId: producers.regionId,
      regionName: regions.name,
      userId: producers.userId,
      wineCount: sql<number>`(
        SELECT COUNT(*) FROM ${wines} 
        WHERE ${wines.producerId} = ${producers.id}
      )`.as('wine_count'),
      createdAt: producers.createdAt,
    })
    .from(producers)
    .leftJoin(regions, eq(producers.regionId, regions.id))
    .orderBy(asc(producers.name))

  return result
})
