import { eq, like, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { producers, regions } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const search = query.search as string | undefined
  const regionId = query.regionId ? Number(query.regionId) : undefined

  const conditions = []

  if (search) {
    conditions.push(like(producers.name, `%${search}%`))
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
      createdAt: producers.createdAt,
    })
    .from(producers)
    .leftJoin(regions, eq(producers.regionId, regions.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(producers.name)

  return result
})
