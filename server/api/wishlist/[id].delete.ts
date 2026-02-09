import { eq, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { wishlistItems } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const id = Number(getRouterParam(event, 'id'))

  if (isNaN(id)) {
    throw createError({ statusCode: 400, message: 'Invalid wishlist item ID' })
  }

  const [item] = await db
    .select()
    .from(wishlistItems)
    .where(and(eq(wishlistItems.id, id), eq(wishlistItems.userId, userId)))

  if (!item) {
    throw createError({ statusCode: 404, message: 'Wishlist item not found' })
  }

  await db
    .delete(wishlistItems)
    .where(eq(wishlistItems.id, id))

  return { success: true }
})
