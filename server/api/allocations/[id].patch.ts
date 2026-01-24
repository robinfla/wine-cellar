import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { allocations } from '~/server/db/schema'

const updateSchema = z.object({
  producerId: z.number().int().positive().optional(),
  claimOpensAt: z.string().datetime().nullable().optional(),
  claimClosesAt: z.string().datetime().nullable().optional(),
  status: z.enum(['upcoming', 'to_claim', 'on_the_way', 'received', 'cancelled']).optional(),
  notes: z.string().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid allocation ID',
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

  const [existing] = await db
    .select()
    .from(allocations)
    .where(and(eq(allocations.id, id), eq(allocations.userId, userId)))

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'Allocation not found',
    })
  }

  // Build update object
  const updates: Record<string, any> = {
    updatedAt: new Date(),
  }

  if (parsed.data.producerId !== undefined) {
    updates.producerId = parsed.data.producerId
  }

  if (parsed.data.claimOpensAt !== undefined) {
    updates.claimOpensAt = parsed.data.claimOpensAt ? new Date(parsed.data.claimOpensAt) : null
  }

  if (parsed.data.claimClosesAt !== undefined) {
    updates.claimClosesAt = parsed.data.claimClosesAt ? new Date(parsed.data.claimClosesAt) : null
  }

  if (parsed.data.status !== undefined) {
    updates.status = parsed.data.status
  }

  if (parsed.data.notes !== undefined) {
    updates.notes = parsed.data.notes
  }

  const [updated] = await db
    .update(allocations)
    .set(updates)
    .where(eq(allocations.id, id))
    .returning()

  return updated
})
