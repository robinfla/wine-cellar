import { z } from 'zod'
import { db } from '~/server/utils/db'
import { grapes } from '~/server/db/schema'

const createSchema = z.object({
  name: z.string().min(1),
  color: z.enum(['red', 'white', 'rose', 'sparkling', 'dessert', 'fortified']).optional(),
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

  const [created] = await db
    .insert(grapes)
    .values({
      name: parsed.data.name,
      color: parsed.data.color as any,
    })
    .returning()

  return created
})
