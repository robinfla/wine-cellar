import { z } from 'zod'
import { db } from '~/server/utils/db'
import { regions } from '~/server/db/schema'

const createSchema = z.object({
  name: z.string().min(1),
  countryCode: z.string().length(2).default('FR'),
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

  const [created] = await db
    .insert(regions)
    .values({
      name: parsed.data.name,
      countryCode: parsed.data.countryCode,
    })
    .returning()

  return created
})
