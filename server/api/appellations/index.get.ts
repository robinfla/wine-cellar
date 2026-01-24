import { eq, or, isNull } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { appellations, regions } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const regionId = query.regionId ? Number(query.regionId) : undefined

  let isFrenchRegion = false
  if (regionId) {
    const [region] = await db
      .select({ countryCode: regions.countryCode })
      .from(regions)
      .where(eq(regions.id, regionId))
    isFrenchRegion = region?.countryCode === 'FR'
  }

  const whereClause = regionId
    ? isFrenchRegion
      ? or(eq(appellations.regionId, regionId), isNull(appellations.regionId))
      : eq(appellations.regionId, regionId)
    : undefined

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
    .where(whereClause)
    .orderBy(appellations.name)

  return result
})
