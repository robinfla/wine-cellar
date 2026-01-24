import { z } from 'zod'
import { eq, and, sql } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { producers, regions, wines, inventoryLots } from '~/server/db/schema'

const updateProducerSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  regionId: z.number().int().positive().optional().nullable(),
  website: z.string().url().optional().nullable().or(z.literal('')),
  notes: z.string().optional().nullable(),
})

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const id = Number(getRouterParam(event, 'id'))
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: 'Invalid producer ID' })
  }

  const body = await readBody(event)

  const parsed = updateProducerSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid producer data',
      data: parsed.error.flatten(),
    })
  }

  const [existing] = await db
    .select({ id: producers.id })
    .from(producers)
    .where(and(eq(producers.id, id), eq(producers.userId, userId)))

  if (!existing) {
    throw createError({ statusCode: 404, message: 'Producer not found' })
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  }

  if (parsed.data.name !== undefined) {
    updateData.name = parsed.data.name
  }
  if (parsed.data.regionId !== undefined) {
    updateData.regionId = parsed.data.regionId
  }
  if (parsed.data.website !== undefined) {
    updateData.website = parsed.data.website || null
  }
  if (parsed.data.notes !== undefined) {
    updateData.notes = parsed.data.notes
  }

  try {
    await db
      .update(producers)
      .set(updateData)
      .where(eq(producers.id, id))
  } catch (e: any) {
    if (e.code === '23505') {
      throw createError({
        statusCode: 409,
        message: 'A producer with this name already exists in this region',
      })
    }
    throw e
  }

  const [updated] = await db
    .select({
      id: producers.id,
      name: producers.name,
      regionId: producers.regionId,
      regionName: regions.name,
      website: producers.website,
      notes: producers.notes,
      bottleCount: sql<number>`cast(coalesce(sum(${inventoryLots.quantity}), 0) as int)`,
      createdAt: producers.createdAt,
    })
    .from(producers)
    .leftJoin(regions, eq(producers.regionId, regions.id))
    .leftJoin(wines, eq(wines.producerId, producers.id))
    .leftJoin(inventoryLots, eq(inventoryLots.wineId, wines.id))
    .where(eq(producers.id, id))
    .groupBy(producers.id, regions.name)

  return updated
})
