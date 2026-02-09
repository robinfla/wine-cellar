import { db } from '~/server/utils/db'
import { users } from '~/server/db/schema'
import { fetchCriticScoresForWine, getWinesNeedingCriticScores } from '~/server/services/criticScores'

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export default defineTask({
  meta: {
    name: 'critic-scores:update',
    description: 'Update wine critic scores from Wine-Searcher',
  },
  async run() {
    console.log('[critic-scores:update] Starting weekly critic score update...')

    const allUsers = await db.select({ id: users.id }).from(users)

    let totalProcessed = 0
    let totalFetched = 0
    let totalErrors = 0

    for (const user of allUsers) {
      const wines = await getWinesNeedingCriticScores(user.id)
      console.log(`[critic-scores:update] User ${user.id}: ${wines.length} wines need score updates`)

      for (const wine of wines) {
        try {
          const result = await fetchCriticScoresForWine(wine.wineId, wine.vintage, user.id)
          totalProcessed++

          if (result.success) {
            totalFetched++
          }
        } catch (e) {
          console.error(`[critic-scores:update] Error for wine ${wine.wineId}:`, e)
          totalErrors++
        }

        await delay(5000)
      }
    }

    console.log(`[critic-scores:update] Complete: ${totalProcessed} processed, ${totalFetched} fetched, ${totalErrors} errors`)

    return {
      result: {
        processed: totalProcessed,
        fetched: totalFetched,
        errors: totalErrors,
      },
    }
  },
})
