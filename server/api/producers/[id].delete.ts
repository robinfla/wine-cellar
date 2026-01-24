import { eq, and, sql, count } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { producers, wines, inventoryLots, wineGrapes, allocations, allocationItems } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const id = Number(getRouterParam(event, 'id'))
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: 'Invalid producer ID' })
  }

  const [existing] = await db
    .select({ id: producers.id })
    .from(producers)
    .where(and(eq(producers.id, id), eq(producers.userId, userId)))

  if (!existing) {
    throw createError({ statusCode: 404, message: 'Producer not found' })
  }

  const [{ bottleCount }] = await db
    .select({ bottleCount: sql<number>`coalesce(sum(${inventoryLots.quantity}), 0)` })
    .from(wines)
    .leftJoin(inventoryLots, eq(inventoryLots.wineId, wines.id))
    .where(eq(wines.producerId, id))

  if (Number(bottleCount) > 0) {
    throw createError({
      statusCode: 409,
      message: `Cannot delete producer with ${bottleCount} bottle${Number(bottleCount) === 1 ? '' : 's'} in inventory.`,
    })
  }

  const [{ allocationCount }] = await db
    .select({ allocationCount: count() })
    .from(allocations)
    .where(eq(allocations.producerId, id))

  if (Number(allocationCount) > 0) {
    throw createError({
      statusCode: 409,
      message: `Cannot delete producer with ${allocationCount} allocation${Number(allocationCount) === 1 ? '' : 's'}. Delete the allocations first.`,
    })
  }

  const producerWines = await db
    .select({ id: wines.id })
    .from(wines)
    .where(eq(wines.producerId, id))

  const wineIds = producerWines.map(w => w.id)

  if (wineIds.length > 0) {
    await db.delete(allocationItems).where(sql`${allocationItems.wineId} IN (${sql.join(wineIds, sql`, `)})`)
    await db.delete(wineGrapes).where(sql`${wineGrapes.wineId} IN (${sql.join(wineIds, sql`, `)})`)
    await db.delete(inventoryLots).where(sql`${inventoryLots.wineId} IN (${sql.join(wineIds, sql`, `)})`)
    await db.delete(wines).where(eq(wines.producerId, id))
  }

  try {
    await db.delete(producers).where(eq(producers.id, id))
  } catch (e: any) {
    if (e.code === '23503') {
      throw createError({
        statusCode: 409,
        message: 'Cannot delete producer: it is still referenced by other records.',
      })
    }
    throw e
  }

  return { success: true }
})
