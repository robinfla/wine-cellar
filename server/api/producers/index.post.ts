import { z } from 'zod'
import { eq, and, isNull } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { producers } from '~/server/db/schema'

const createProducerSchema = z.object({
  name: z.string().min(1).max(255),
  regionId: z.number().int().positive().optional().nullable(),
  website: z.string().url().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const parsed = createProducerSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid producer data',
      data: parsed.error.flatten(),
    })
  }

  // Check if producer already exists with same name and region
  const conditions = [eq(producers.name, parsed.data.name)]
  if (parsed.data.regionId) {
    conditions.push(eq(producers.regionId, parsed.data.regionId))
  } else {
    conditions.push(isNull(producers.regionId))
  }

  const [existing] = await db
    .select()
    .from(producers)
    .where(and(...conditions))

  if (existing) {
    return existing
  }

  // Create new producer
  const result = await db
    .insert(producers)
    .values(parsed.data)
    .returning()

  return result[0]
})
