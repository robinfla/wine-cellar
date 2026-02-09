import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { wineCriticScores, wines } from '~/server/db/schema'

const createCriticScoreSchema = z.object({
  critic: z.enum([
    'robert_parker',
    'wine_spectator',
    'james_suckling',
    'decanter',
    'jancis_robinson',
    'wine_enthusiast',
    'vinous',
    'other',
  ]),
  score: z.number().int().min(0).max(100),
  vintage: z.number().int().min(1900).max(2100).optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
  sourceUrl: z.string().url().max(2048).optional().nullable(),
})

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const wineId = Number(getRouterParam(event, 'wineId'))
  if (isNaN(wineId)) {
    throw createError({ statusCode: 400, message: 'Invalid wine ID' })
  }

  const [wine] = await db
    .select({ id: wines.id })
    .from(wines)
    .where(and(eq(wines.id, wineId), eq(wines.userId, userId)))

  if (!wine) {
    throw createError({ statusCode: 404, message: 'Wine not found' })
  }

  const body = await readBody(event)
  const parsed = createCriticScoreSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid critic score data',
      data: parsed.error.flatten(),
    })
  }

  try {
    const [item] = await db
      .insert(wineCriticScores)
      .values({
        wineId,
        ...parsed.data,
        source: 'manual',
      })
      .returning()

    return item
  } catch (e: unknown) {
    const pgError = e as { code?: string }
    if (pgError.code === '23505') {
      throw createError({
        statusCode: 409,
        message: 'Score already exists for this wine/vintage/critic combination',
      })
    }
    throw e
  }
})
