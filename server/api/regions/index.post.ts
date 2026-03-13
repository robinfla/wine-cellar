import { z } from 'zod'
import { db } from '~/server/utils/db'
import { regions } from '~/server/db/schema'

const createSchema = z.object({
  name: z.string().min(1),
  countryCode: z.string().length(2).default('FR'),
  // Enrichment fields
  description: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  climate: z.string().optional().nullable(),
  soilTypes: z.array(z.string()).optional().nullable(),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid region data',
      data: parsed.error.flatten(),
    })
  }

  const { soilTypes, ...data } = parsed.data

  const [created] = await db
    .insert(regions)
    .values({
      ...data,
      soilTypes: soilTypes ? JSON.stringify(soilTypes) : null,
    })
    .returning()

  return created
})
