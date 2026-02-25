import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { cellarSpaces, cellarRacks } from '~/server/db/schema'

const createRackSchema = z.object({
  wallId: z.number().int().positive().optional().nullable(),
  columns: z.number().int().min(1),
  rows: z.number().int().min(1),
  depth: z.number().int().min(1).optional(),
})

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const spaceId = Number(event.context.params?.spaceId)
  if (!spaceId) {
    throw createError({ statusCode: 400, message: 'Invalid space ID' })
  }

  // Verify space ownership
  const space = await db.select({ id: cellarSpaces.id }).from(cellarSpaces)
    .where(and(eq(cellarSpaces.id, spaceId), eq(cellarSpaces.userId, userId)))
    .limit(1)
  if (!space.length) {
    throw createError({ statusCode: 404, message: 'Space not found' })
  }

  const body = await readBody(event)
  const parsed = createRackSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid input', data: parsed.error.flatten() })
  }

  const [rack] = await db.insert(cellarRacks).values({
    spaceId,
    wallId: parsed.data.wallId ?? null,
    columns: parsed.data.columns,
    rows: parsed.data.rows,
    depth: parsed.data.depth ?? 1,
  }).returning()

  return rack
})
