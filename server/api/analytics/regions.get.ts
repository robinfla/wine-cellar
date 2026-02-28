import { eq, sql, desc, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { inventoryLots, wines, producers, regions } from '~/server/db/schema'

const REGION_FLAGS: Record<string, string> = {
  'france': '🇫🇷',
  'italy': '🇮🇹',
  'spain': '🇪🇸',
  'united states': '🇺🇸',
  'usa': '🇺🇸',
  'australia': '🇦🇺',
  'germany': '🇩🇪',
  'portugal': '🇵🇹',
  'argentina': '🇦🇷',
  'chile': '🇨🇱',
  'south africa': '🇿🇦',
  'new zealand': '🇳🇿',
}

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const result = await db
    .select({
      regionId: regions.id,
      regionName: regions.name,
      countryCode: regions.countryCode,
      bottles: sql<number>`coalesce(sum(${inventoryLots.quantity}), 0)`,
    })
    .from(inventoryLots)
    .innerJoin(wines, eq(inventoryLots.wineId, wines.id))
    .innerJoin(producers, eq(wines.producerId, producers.id))
    .innerJoin(regions, eq(producers.regionId, regions.id))
    .where(and(eq(inventoryLots.userId, userId), sql`${inventoryLots.quantity} > 0`))
    .groupBy(regions.id, regions.name, regions.countryCode)
    .orderBy(desc(sql`sum(${inventoryLots.quantity})`))

  const total = result.reduce((sum, row) => sum + Number(row.bottles), 0)

  // Map country codes to flags
  const codeToFlag: Record<string, string> = {
    'FR': '🇫🇷',
    'IT': '🇮🇹',
    'ES': '🇪🇸',
    'US': '🇺🇸',
    'AU': '🇦🇺',
    'DE': '🇩🇪',
    'PT': '🇵🇹',
    'AR': '🇦🇷',
    'CL': '🇨🇱',
    'ZA': '🇿🇦',
    'NZ': '🇳🇿',
  }

  return {
    items: result.map((row) => {
      const flag = codeToFlag[row.countryCode?.toUpperCase() || ''] || '🌍'
      
      return {
        id: String(row.regionId),
        name: row.regionName,
        icon: flag,
        count: Number(row.bottles),
        percentage: total > 0 ? Math.round((Number(row.bottles) / total) * 100) : 0,
      }
    }),
    total,
  }
})
