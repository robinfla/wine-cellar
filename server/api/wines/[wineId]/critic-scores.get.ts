import { eq, desc, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { wineCriticScores, wines } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const wineId = Number(getRouterParam(event, 'wineId'))
  const query = getQuery(event)
  const vintage = query.vintage ? Number(query.vintage) : undefined

  if (isNaN(wineId)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid wine ID',
    })
  }

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

  const conditions = [eq(wineCriticScores.wineId, wineId)]
  if (vintage !== undefined && !isNaN(vintage)) {
    conditions.push(eq(wineCriticScores.vintage, vintage))
  }

  const scores = await db
    .select()
    .from(wineCriticScores)
    .where(and(...conditions))
    .orderBy(desc(wineCriticScores.score))

  return scores
})
