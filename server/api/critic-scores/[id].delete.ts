import { eq, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { wineCriticScores, wines } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const id = Number(getRouterParam(event, 'id'))
  if (isNaN(id)) {
    throw createError({ statusCode: 400, message: 'Invalid critic score ID' })
  }

  const [score] = await db
    .select({ id: wineCriticScores.id, wineId: wineCriticScores.wineId })
    .from(wineCriticScores)
    .where(eq(wineCriticScores.id, id))

  if (!score) {
    throw createError({ statusCode: 404, message: 'Critic score not found' })
  }

  const [wine] = await db
    .select({ id: wines.id })
    .from(wines)
    .where(and(eq(wines.id, score.wineId), eq(wines.userId, userId)))

  if (!wine) {
    throw createError({ statusCode: 404, message: 'Critic score not found' })
  }

  await db
    .delete(wineCriticScores)
    .where(eq(wineCriticScores.id, id))

  return { success: true }
})
