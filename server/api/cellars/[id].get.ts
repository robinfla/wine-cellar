import { eq, and, sql } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { cellars, inventoryLots, wines, producers } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const id = Number(getRouterParam(event, 'id'))
  if (isNaN(id)) {
    throw createError({ statusCode: 400, message: 'Invalid cellar ID' })
  }

  const [cellar] = await db
    .select({
      id: cellars.id,
      name: cellars.name,
      countryCode: cellars.countryCode,
      isVirtual: cellars.isVirtual,
      notes: cellars.notes,
      rows: cellars.rows,
      columns: cellars.columns,
      layoutConfig: cellars.layoutConfig,
      createdAt: cellars.createdAt,
      bottleCount: sql<number>`COALESCE(SUM(${inventoryLots.quantity}), 0)::int`,
    })
    .from(cellars)
    .leftJoin(inventoryLots, eq(inventoryLots.cellarId, cellars.id))
    .where(and(eq(cellars.id, id), eq(cellars.userId, userId)))
    .groupBy(cellars.id)

  if (!cellar) {
    throw createError({ statusCode: 404, message: 'Cellar not found' })
  }

  const bottles = await db
    .select({
      id: inventoryLots.id,
      wineId: inventoryLots.wineId,
      wineName: wines.name,
      producerName: producers.name,
      vintage: inventoryLots.vintage,
      color: wines.color,
      position: inventoryLots.binLocation,
      quantity: inventoryLots.quantity,
    })
    .from(inventoryLots)
    .innerJoin(wines, eq(inventoryLots.wineId, wines.id))
    .innerJoin(producers, eq(wines.producerId, producers.id))
    .where(and(
      eq(inventoryLots.cellarId, id),
      eq(inventoryLots.userId, userId),
    ))

  return {
    ...cellar,
    bottles,
  }
})
