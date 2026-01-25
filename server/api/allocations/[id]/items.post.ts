import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { allocations, allocationItems } from '~/server/db/schema'

const createSchema = z.object({
  wineId: z.number().int().positive(),
  formatId: z.number().int().positive(),
  vintage: z.number().int().min(1900).max(2100).nullable().optional(),
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
  const body = await readBody(event)

  if (isNaN(allocationId)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid allocation ID',
    })
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid item data',
      data: parsed.error.flatten(),
    })
  }

  // Verify allocation exists and belongs to user
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

  const [created] = await db
    .insert(allocationItems)
    .values({
      allocationId,
      wineId: parsed.data.wineId,
      formatId: parsed.data.formatId,
      vintage: parsed.data.vintage ?? null,
      quantityAvailable: parsed.data.quantityAvailable ?? null,
      quantityClaimed: parsed.data.quantityClaimed ?? 0,
      pricePerBottle: parsed.data.pricePerBottle?.toString() ?? null,
      currency: parsed.data.currency || 'EUR',
      notes: parsed.data.notes ?? null,
    })
    .returning()

  return created
})
