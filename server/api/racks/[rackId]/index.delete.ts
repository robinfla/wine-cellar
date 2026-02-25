import { eq, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { cellarRacks, cellarSpaces } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const rackId = Number(getRouterParam(event, 'rackId'))
  if (isNaN(rackId)) throw createError({ statusCode: 400, message: 'Invalid rack ID' })

  // Verify ownership via space
  const [rack] = await db.select({ id: cellarRacks.id })
    .from(cellarRacks)
    .innerJoin(cellarSpaces, eq(cellarRacks.spaceId, cellarSpaces.id))
    .where(and(eq(cellarRacks.id, rackId), eq(cellarSpaces.userId, userId)))
  if (!rack) throw createError({ statusCode: 404, message: 'Rack not found' })

  // CASCADE will clean up slots and bin_bottles
  await db.delete(cellarRacks).where(eq(cellarRacks.id, rackId))

  return { ok: true }
})
