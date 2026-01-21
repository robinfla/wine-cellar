import { eq, desc, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { tastingNotes, inventoryLots } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const id = Number(getRouterParam(event, 'id'))

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid lot ID',
    })
  }

  const [lot] = await db
    .select({ id: inventoryLots.id })
    .from(inventoryLots)
    .where(and(eq(inventoryLots.id, id), eq(inventoryLots.userId, userId)))

  if (!lot) {
    throw createError({
      statusCode: 404,
      message: 'Inventory lot not found',
    })
  }

  const notes = await db
    .select()
    .from(tastingNotes)
    .where(eq(tastingNotes.lotId, id))
    .orderBy(desc(tastingNotes.tastedAt))

  return notes
})
