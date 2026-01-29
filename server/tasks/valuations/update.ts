import { eq } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { users } from '~/server/db/schema'
import { fetchValuationForWine, getWinesNeedingValuation } from '~/server/services/valuation'

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export default defineTask({
  meta: {
    name: 'valuations:update',
    description: 'Update wine valuations from external sources',
  },
  async run() {
    console.log('[valuations:update] Starting weekly valuation update...')

    const allUsers = await db.select({ id: users.id }).from(users)

    let totalProcessed = 0
    let totalMatched = 0
    let totalErrors = 0

    for (const user of allUsers) {
      const wines = await getWinesNeedingValuation(user.id)
      console.log(`[valuations:update] User ${user.id}: ${wines.length} wines need valuation`)

      for (const wine of wines) {
        try {
          const result = await fetchValuationForWine(wine.wineId, wine.vintage, user.id)
          totalProcessed++

          if (result.success && result.valuation?.status === 'matched') {
            totalMatched++
          }
        } catch (e) {
          console.error(`[valuations:update] Error for wine ${wine.wineId}:`, e)
          totalErrors++
        }

        await delay(5000)
      }
    }

    console.log(`[valuations:update] Complete: ${totalProcessed} processed, ${totalMatched} matched, ${totalErrors} errors`)

    return {
      result: {
        processed: totalProcessed,
        matched: totalMatched,
        errors: totalErrors,
      },
    }
  },
})
