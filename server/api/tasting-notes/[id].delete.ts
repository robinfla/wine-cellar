import { eq, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { tastingNotes, inventoryLots } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized',
    })
  }

  const id = Number(getRouterParam(event, 'id'))

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid tasting note ID',
    })
  }

  const [note] = await db
    .select({ id: tastingNotes.id, lotId: tastingNotes.lotId })
    .from(tastingNotes)
    .where(eq(tastingNotes.id, id))

  if (!note) {
    throw createError({
      statusCode: 404,
      message: 'Tasting note not found',
    })
  }

  const [lot] = await db
    .select({ id: inventoryLots.id })
    .from(inventoryLots)
    .where(and(eq(inventoryLots.id, note.lotId), eq(inventoryLots.userId, userId)))

  if (!lot) {
    throw createError({
      statusCode: 404,
      message: 'Tasting note not found',
    })
  }

  await db
    .delete(tastingNotes)
    .where(eq(tastingNotes.id, id))

  return { success: true }
})
