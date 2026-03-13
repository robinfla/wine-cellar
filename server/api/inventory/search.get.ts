import { eq, sql, like, and, or } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { inventoryLots, wines, producers, regions, vintages } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const query = getQuery(event)
  const searchTerm = (query.q as string) || ''

  if (!searchTerm || searchTerm.length < 2) {
    return { wines: [] }
  }

  const searchPattern = `%${searchTerm}%`

  const results = await db
    .select({
      lotId: inventoryLots.id,
      wineId: wines.id,
      wineName: wines.name,
      producerName: producers.name,
      vintageId: inventoryLots.vintageId,
      vintage: vintages.year,
      regionName: regions.name,
      color: wines.color,
      stock: inventoryLots.quantity,
      imageUrl: wines.bottleImageUrl,
    })
    .from(inventoryLots)
    .innerJoin(wines, eq(inventoryLots.wineId, wines.id))
    .innerJoin(producers, eq(wines.producerId, producers.id))
    .leftJoin(vintages, eq(inventoryLots.vintageId, vintages.id))
    .leftJoin(regions, eq(producers.regionId, regions.id))
    .where(
      and(
        eq(inventoryLots.userId, userId),
        sql`${inventoryLots.quantity} > 0`,
        or(
          like(wines.name, searchPattern),
          like(producers.name, searchPattern),
          like(regions.name, searchPattern),
        ),
      ),
    )
    .orderBy(sql`${inventoryLots.quantity} DESC`)
    .limit(20)

  return {
    wines: results.map((row) => ({
      id: row.lotId,
      wineId: row.wineId,
      name: `${row.producerName} ${row.wineName}`,
      vintageId: row.vintageId,
      vintage: row.vintage,
      region: row.regionName,
      color: row.color,
      stock: row.stock,
      imageUrl: row.imageUrl,
    })),
  }
})
