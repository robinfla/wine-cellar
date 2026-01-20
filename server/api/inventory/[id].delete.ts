import { eq } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { inventoryLots, tastingNotes, inventoryEvents } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid lot ID',
    })
  }

  // Get current lot
  const [lot] = await db
    .select()
    .from(inventoryLots)
    .where(eq(inventoryLots.id, id))

  if (!lot) {
    throw createError({
      statusCode: 404,
      message: 'Inventory lot not found',
    })
  }

  // Delete related tasting notes first (cascade)
  await db
    .delete(tastingNotes)
    .where(eq(tastingNotes.lotId, id))

  // Delete related inventory events
  await db
    .delete(inventoryEvents)
    .where(eq(inventoryEvents.lotId, id))

  // Delete the lot
  await db
    .delete(inventoryLots)
    .where(eq(inventoryLots.id, id))

  return { success: true }
})
