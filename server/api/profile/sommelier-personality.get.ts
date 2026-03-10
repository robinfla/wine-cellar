import { sql } from 'drizzle-orm'
import { db } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const [row] = await db.execute(sql`
    SELECT personality FROM taste_profiles WHERE user_id = ${userId}
  `) as any[]

  if (!row || !row.personality) {
    // Return default personality
    return {
      personality: {
        tone: 'friendly',
        verbosity: 'balanced',
        formality: 'casual',
        teachingStyle: 'explain',
        recommendationStyle: 'balanced',
        priceSensitivity: 'value',
        regionalPreference: 'balanced',
      },
    }
  }

  return { personality: row.personality }
})
