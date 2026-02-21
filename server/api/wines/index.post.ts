import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { wines, wineGrapes, producers, regions, appellations } from '~/server/db/schema'
import { estimateMaturity } from '~/server/utils/maturity-ai'

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
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

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

  const [existingWine] = await db
    .select()
    .from(wines)
    .where(and(
      eq(wines.name, wineData.name),
      eq(wines.producerId, wineData.producerId),
      eq(wines.color, wineData.color),
      eq(wines.userId, userId),
    ))

  if (existingWine) {
    return existingWine
  }

  // If no maturity data provided, estimate with AI
  let finalWineData = { ...wineData }
  if (finalWineData.defaultDrinkFromYears == null || finalWineData.defaultDrinkUntilYears == null) {
    try {
      // Resolve producer/region/appellation names for AI context
      const [producer] = await db.select({ name: producers.name, regionId: producers.regionId }).from(producers).where(eq(producers.id, wineData.producerId))
      let regionName: string | null = null
      if (producer?.regionId) {
        const [region] = await db.select({ name: regions.name }).from(regions).where(eq(regions.id, producer.regionId))
        regionName = region?.name ?? null
      }
      let appellationName: string | null = null
      if (wineData.appellationId) {
        const [appellation] = await db.select({ name: appellations.name }).from(appellations).where(eq(appellations.id, wineData.appellationId))
        appellationName = appellation?.name ?? null
      }

      const estimate = await estimateMaturity({
        wineName: wineData.name,
        producer: producer?.name ?? 'Unknown',
        color: wineData.color,
        region: regionName,
        appellation: appellationName,
      })

      if (estimate) {
        finalWineData.defaultDrinkFromYears = estimate.drinkFromYears
        finalWineData.defaultDrinkUntilYears = estimate.drinkUntilYears
        console.log(`[maturity-ai] ${producer?.name} ${wineData.name}: ${estimate.drinkFromYears}-${estimate.drinkUntilYears}yr (${estimate.confidence}) — ${estimate.reasoning}`)
      }
    } catch (e) {
      console.error('[maturity-ai] Error during estimation, proceeding without:', e)
    }
  }

  const [wine] = await db
    .insert(wines)
    .values({ ...finalWineData, userId })
    .returning()

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
