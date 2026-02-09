import { z } from 'zod'
import { fetchCriticScoresForWine } from '~/server/services/criticScores'

const schema = z.object({
  wineId: z.number().int().positive(),
  vintage: z.number().int().min(1900).max(2100).nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const body = await readBody(event)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid request',
      data: parsed.error.flatten(),
    })
  }

  const result = await fetchCriticScoresForWine(
    parsed.data.wineId,
    parsed.data.vintage ?? null,
    userId
  )

  if (!result.success) {
    throw createError({ statusCode: 400, message: result.error })
  }

  return result
})
