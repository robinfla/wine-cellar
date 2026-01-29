import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { wineValuations, wines } from '~/server/db/schema'

const schema = z.object({
  wineId: z.number().int().positive(),
  vintage: z.number().int().min(1900).max(2100).nullable(),
  priceEstimate: z.number().positive(),
  priceLow: z.number().positive().nullable().optional(),
  priceHigh: z.number().positive().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const body = await readBody(event)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid request',
      data: parsed.error.flatten(),
    })
  }

  const [wine] = await db
    .select({ id: wines.id })
    .from(wines)
    .where(and(eq(wines.id, parsed.data.wineId), eq(wines.userId, userId)))

  if (!wine) {
    throw createError({ statusCode: 404, message: 'Wine not found' })
  }

  const valuationData = {
    wineId: parsed.data.wineId,
    vintage: parsed.data.vintage,
    priceEstimate: parsed.data.priceEstimate.toString(),
    priceLow: parsed.data.priceLow?.toString() || null,
    priceHigh: parsed.data.priceHigh?.toString() || null,
    source: 'manual',
    status: 'manual' as const,
    fetchedAt: new Date(),
    updatedAt: new Date(),
  }

  const [valuation] = await db
    .insert(wineValuations)
    .values(valuationData)
    .onConflictDoUpdate({
      target: [wineValuations.wineId, wineValuations.vintage],
      set: valuationData,
    })
    .returning()

  return valuation
})
