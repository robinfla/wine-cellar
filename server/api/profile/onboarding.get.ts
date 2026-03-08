/**
 * GET /api/profile/onboarding
 * 
 * Returns the onboarding questions schema for the mobile app to render.
 */
import { onboardingQuestions } from '~/server/utils/onboarding-schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  return {
    questions: onboardingQuestions,
  }
})
