import { z } from 'zod'
import { db } from '~/server/utils/db'
import { grapes } from '~/server/db/schema'

const createSchema = z.object({
  name: z.string().min(1),
  color: z.enum(['red', 'white', 'rose', 'sparkling', 'dessert', 'fortified']).optional(),
  // Enrichment fields
  description: z.string().optional().nullable(),
  originCountry: z.string().optional().nullable(),
  aliases: z.array(z.string()).optional().nullable(),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid grape data',
      data: parsed.error.flatten(),
    })
  }

  const { aliases, ...data } = parsed.data

  const [created] = await db
    .insert(grapes)
    .values({
      ...data,
      aliases: aliases ? JSON.stringify(aliases) : null,
    })
    .returning()

  return created
})
