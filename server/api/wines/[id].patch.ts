import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { wines } from '~/server/db/schema'

const updateWineSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  producerId: z.number().int().positive().optional(),
  appellationId: z.number().int().positive().nullable().optional(),
  regionId: z.number().int().positive().nullable().optional(),
  color: z.enum(['red', 'white', 'rose', 'sparkling', 'dessert', 'fortified']).optional(),
  defaultDrinkFromYears: z.number().int().min(0).nullable().optional(),
  defaultDrinkUntilYears: z.number().int().min(0).nullable().optional(),
  tasteProfile: z.array(z.string()).nullable().optional(),
  servingTempCelsius: z.number().int().nullable().optional(),
  decantMinutes: z.number().int().nullable().optional(),
  glassType: z.string().nullable().optional(),
  foodPairings: z.array(z.string()).nullable().optional(),
  notes: z.string().nullable().optional(),
  bottleImageUrl: z.string().url().nullable().optional(),
  // New enrichment fields
  styleDescription: z.string().nullable().optional(),
  isNatural: z.boolean().optional(),
  isOrganic: z.boolean().optional(),
  isBiodynamic: z.boolean().optional(),
  dataSource: z.string().nullable().optional(),
  // Taste structure
  bodyWeight: z.number().int().min(0).max(100).nullable().optional(),
  tanninLevel: z.number().int().min(0).max(100).nullable().optional(),
  sweetnessLevel: z.number().int().min(0).max(100).nullable().optional(),
  acidityLevel: z.number().int().min(0).max(100).nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid wine ID',
    })
  }

  const parsed = updateWineSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid update data',
      data: parsed.error.flatten(),
    })
  }

  const [wine] = await db
    .select()
    .from(wines)
    .where(and(eq(wines.id, id), eq(wines.userId, userId)))

  if (!wine) {
    throw createError({
      statusCode: 404,
      message: 'Wine not found',
    })
  }

  // Build update object
  const updates: Record<string, any> = {
    updatedAt: new Date(),
  }

  // Simple field mappings
  const simpleFields = [
    'name', 'producerId', 'appellationId', 'regionId', 'color',
    'defaultDrinkFromYears', 'defaultDrinkUntilYears',
    'servingTempCelsius', 'decantMinutes', 'glassType', 'notes',
    'bottleImageUrl', 'styleDescription', 'dataSource',
    'isNatural', 'isOrganic', 'isBiodynamic',
    'bodyWeight', 'tanninLevel', 'sweetnessLevel', 'acidityLevel',
  ] as const

  for (const field of simpleFields) {
    if (parsed.data[field] !== undefined) {
      updates[field] = parsed.data[field]
    }
  }

  // JSON fields
  if (parsed.data.tasteProfile !== undefined) {
    updates.tasteProfile = parsed.data.tasteProfile ? JSON.stringify(parsed.data.tasteProfile) : null
  }

  if (parsed.data.foodPairings !== undefined) {
    updates.foodPairings = parsed.data.foodPairings ? JSON.stringify(parsed.data.foodPairings) : null
  }

  // Update wine
  try {
    const [updated] = await db
      .update(wines)
      .set(updates)
      .where(eq(wines.id, id))
      .returning()

    return updated
  } catch (e: any) {
    if (e.code === '23505') {
      throw createError({
        statusCode: 409,
        message: 'A wine with this name, producer, and color already exists',
      })
    }
    throw e
  }
})
