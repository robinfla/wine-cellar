/**
 * GET /api/profile/taste
 * 
 * Returns the user's current taste profile.
 * If they have cellar data, merges onboarding + cellar signals.
 */
import { sql } from 'drizzle-orm'
import { db } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const [row] = await db.execute(sql`
    SELECT profile, onboarding_completed FROM taste_profiles WHERE user_id = ${userId}
  `) as any[]

  if (!row) {
    return {
      profile: null,
      onboardingCompleted: false,
    }
  }

  return {
    profile: row.profile,
    onboardingCompleted: row.onboarding_completed,
  }
})
