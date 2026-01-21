import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { allocationItems, allocations } from '~/server/db/schema'

const updateSchema = z.object({
  quantityAvailable: z.number().int().min(0).nullable().optional(),
  quantityClaimed: z.number().int().min(0).optional(),
  pricePerBottle: z.string().or(z.number()).nullable().optional(),
  currency: z.enum(['EUR', 'USD', 'GBP', 'ZAR', 'CHF']).optional(),
  notes: z.string().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized',
    })
  }

  const allocationId = Number(getRouterParam(event, 'id'))
  const itemId = Number(getRouterParam(event, 'itemId'))
  const body = await readBody(event)

  if (isNaN(allocationId) || isNaN(itemId)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid allocation or item ID',
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

  // Verify allocation belongs to user
  const [allocation] = await db
    .select()
    .from(allocations)
    .where(and(eq(allocations.id, allocationId), eq(allocations.userId, userId)))

  if (!allocation) {
    throw createError({
      statusCode: 404,
      message: 'Allocation not found',
    })
  }

  // Check if item exists and belongs to the allocation
  const [existing] = await db
    .select()
    .from(allocationItems)
    .where(and(eq(allocationItems.id, itemId), eq(allocationItems.allocationId, allocationId)))

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'Item not found',
    })
  }

  // Build update object
  const updates: Record<string, any> = {
    updatedAt: new Date(),
  }

  if (parsed.data.quantityAvailable !== undefined) {
    updates.quantityAvailable = parsed.data.quantityAvailable
  }

  if (parsed.data.quantityClaimed !== undefined) {
    updates.quantityClaimed = parsed.data.quantityClaimed
  }

  if (parsed.data.pricePerBottle !== undefined) {
    updates.pricePerBottle = parsed.data.pricePerBottle?.toString() ?? null
  }

  if (parsed.data.currency !== undefined) {
    updates.currency = parsed.data.currency
  }

  if (parsed.data.notes !== undefined) {
    updates.notes = parsed.data.notes
  }

  const [updated] = await db
    .update(allocationItems)
    .set(updates)
    .where(eq(allocationItems.id, itemId))
    .returning()

  return updated
})
