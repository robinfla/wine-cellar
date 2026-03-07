import { eq, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { rackSlots, inventoryLots } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const body = await readBody(event)
  const { lotId, quantity } = body

  if (!lotId || isNaN(lotId)) {
    throw createError({ statusCode: 400, message: 'Invalid lot ID' })
  }

  if (!quantity || quantity < 1) {
    throw createError({ statusCode: 400, message: 'Quantity must be at least 1' })
  }

  // Verify lot ownership
  const [lot] = await db.select().from(inventoryLots)
    .where(and(eq(inventoryLots.id, lotId), eq(inventoryLots.userId, userId)))
  if (!lot) throw createError({ statusCode: 404, message: 'Lot not found' })

  // Find assigned slots for this lot
  const slots = await db.select().from(rackSlots)
    .where(eq(rackSlots.inventoryLotId, lotId))
    .limit(quantity)

  if (slots.length < quantity) {
    throw createError({ 
      statusCode: 400, 
      message: `Only ${slots.length} bottle(s) are assigned to rack locations` 
    })
  }

  // Remove bottles from slots (delete the slot entries)
  const slotIds = slots.map(s => s.id)
  for (const slotId of slotIds) {
    await db.delete(rackSlots).where(eq(rackSlots.id, slotId))
  }

  return {
    success: true,
    unassigned: quantity,
  }
})
