/**
 * PUT /api/profile/taste
 * 
 * Update the user's taste profile (partial update).
 * Used for manual preference updates from settings.
 */
import { sql } from 'drizzle-orm'
import { db } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const updates = await readBody(event)

  // Merge updates into existing profile
  await db.execute(sql`
    UPDATE taste_profiles
    SET 
      profile = profile || ${JSON.stringify(updates)}::jsonb,
      updated_at = NOW()
    WHERE user_id = ${userId}
  `)

  const [row] = await db.execute(sql`
    SELECT profile FROM taste_profiles WHERE user_id = ${userId}
  `) as any[]

  return {
    profile: row?.profile || null,
    updated: true,
  }
})
