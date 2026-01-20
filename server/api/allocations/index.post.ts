import { z } from 'zod'
import { db } from '~/server/utils/db'
import { allocations } from '~/server/db/schema'

const createSchema = z.object({
  producerId: z.number().int().positive(),
  year: z.number().int().min(2000).max(2100),
  claimOpensAt: z.string().datetime().nullable().optional(),
  claimClosesAt: z.string().datetime().nullable().optional(),
  status: z.enum(['upcoming', 'to_claim', 'on_the_way', 'received', 'cancelled']).optional(),
  notes: z.string().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid allocation data',
      data: parsed.error.flatten(),
    })
  }

  const [created] = await db
    .insert(allocations)
    .values({
      producerId: parsed.data.producerId,
      year: parsed.data.year,
      claimOpensAt: parsed.data.claimOpensAt ? new Date(parsed.data.claimOpensAt) : null,
      claimClosesAt: parsed.data.claimClosesAt ? new Date(parsed.data.claimClosesAt) : null,
      status: parsed.data.status || 'upcoming',
      notes: parsed.data.notes || null,
    })
    .returning()

  return created
})
