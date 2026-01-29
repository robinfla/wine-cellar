import { z } from 'zod'
import { fetchValuationForWine } from '~/server/services/valuation'

const schema = z.object({
  wineId: z.number().int().positive(),
  vintage: z.number().int().min(1900).max(2100).nullable(),
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

  const result = await fetchValuationForWine(
    parsed.data.wineId,
    parsed.data.vintage,
    userId
  )

  if (!result.success) {
    throw createError({ statusCode: 400, message: result.error })
  }

  return result.valuation
})
