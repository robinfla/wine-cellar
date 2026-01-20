import { eq, desc } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { tastingNotes, inventoryLots } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid lot ID',
    })
  }

  // Verify lot exists
  const [lot] = await db
    .select({ id: inventoryLots.id })
    .from(inventoryLots)
    .where(eq(inventoryLots.id, id))

  if (!lot) {
    throw createError({
      statusCode: 404,
      message: 'Inventory lot not found',
    })
  }

  // Get tasting notes for this lot
  const notes = await db
    .select()
    .from(tastingNotes)
    .where(eq(tastingNotes.lotId, id))
    .orderBy(desc(tastingNotes.tastedAt))

  return notes
})
