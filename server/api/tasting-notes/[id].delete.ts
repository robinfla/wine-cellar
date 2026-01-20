import { eq } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { tastingNotes } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid tasting note ID',
    })
  }

  // Verify note exists
  const [note] = await db
    .select({ id: tastingNotes.id })
    .from(tastingNotes)
    .where(eq(tastingNotes.id, id))

  if (!note) {
    throw createError({
      statusCode: 404,
      message: 'Tasting note not found',
    })
  }

  // Delete the tasting note
  await db
    .delete(tastingNotes)
    .where(eq(tastingNotes.id, id))

  return { success: true }
})
