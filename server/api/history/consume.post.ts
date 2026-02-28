import { eq, and, sql } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { inventoryLots, inventoryEvents } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const body = await readBody(event)
  const { lotId, quantity, rating, notes, consumedAt } = body

  if (!lotId || !quantity || quantity < 1) {
    throw createError({ statusCode: 400, message: 'Invalid lotId or quantity' })
  }

  // Verify lot belongs to user and has enough stock
  const lot = await db
    .select({
      id: inventoryLots.id,
      userId: inventoryLots.userId,
      currentStock: inventoryLots.quantity,
    })
    .from(inventoryLots)
    .where(eq(inventoryLots.id, lotId))
    .limit(1)

  if (!lot.length || lot[0].userId !== userId) {
    throw createError({ statusCode: 404, message: 'Inventory lot not found' })
  }

  if (lot[0].currentStock < quantity) {
    throw createError({
      statusCode: 400,
      message: `Insufficient stock (available: ${lot[0].currentStock})`,
    })
  }

  // Transaction: decrement stock + create event
  const result = await db.transaction(async (tx) => {
    // Decrement stock
    const updatedLot = await tx
      .update(inventoryLots)
      .set({ quantity: sql`${inventoryLots.quantity} - ${quantity}` })
      .where(eq(inventoryLots.id, lotId))
      .returning({ newQuantity: inventoryLots.quantity })

    // Create consumption event
    const historyEntry = await tx
      .insert(inventoryEvents)
      .values({
        lotId,
        eventType: 'consume',
        quantityChange: -quantity,
        rating: rating || null,
        tastingNotes: notes || null,
        eventDate: consumedAt ? new Date(consumedAt) : new Date(),
      })
      .returning()

    return {
      historyEntry: historyEntry[0],
      updatedStock: updatedLot[0].newQuantity,
    }
  })

  return {
    success: true,
    historyEntry: result.historyEntry,
    updatedStock: result.updatedStock,
  }
})
