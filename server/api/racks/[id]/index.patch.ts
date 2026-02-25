import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { cellarRacks, cellarSpaces } from '~/server/db/schema'

const updateRackSchema = z.object({
  columns: z.number().int().min(1).optional(),
  rows: z.number().int().min(1).optional(),
  depth: z.number().int().min(1).optional(),
  sortOrder: z.number().int().optional(),
})

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const id = Number(event.context.params?.id)
  if (!id) {
    throw createError({ statusCode: 400, message: 'Invalid rack ID' })
  }

  // Verify ownership via space
  const rack = await db
    .select({ rackId: cellarRacks.id })
    .from(cellarRacks)
    .innerJoin(cellarSpaces, eq(cellarSpaces.id, cellarRacks.spaceId))
    .where(and(eq(cellarRacks.id, id), eq(cellarSpaces.userId, userId)))
    .limit(1)
  if (!rack.length) {
    throw createError({ statusCode: 404, message: 'Rack not found' })
  }

  const body = await readBody(event)
  const parsed = updateRackSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid input', data: parsed.error.flatten() })
  }

  const [updated] = await db.update(cellarRacks)
    .set(parsed.data)
    .where(eq(cellarRacks.id, id))
    .returning()

  return updated
})
