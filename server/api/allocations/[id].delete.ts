import { eq } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { allocations } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid allocation ID',
    })
  }

  // Check if allocation exists
  const [existing] = await db
    .select()
    .from(allocations)
    .where(eq(allocations.id, id))

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'Allocation not found',
    })
  }

  // Delete allocation (items will cascade delete due to ON DELETE CASCADE)
  await db.delete(allocations).where(eq(allocations.id, id))

  return { success: true }
})
