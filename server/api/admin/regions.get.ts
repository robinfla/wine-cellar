import { sql, asc } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { regions, producers, appellations } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user?.isAdmin) {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const result = await db
    .select({
      id: regions.id,
      name: regions.name,
      countryCode: regions.countryCode,
      producerCount: sql<number>`(
        SELECT COUNT(*) FROM ${producers} 
        WHERE ${producers.regionId} = ${regions.id}
      )`.as('producer_count'),
      appellationCount: sql<number>`(
        SELECT COUNT(*) FROM ${appellations} 
        WHERE ${appellations.regionId} = ${regions.id}
      )`.as('appellation_count'),
      createdAt: regions.createdAt,
    })
    .from(regions)
    .orderBy(asc(regions.name))

  return result
})
