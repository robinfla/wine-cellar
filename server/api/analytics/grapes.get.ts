import { eq, sql, desc, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { inventoryLots, wines, wineGrapes, grapes } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const result = await db
    .select({
      grapeId: grapes.id,
      grapeName: grapes.name,
      bottles: sql<number>`coalesce(sum(${inventoryLots.quantity}), 0)`,
    })
    .from(inventoryLots)
    .innerJoin(wines, eq(inventoryLots.wineId, wines.id))
    .innerJoin(wineGrapes, eq(wines.id, wineGrapes.wineId))
    .innerJoin(grapes, eq(wineGrapes.grapeId, grapes.id))
    .where(and(eq(inventoryLots.userId, userId), sql`${inventoryLots.quantity} > 0`))
    .groupBy(grapes.id, grapes.name)
    .orderBy(desc(sql`sum(${inventoryLots.quantity})`))

  const total = result.reduce((sum, row) => sum + Number(row.bottles), 0)

  return {
    items: result.map((row) => ({
      id: String(row.grapeId),
      name: row.grapeName,
      count: Number(row.bottles),
      percentage: total > 0 ? Math.round((Number(row.bottles) / total) * 100) : 0,
    })),
    total,
  }
})
