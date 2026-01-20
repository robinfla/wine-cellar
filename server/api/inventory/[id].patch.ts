import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { inventoryLots } from '~/server/db/schema'

const updateSchema = z.object({
  quantity: z.number().int().min(0).optional(),
  formatId: z.number().int().positive().optional(),
  vintage: z.number().int().min(1900).max(2100).nullable().optional(),
  purchaseDate: z.string().nullable().optional(),
  purchasePricePerBottle: z.string().nullable().optional(),
  purchaseSource: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
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

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid update data',
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

  // Build update object
  const updates: Record<string, any> = {
    updatedAt: new Date(),
  }

  if (parsed.data.quantity !== undefined) {
    updates.quantity = parsed.data.quantity
  }

  if (parsed.data.formatId !== undefined) {
    updates.formatId = parsed.data.formatId
  }

  if (parsed.data.vintage !== undefined) {
    updates.vintage = parsed.data.vintage
  }

  if (parsed.data.purchaseDate !== undefined) {
    updates.purchaseDate = parsed.data.purchaseDate ? new Date(parsed.data.purchaseDate) : null
  }

  if (parsed.data.purchasePricePerBottle !== undefined) {
    updates.purchasePricePerBottle = parsed.data.purchasePricePerBottle
  }

  if (parsed.data.purchaseSource !== undefined) {
    updates.purchaseSource = parsed.data.purchaseSource
  }

  if (parsed.data.notes !== undefined) {
    updates.notes = parsed.data.notes
  }

  // Update lot
  const [updated] = await db
    .update(inventoryLots)
    .set(updates)
    .where(eq(inventoryLots.id, id))
    .returning()

  return updated
})
