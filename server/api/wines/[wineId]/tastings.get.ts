import { eq, and, desc } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { tastings, wines } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized',
    })
  }

  const wineId = Number(getRouterParam(event, 'wineId'))

  if (isNaN(wineId)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid wine ID',
    })
  }

  // Verify wine exists and belongs to user
  const [wine] = await db
    .select({ id: wines.id })
    .from(wines)
    .where(and(eq(wines.id, wineId), eq(wines.userId, userId)))

  if (!wine) {
    throw createError({
      statusCode: 404,
      message: 'Wine not found',
    })
  }

  // Get all tastings for this wine, ordered by most recent first
  const wineTastings = await db
    .select()
    .from(tastings)
    .where(and(eq(tastings.wineId, wineId), eq(tastings.userId, userId)))
    .orderBy(desc(tastings.createdAt))

  return wineTastings
})
