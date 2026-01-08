import { eq } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { appellations, regions } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const regionId = query.regionId ? Number(query.regionId) : undefined

  const result = await db
    .select({
      id: appellations.id,
      name: appellations.name,
      level: appellations.level,
      regionId: appellations.regionId,
      regionName: regions.name,
    })
    .from(appellations)
    .leftJoin(regions, eq(appellations.regionId, regions.id))
    .where(regionId ? eq(appellations.regionId, regionId) : undefined)
    .orderBy(appellations.name)

  return result
})
