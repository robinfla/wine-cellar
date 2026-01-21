import { eq, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { allocationItems, allocations } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized',
    })
  }

  const allocationId = Number(getRouterParam(event, 'id'))
  const itemId = Number(getRouterParam(event, 'itemId'))

  if (isNaN(allocationId) || isNaN(itemId)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid allocation or item ID',
    })
  }

  // Verify allocation belongs to user
  const [allocation] = await db
    .select()
    .from(allocations)
    .where(and(eq(allocations.id, allocationId), eq(allocations.userId, userId)))

  if (!allocation) {
    throw createError({
      statusCode: 404,
      message: 'Allocation not found',
    })
  }

  // Check if item exists and belongs to the allocation
  const [existing] = await db
    .select()
    .from(allocationItems)
    .where(and(eq(allocationItems.id, itemId), eq(allocationItems.allocationId, allocationId)))

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'Item not found',
    })
  }

  await db.delete(allocationItems).where(eq(allocationItems.id, itemId))

  return { success: true }
})
