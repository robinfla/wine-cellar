import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { allocations, allocationItems } from '~/server/db/schema'

const createSchema = z.object({
  wineId: z.number().int().positive(),
  formatId: z.number().int().positive(),
  quantityAvailable: z.number().int().min(0).nullable().optional(),
  quantityClaimed: z.number().int().min(0).optional(),
  pricePerBottle: z.string().or(z.number()).nullable().optional(),
  currency: z.enum(['EUR', 'USD', 'GBP', 'ZAR', 'CHF']).optional(),
  notes: z.string().nullable().optional(),
})

export default defineEventHandler(async (event) => {
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

  // Verify allocation exists
  const [allocation] = await db
    .select()
    .from(allocations)
    .where(eq(allocations.id, allocationId))

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
      quantityAvailable: parsed.data.quantityAvailable ?? null,
      quantityClaimed: parsed.data.quantityClaimed ?? 0,
      pricePerBottle: parsed.data.pricePerBottle?.toString() ?? null,
      currency: parsed.data.currency || 'EUR',
      notes: parsed.data.notes ?? null,
    })
    .returning()

  return created
})
