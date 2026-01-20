import { z } from 'zod'
import { db } from '~/server/utils/db'
import { wines, wineGrapes } from '~/server/db/schema'

const createWineSchema = z.object({
  name: z.string().min(1).max(255),
  producerId: z.number().int().positive(),
  appellationId: z.number().int().positive().optional().nullable(),
  color: z.enum(['red', 'white', 'rose', 'sparkling', 'dessert', 'fortified']),
  defaultDrinkFromYears: z.number().int().min(0).optional().nullable(),
  defaultDrinkUntilYears: z.number().int().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
  grapeIds: z.array(z.object({
    grapeId: z.number().int().positive(),
    percentage: z.number().int().min(0).max(100).optional(),
  })).optional(),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const parsed = createWineSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid wine data',
      data: parsed.error.flatten(),
    })
  }

  const { grapeIds, ...wineData } = parsed.data

  // Insert wine
  const [wine] = await db
    .insert(wines)
    .values(wineData)
    .returning()

  // Insert grape associations if provided
  if (grapeIds && grapeIds.length > 0) {
    await db.insert(wineGrapes).values(
      grapeIds.map(g => ({
        wineId: wine.id,
        grapeId: g.grapeId,
        percentage: g.percentage,
      })),
    )
  }

  return wine
})
