import { eq, sql, asc } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { appellations, regions, wines } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user?.isAdmin) {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const result = await db
    .select({
      id: appellations.id,
      name: appellations.name,
      level: appellations.level,
      regionId: appellations.regionId,
      regionName: regions.name,
      wineCount: sql<number>`(
        SELECT COUNT(*) FROM ${wines} 
        WHERE ${wines.appellationId} = ${appellations.id}
      )`.as('wine_count'),
      createdAt: appellations.createdAt,
    })
    .from(appellations)
    .leftJoin(regions, eq(appellations.regionId, regions.id))
    .orderBy(asc(appellations.name))

  return result
})
