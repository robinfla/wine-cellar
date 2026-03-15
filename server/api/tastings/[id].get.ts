import { eq, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { tastings } from '~/server/db/schema'

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
      message: 'Invalid tasting ID',
    })
  }

  const [tasting] = await db
    .select()
    .from(tastings)
    .where(and(eq(tastings.id, id), eq(tastings.userId, userId)))

  if (!tasting) {
    throw createError({
      statusCode: 404,
      message: 'Tasting not found',
    })
  }

  return tasting
})
