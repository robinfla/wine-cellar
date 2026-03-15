import { z } from 'zod'
import { db } from '~/server/utils/db'
import { tastings } from '~/server/db/schema'

const createTastingSchema = z.object({
  wineId: z.number(),
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

  const body = await readBody(event)
  const validated = createTastingSchema.parse(body)

  const [tasting] = await db
    .insert(tastings)
    .values({
      ...validated,
      userId,
    })
    .returning()

  return tasting
})
