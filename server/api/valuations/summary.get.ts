import { getValuationSummary } from '~/server/services/valuation'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const summary = await getValuationSummary(userId)

  return summary
})
