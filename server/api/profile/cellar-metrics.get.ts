/**
 * GET /api/profile/cellar-metrics
 * 
 * Returns real-time metrics from the user's cellar inventory.
 * Used to supplement taste profile data with actual bottle counts.
 */
import { sql } from 'drizzle-orm'
import { db } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  // Get total bottles and unique wines
  const [bottleStats] = await db.execute(sql`
    SELECT 
      COALESCE(SUM(quantity), 0)::int as total_bottles,
      COUNT(DISTINCT wine_id)::int as unique_wines
    FROM inventory_lots
    WHERE user_id = ${userId} AND quantity > 0
  `) as any[]

  // Get unique regions
  const [regionStats] = await db.execute(sql`
    SELECT COUNT(DISTINCT r.id)::int as total_regions
    FROM inventory_lots il
    JOIN wines w ON il.wine_id = w.id
    LEFT JOIN appellations a ON w.appellation_id = a.id
    LEFT JOIN regions r ON a.region_id = r.id
    WHERE il.user_id = ${userId} AND il.quantity > 0 AND r.id IS NOT NULL
  `) as any[]

  return {
    totalBottles: bottleStats?.total_bottles || 0,
    uniqueWines: bottleStats?.unique_wines || 0,
    totalRegions: regionStats?.total_regions || 0,
  }
})
