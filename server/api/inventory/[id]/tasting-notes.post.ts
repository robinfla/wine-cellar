import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { tastingNotes, inventoryLots } from '~/server/db/schema'

const tastingNoteSchema = z.object({
  score: z.number().int().min(0).max(100).optional().nullable(),
  comment: z.string().optional().nullable(),
  tastedAt: z.string().datetime().optional(),
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

  const parsed = tastingNoteSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid tasting note data',
      data: parsed.error.flatten(),
    })
  }

  // Verify lot exists
  const [lot] = await db
    .select({ id: inventoryLots.id })
    .from(inventoryLots)
    .where(eq(inventoryLots.id, id))

  if (!lot) {
    throw createError({
      statusCode: 404,
      message: 'Inventory lot not found',
    })
  }

  // Create tasting note
  const [note] = await db
    .insert(tastingNotes)
    .values({
      lotId: id,
      score: parsed.data.score ?? null,
      comment: parsed.data.comment ?? null,
      tastedAt: parsed.data.tastedAt ? new Date(parsed.data.tastedAt) : new Date(),
    })
    .returning()

  return note
})
