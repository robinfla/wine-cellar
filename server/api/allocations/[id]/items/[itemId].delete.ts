import { eq, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { allocationItems } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const allocationId = Number(getRouterParam(event, 'id'))
  const itemId = Number(getRouterParam(event, 'itemId'))

  if (isNaN(allocationId) || isNaN(itemId)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid allocation or item ID',
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
