import { eq, and, desc } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { wishlistItems, wines, producers, regions } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const query = getQuery(event)
  const itemType = query.itemType as string | undefined

  const conditions = [eq(wishlistItems.userId, userId)]

  if (itemType) {
    conditions.push(eq(wishlistItems.itemType, itemType as any))
  }

  const result = await db
    .select({
      id: wishlistItems.id,
      itemType: wishlistItems.itemType,
      name: wishlistItems.name,
      wineId: wishlistItems.wineId,
      producerId: wishlistItems.producerId,
      regionId: wishlistItems.regionId,
      vintage: wishlistItems.vintage,
      notes: wishlistItems.notes,
      winesOfInterest: wishlistItems.winesOfInterest,
      priceTarget: wishlistItems.priceTarget,
      priceCurrency: wishlistItems.priceCurrency,
      url: wishlistItems.url,
      createdAt: wishlistItems.createdAt,
      updatedAt: wishlistItems.updatedAt,
      wineName: wines.name,
      wineColor: wines.color,
      producerName: producers.name,
      regionName: regions.name,
    })
    .from(wishlistItems)
    .leftJoin(wines, eq(wishlistItems.wineId, wines.id))
    .leftJoin(producers, eq(wishlistItems.producerId, producers.id))
    .leftJoin(regions, eq(wishlistItems.regionId, regions.id))
    .where(and(...conditions))
    .orderBy(desc(wishlistItems.createdAt))

  return result
})
