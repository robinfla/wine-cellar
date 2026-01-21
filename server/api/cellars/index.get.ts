import { eq } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { cellars } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const result = await db
    .select()
    .from(cellars)
    .where(eq(cellars.userId, userId))
    .orderBy(cellars.name)

  return result
})
