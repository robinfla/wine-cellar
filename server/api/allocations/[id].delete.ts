import { eq, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { allocations } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized',
    })
  }

  const id = Number(getRouterParam(event, 'id'))

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid allocation ID',
    })
  }

  // Check if allocation exists and belongs to user
  const [existing] = await db
    .select()
    .from(allocations)
    .where(and(eq(allocations.id, id), eq(allocations.userId, userId)))

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'Allocation not found',
    })
  }

  // Delete allocation (items will cascade delete due to ON DELETE CASCADE)
  await db.delete(allocations).where(and(eq(allocations.id, id), eq(allocations.userId, userId)))

  return { success: true }
})
