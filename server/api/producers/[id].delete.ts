import { eq, and, count } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { producers, wines } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const id = Number(getRouterParam(event, 'id'))
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: 'Invalid producer ID' })
  }

  const [existing] = await db
    .select({ id: producers.id })
    .from(producers)
    .where(and(eq(producers.id, id), eq(producers.userId, userId)))

  if (!existing) {
    throw createError({ statusCode: 404, message: 'Producer not found' })
  }

  const [{ wineCount }] = await db
    .select({ wineCount: count() })
    .from(wines)
    .where(eq(wines.producerId, id))

  if (wineCount > 0) {
    throw createError({
      statusCode: 409,
      message: `Cannot delete producer with ${wineCount} existing wine${wineCount === 1 ? '' : 's'}. Remove the wines first.`,
    })
  }

  await db
    .delete(producers)
    .where(eq(producers.id, id))

  return { success: true }
})
