import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { inventoryLots, inventoryEvents, tastingNotes } from '~/server/db/schema'

const consumeSchema = z.object({
  quantity: z.number().int().positive(),
  tastingNote: z.object({
    score: z.number().int().min(0).max(100).optional().nullable(),
    comment: z.string().optional().nullable(),
    pairing: z.string().optional().nullable(),
  }).optional(),
})

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)

  if (isNaN(id)) {
    throw createError({ statusCode: 400, message: 'Invalid lot ID' })
  }

  const parsed = consumeSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid consume data',
      data: parsed.error.flatten(),
    })
  }

  const [lot] = await db
    .select()
    .from(inventoryLots)
    .where(and(eq(inventoryLots.id, id), eq(inventoryLots.userId, userId)))

  if (!lot) {
    throw createError({ statusCode: 404, message: 'Inventory lot not found' })
  }

  if (lot.quantity < parsed.data.quantity) {
    throw createError({
      statusCode: 400,
      message: `Not enough bottles. Available: ${lot.quantity}`,
    })
  }

  const newQuantity = lot.quantity - parsed.data.quantity

  await db.transaction(async (tx) => {
    await tx
      .update(inventoryLots)
      .set({ quantity: newQuantity, updatedAt: new Date() })
      .where(eq(inventoryLots.id, id))

    await tx.insert(inventoryEvents).values({
      lotId: id,
      eventType: 'consume',
      quantityChange: -parsed.data.quantity,
      notes: parsed.data.tastingNote?.comment || null,
    })

    if (parsed.data.tastingNote && (parsed.data.tastingNote.score || parsed.data.tastingNote.comment || parsed.data.tastingNote.pairing)) {
      await tx.insert(tastingNotes).values({
        lotId: id,
        score: parsed.data.tastingNote.score ?? null,
        comment: parsed.data.tastingNote.comment ?? null,
        pairing: parsed.data.tastingNote.pairing ?? null,
      })
    }
  })

  return {
    success: true,
    newQuantity,
    consumed: parsed.data.quantity,
  }
})
