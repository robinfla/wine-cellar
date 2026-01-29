import { fetchValuationForWine, getWinesNeedingValuation } from '~/server/services/valuation'

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const wines = await getWinesNeedingValuation(userId)

  const results = {
    total: wines.length,
    matched: 0,
    needsReview: 0,
    noMatch: 0,
    errors: 0,
  }

  for (const wine of wines) {
    try {
      const result = await fetchValuationForWine(wine.wineId, wine.vintage, userId)

      if (result.success && result.valuation) {
        if (result.valuation.status === 'matched') results.matched++
        else if (result.valuation.status === 'needs_review') results.needsReview++
        else if (result.valuation.status === 'no_match') results.noMatch++
      }
    } catch (e) {
      console.error(`Failed to fetch valuation for wine ${wine.wineId}:`, e)
      results.errors++
    }

    await delay(3000)
  }

  return results
})
