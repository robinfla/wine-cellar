import { eq, and, sql, isNull } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { inventoryLots, wines, producers, cellars, rackSlots } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const cellarId = Number(getRouterParam(event, 'cellarId'))
  if (isNaN(cellarId)) throw createError({ statusCode: 400, message: 'Invalid cellar ID' })

  // Get cellar info
  const [cellarInfo] = await db
    .select({ name: cellars.name })
    .from(cellars)
    .where(and(eq(cellars.id, cellarId), eq(cellars.userId, userId)))

  if (!cellarInfo) {
    throw createError({ statusCode: 404, message: 'Cellar not found' })
  }

  // Find inventory lots in this cellar that have NO rack_slots entries
  // This means they're assigned to the cellar but not placed in any rack
  const unplacedLots = await db
    .select({
      lotId: inventoryLots.id,
      wineId: inventoryLots.wineId,
      wineName: wines.name,
      producerName: producers.name,
      vintage: inventoryLots.vintage,
      quantity: inventoryLots.quantity,
      color: wines.color,
    })
    .from(inventoryLots)
    .innerJoin(wines, eq(inventoryLots.wineId, wines.id))
    .innerJoin(producers, eq(wines.producerId, producers.id))
    .leftJoin(rackSlots, eq(rackSlots.inventoryLotId, inventoryLots.id))
    .where(
      and(
        eq(inventoryLots.userId, userId),
        eq(inventoryLots.cellarId, cellarId),
        sql`${inventoryLots.quantity} > 0`,
        isNull(rackSlots.id) // No rack slot = unplaced
      )
    )
    .orderBy(inventoryLots.createdAt)

  return {
    cellarId,
    cellarName: cellarInfo.name,
    unplacedCount: unplacedLots.length,
    wines: unplacedLots.map(lot => ({
      lotId: lot.lotId,
      wineId: lot.wineId,
      name: `${lot.producerName} ${lot.wineName}`,
      vintage: lot.vintage,
      quantity: lot.quantity,
      color: lot.color,
    })),
  }
})
