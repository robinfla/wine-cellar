import { z } from 'zod'
import { db } from '~/server/utils/db'
import { appellations } from '~/server/db/schema'

const createSchema = z.object({
  name: z.string().min(1),
  regionId: z.number().int().optional(),
  level: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid appellation data',
      data: parsed.error.flatten(),
    })
  }

  const [created] = await db
    .insert(appellations)
    .values({
      name: parsed.data.name,
      regionId: parsed.data.regionId,
      level: parsed.data.level,
    })
    .returning()

  return created
})
