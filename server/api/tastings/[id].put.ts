import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '~/server/utils/db'
import { tastings } from '~/server/db/schema'

const updateTastingSchema = z.object({
  vintage: z.number().nullable().optional(),
  rating: z.number().min(0).max(100).nullable().optional(),
  
  // Visual
  visualColor: z.string().nullable().optional(),
  visualColorPosition: z.number().min(0).max(100).nullable().optional(),
  visualIntensity: z.string().nullable().optional(),
  visualIntensityValue: z.number().min(0).max(100).nullable().optional(),
  visualClarity: z.string().nullable().optional(),
  visualClarityValue: z.number().min(0).max(100).nullable().optional(),
  visualViscosity: z.string().nullable().optional(),
  visualViscosityValue: z.number().min(0).max(100).nullable().optional(),
  
  // Nose
  noseIntensity: z.string().nullable().optional(),
  noseIntensityValue: z.number().min(0).max(100).nullable().optional(),
  noseDevelopment: z.string().nullable().optional(),
  noseDevelopmentValue: z.number().min(0).max(100).nullable().optional(),
  noseAromas: z.array(z.string()).nullable().optional(),
  
  // Palate
  palateSweetness: z.string().nullable().optional(),
  palateSweetnessValue: z.number().min(0).max(100).nullable().optional(),
  palateAcidity: z.string().nullable().optional(),
  palateAcidityValue: z.number().min(0).max(100).nullable().optional(),
  palateTannin: z.string().nullable().optional(),
  palateTanninValue: z.number().min(0).max(100).nullable().optional(),
  palateBody: z.string().nullable().optional(),
  palateBodyValue: z.number().min(0).max(100).nullable().optional(),
  palateAlcohol: z.number().nullable().optional(),
  palateAlcoholValue: z.number().min(0).max(100).nullable().optional(),
  palateFinish: z.string().nullable().optional(),
  palateFinishValue: z.number().min(0).max(100).nullable().optional(),
  palateFlavors: z.array(z.string()).nullable().optional(),
  
  // Context
  contextPeople: z.array(z.string()).nullable().optional(),
  contextPlace: z.string().nullable().optional(),
  contextMeal: z.string().nullable().optional(),
  contextTemperature: z.number().nullable().optional(),
  contextDecantedMinutes: z.number().nullable().optional(),
  
  // Notes & Photos
  notes: z.string().nullable().optional(),
  photos: z.array(z.string()).nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized',
    })
  }

  const id = Number(getRouterParam(event, 'id'))

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid tasting ID',
    })
  }

  // Verify ownership
  const [existing] = await db
    .select({ id: tastings.id })
    .from(tastings)
    .where(and(eq(tastings.id, id), eq(tastings.userId, userId)))

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'Tasting not found',
    })
  }

  const body = await readBody(event)
  const validated = updateTastingSchema.parse(body)

  const [updated] = await db
    .update(tastings)
    .set({
      ...validated,
      updatedAt: new Date(),
    })
    .where(eq(tastings.id, id))
    .returning()

  return updated
})
