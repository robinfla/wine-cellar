import { eq, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { wineValuations, wines } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const id = Number(getRouterParam(event, 'id'))
  if (isNaN(id)) {
    throw createError({ statusCode: 400, message: 'Invalid valuation ID' })
  }

  const [existing] = await db
    .select({
      id: wineValuations.id,
      wineId: wineValuations.wineId,
    })
    .from(wineValuations)
    .innerJoin(wines, eq(wineValuations.wineId, wines.id))
    .where(and(eq(wineValuations.id, id), eq(wines.userId, userId)))

  if (!existing) {
    throw createError({ statusCode: 404, message: 'Valuation not found' })
  }

  const [updated] = await db
    .update(wineValuations)
    .set({
      status: 'confirmed' as const,
      updatedAt: new Date(),
    })
    .where(eq(wineValuations.id, id))
    .returning()

  return updated
})
