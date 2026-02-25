import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { cellarRacks, cellarSpaces, rackSlots } from '~/server/db/schema'

const removeSchema = z.object({
  row: z.number().int().min(1),
  column: z.number().int().min(1),
  depthPosition: z.number().int().min(1).optional(),
})

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const rackId = Number(event.context.params?.rackId)
  if (!rackId) {
    throw createError({ statusCode: 400, message: 'Invalid rack ID' })
  }

  // Verify rack ownership
  const rack = await db
    .select({ rackId: cellarRacks.id })
    .from(cellarRacks)
    .innerJoin(cellarSpaces, eq(cellarSpaces.id, cellarRacks.spaceId))
    .where(and(eq(cellarRacks.id, rackId), eq(cellarSpaces.userId, userId)))
    .limit(1)
  if (!rack.length) {
    throw createError({ statusCode: 404, message: 'Rack not found' })
  }

  const body = await readBody(event)
  const parsed = removeSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid input', data: parsed.error.flatten() })
  }

  const { row, column, depthPosition = 1 } = parsed.data

  const deleted = await db.delete(rackSlots)
    .where(and(
      eq(rackSlots.rackId, rackId),
      eq(rackSlots.row, row),
      eq(rackSlots.column, column),
      eq(rackSlots.depthPosition, depthPosition),
    ))
    .returning({ id: rackSlots.id })

  if (!deleted.length) {
    throw createError({ statusCode: 404, message: 'Slot not found' })
  }

  return { success: true }
})
