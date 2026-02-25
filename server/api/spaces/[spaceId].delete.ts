import { eq, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { cellarSpaces } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const spaceId = Number(getRouterParam(event, 'spaceId'))
  if (isNaN(spaceId)) throw createError({ statusCode: 400, message: 'Invalid space ID' })

  const [deleted] = await db.delete(cellarSpaces)
    .where(and(eq(cellarSpaces.id, spaceId), eq(cellarSpaces.userId, userId)))
    .returning()

  if (!deleted) throw createError({ statusCode: 404, message: 'Space not found' })

  return { ok: true }
})
