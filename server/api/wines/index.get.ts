import { eq, like, and, sql } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { wines, producers, appellations, regions } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const query = getQuery(event)
  const search = query.search as string | undefined
  const producerId = query.producerId ? Number(query.producerId) : undefined
  const regionId = query.regionId ? Number(query.regionId) : undefined
  const color = query.color as string | undefined
  const limit = query.limit ? Number(query.limit) : 50
  const offset = query.offset ? Number(query.offset) : 0

  const conditions = [eq(wines.userId, userId)]

  if (search) {
    conditions.push(like(wines.name, `%${search}%`))
  }

  if (producerId) {
    conditions.push(eq(wines.producerId, producerId))
  }

  if (regionId) {
    conditions.push(eq(producers.regionId, regionId))
  }

  if (color) {
    conditions.push(eq(wines.color, color as any))
  }

  const result = await db
    .select({
      id: wines.id,
      name: wines.name,
      color: wines.color,
      producerId: wines.producerId,
      producerName: producers.name,
      appellationId: wines.appellationId,
      appellationName: appellations.name,
      regionId: producers.regionId,
      regionName: regions.name,
      defaultDrinkFromYears: wines.defaultDrinkFromYears,
      defaultDrinkUntilYears: wines.defaultDrinkUntilYears,
      notes: wines.notes,
      createdAt: wines.createdAt,
    })
    .from(wines)
    .innerJoin(producers, eq(wines.producerId, producers.id))
    .leftJoin(appellations, eq(wines.appellationId, appellations.id))
    .leftJoin(regions, eq(producers.regionId, regions.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(producers.name, wines.name)
    .limit(limit)
    .offset(offset)

  // Get total count for pagination
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(wines)
    .innerJoin(producers, eq(wines.producerId, producers.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)

  return {
    wines: result,
    total: Number(countResult[0].count),
    limit,
    offset,
  }
})
