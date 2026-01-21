import { eq, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { cellars, inventoryLots } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const id = Number(getRouterParam(event, 'id'))
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: 'Invalid cellar ID' })
  }

  const [cellar] = await db
    .select()
    .from(cellars)
    .where(and(eq(cellars.id, id), eq(cellars.userId, userId)))
    .limit(1)

  if (!cellar) {
    throw createError({ statusCode: 404, message: 'Cellar not found' })
  }

  const [lotCount] = await db
    .select({ count: inventoryLots.id })
    .from(inventoryLots)
    .where(eq(inventoryLots.cellarId, id))
    .limit(1)

  if (lotCount) {
    throw createError({ 
      statusCode: 400, 
      message: 'Cannot delete cellar with wines. Move or delete the wines first.' 
    })
  }

  await db.delete(cellars).where(eq(cellars.id, id))

  return { success: true }
})
