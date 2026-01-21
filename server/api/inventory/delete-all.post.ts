import { eq, inArray } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { inventoryLots, tastingNotes, inventoryEvents, maturityOverrides } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized',
    })
  }

  const body = await readBody(event)

  if (!body?.confirm) {
    throw createError({
      statusCode: 400,
      message: 'Confirmation required. Set confirm: true to proceed.',
    })
  }

  const userLots = await db
    .select({ id: inventoryLots.id })
    .from(inventoryLots)
    .where(eq(inventoryLots.userId, userId))

  const lotIds = userLots.map(({ id }) => id)

  if (lotIds.length === 0) {
    return {
      success: true,
      deleted: 0,
    }
  }

  await db.delete(tastingNotes).where(inArray(tastingNotes.lotId, lotIds))
  await db.delete(inventoryEvents).where(inArray(inventoryEvents.lotId, lotIds))
  await db.delete(maturityOverrides).where(inArray(maturityOverrides.lotId, lotIds))
  await db.delete(inventoryLots).where(eq(inventoryLots.userId, userId))

  return {
    success: true,
    deleted: lotIds.length,
  }
})
