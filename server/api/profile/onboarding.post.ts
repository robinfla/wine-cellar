/**
 * POST /api/profile/onboarding
 * 
 * Submit onboarding answers → build starter taste profile.
 * 
 * Body: OnboardingAnswers object
 * Returns: { profile, created }
 */
import { sql } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { buildProfileFromOnboarding } from '~/server/utils/onboarding-schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const answers = await readBody(event)

  // Validate required fields
  if (!answers.color_preference) {
    throw createError({ statusCode: 400, message: 'color_preference is required' })
  }

  // Build profile from onboarding answers
  const profile = buildProfileFromOnboarding(answers)

  // Upsert into taste_profiles
  await db.execute(sql`
    INSERT INTO taste_profiles (user_id, profile, onboarding_completed)
    VALUES (${userId}, ${JSON.stringify(profile)}::jsonb, true)
    ON CONFLICT (user_id) DO UPDATE SET
      profile = ${JSON.stringify(profile)}::jsonb,
      onboarding_completed = true,
      updated_at = NOW()
  `)

  return {
    profile,
    created: true,
  }
})
