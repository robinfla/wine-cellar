import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { wines } from '~/server/db/schema'

const updateWineSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  producerId: z.number().int().positive().optional(),
  appellationId: z.number().int().positive().nullable().optional(),
  regionId: z.number().int().positive().nullable().optional(),
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
      message: 'Invalid wine ID',
    })
  }

  const parsed = updateWineSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid update data',
      data: parsed.error.flatten(),
    })
  }

  const [wine] = await db
    .select()
    .from(wines)
    .where(and(eq(wines.id, id), eq(wines.userId, userId)))

  if (!wine) {
    throw createError({
      statusCode: 404,
      message: 'Wine not found',
    })
  }

  // Build update object
  const updates: Record<string, any> = {
    updatedAt: new Date(),
  }

  if (parsed.data.name !== undefined) {
    updates.name = parsed.data.name
  }

  if (parsed.data.producerId !== undefined) {
    updates.producerId = parsed.data.producerId
  }

  if (parsed.data.appellationId !== undefined) {
    updates.appellationId = parsed.data.appellationId
  }

  if (parsed.data.regionId !== undefined) {
    updates.regionId = parsed.data.regionId
  }

  // Update wine
  const [updated] = await db
    .update(wines)
    .set(updates)
    .where(eq(wines.id, id))
    .returning()

  return updated
})
