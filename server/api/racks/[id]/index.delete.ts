import { eq, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { cellarRacks, cellarSpaces } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const id = Number(event.context.params?.id)
  if (!id) {
    throw createError({ statusCode: 400, message: 'Invalid rack ID' })
  }

  // Verify ownership via space
  const rack = await db
    .select({ rackId: cellarRacks.id })
    .from(cellarRacks)
    .innerJoin(cellarSpaces, eq(cellarSpaces.id, cellarRacks.spaceId))
    .where(and(eq(cellarRacks.id, id), eq(cellarSpaces.userId, userId)))
    .limit(1)
  if (!rack.length) {
    throw createError({ statusCode: 404, message: 'Rack not found' })
  }

  await db.delete(cellarRacks).where(eq(cellarRacks.id, id))

  return { success: true }
})
