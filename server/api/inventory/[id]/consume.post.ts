import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { inventoryLots, inventoryEvents } from '~/server/db/schema'

const consumeSchema = z.object({
  quantity: z.number().int().min(1),
  rating: z.number().int().min(1).max(5).optional(),
  tastingNotes: z.string().optional(),
  eventDate: z.string().datetime().optional(),
  notes: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid lot ID',
    })
  }

  const parsed = consumeSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid consumption data',
      data: parsed.error.flatten(),
    })
  }

  // Get current lot
  const [lot] = await db
    .select()
    .from(inventoryLots)
    .where(eq(inventoryLots.id, id))

  if (!lot) {
    throw createError({
      statusCode: 404,
      message: 'Inventory lot not found',
    })
  }

  if (lot.quantity < parsed.data.quantity) {
    throw createError({
      statusCode: 400,
      message: `Not enough bottles. Available: ${lot.quantity}`,
    })
  }

  // Update quantity
  const newQuantity = lot.quantity - parsed.data.quantity
  await db
    .update(inventoryLots)
    .set({
      quantity: newQuantity,
      updatedAt: new Date(),
    })
    .where(eq(inventoryLots.id, id))

  // Create consume event
  await db.insert(inventoryEvents).values({
    lotId: id,
    eventType: 'consume',
    quantityChange: -parsed.data.quantity,
    rating: parsed.data.rating,
    tastingNotes: parsed.data.tastingNotes,
    eventDate: parsed.data.eventDate ? new Date(parsed.data.eventDate) : new Date(),
    notes: parsed.data.notes,
  })

  return {
    success: true,
    newQuantity,
  }
})
