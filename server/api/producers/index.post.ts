import { z } from 'zod'
import { eq, and, isNull } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { producers } from '~/server/db/schema'

const createProducerSchema = z.object({
  name: z.string().min(1).max(255),
  regionId: z.number().int().positive().optional().nullable(),
  website: z.string().url().optional().nullable(),
  notes: z.string().optional().nullable(),
  // Enrichment fields
  foundedYear: z.number().int().min(1000).max(2100).optional().nullable(),
  description: z.string().optional().nullable(),
  isOrganic: z.boolean().optional(),
  isBiodynamic: z.boolean().optional(),
  isNatural: z.boolean().optional(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  dataSource: z.string().optional().nullable(),
})

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const body = await readBody(event)

  const parsed = createProducerSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid producer data',
      data: parsed.error.flatten(),
    })
  }

  const conditions = [eq(producers.name, parsed.data.name), eq(producers.userId, userId)]
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

  const result = await db
    .insert(producers)
    .values({ ...parsed.data, userId })
    .returning()

  return result[0]
})
