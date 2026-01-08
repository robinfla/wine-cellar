import { z } from 'zod'
import { db } from '~/server/utils/db'
import { producers } from '~/server/db/schema'

const createProducerSchema = z.object({
  name: z.string().min(1).max(255),
  regionId: z.number().int().positive().optional(),
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

  const result = await db
    .insert(producers)
    .values(parsed.data)
    .returning()

  return result[0]
})
