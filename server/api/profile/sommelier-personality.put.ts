import { sql } from 'drizzle-orm'
import { db } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const body = await readBody(event)
  const { personality } = body

  if (!personality) {
    throw createError({ statusCode: 400, message: 'Personality config required' })
  }

  // Ensure taste_profiles entry exists
  await db.execute(sql`
    INSERT INTO taste_profiles (user_id, personality)
    VALUES (${userId}, ${JSON.stringify(personality)}::jsonb)
    ON CONFLICT (user_id) DO UPDATE
    SET personality = ${JSON.stringify(personality)}::jsonb,
        updated_at = NOW()
  `)

  return { success: true }
})
