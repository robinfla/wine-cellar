import { eq, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { cellarSpaces } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const id = Number(event.context.params?.id)
  if (!id) {
    throw createError({ statusCode: 400, message: 'Invalid space ID' })
  }

  const deleted = await db.delete(cellarSpaces)
    .where(and(eq(cellarSpaces.id, id), eq(cellarSpaces.userId, userId)))
    .returning({ id: cellarSpaces.id })

  if (!deleted.length) {
    throw createError({ statusCode: 404, message: 'Space not found' })
  }

  return { success: true }
})
