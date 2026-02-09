import { fetchCriticScoresForWine, getWinesNeedingCriticScores } from '~/server/services/criticScores'

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const wines = await getWinesNeedingCriticScores(userId)

  const results = {
    total: wines.length,
    fetched: 0,
    errors: 0,
  }

  for (const wine of wines) {
    try {
      const result = await fetchCriticScoresForWine(wine.wineId, wine.vintage, userId)

      if (result.success) {
        results.fetched++
      } else {
        results.errors++
      }
    } catch (e) {
      console.error(`Failed to fetch critic scores for wine ${wine.wineId}:`, e)
      results.errors++
    }

    await delay(3000)
  }

  return results
})
