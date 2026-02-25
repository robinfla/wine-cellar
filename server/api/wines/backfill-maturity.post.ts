import { eq, and, isNull } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { wines, producers, regions, appellations, grapes, wineGrapes } from '~/server/db/schema'
import { estimateMaturity } from '~/server/utils/maturity-ai'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  // Get wines missing maturity data
  const winesToUpdate = await db
    .select({
      id: wines.id,
      name: wines.name,
      color: wines.color,
      producerId: wines.producerId,
      appellationId: wines.appellationId,
      producerName: producers.name,
      regionId: producers.regionId,
    })
    .from(wines)
    .innerJoin(producers, eq(wines.producerId, producers.id))
    .where(
      and(
        eq(wines.userId, userId),
        isNull(wines.defaultDrinkFromYears),
      ),
    )

  let updated = 0
  let failed = 0
  const results: { wine: string; producer: string; from: number; until: number; confidence: string; reasoning: string }[] = []

  for (const wine of winesToUpdate) {
    try {
      // Resolve region
      let regionName: string | null = null
      if (wine.regionId) {
        const [region] = await db.select({ name: regions.name }).from(regions).where(eq(regions.id, wine.regionId))
        regionName = region?.name ?? null
      }

      // Resolve appellation
      let appellationName: string | null = null
      if (wine.appellationId) {
        const [appellation] = await db.select({ name: appellations.name }).from(appellations).where(eq(appellations.id, wine.appellationId))
        appellationName = appellation?.name ?? null
      }

      // Resolve grapes
      const wineGrapeRows = await db
        .select({ name: grapes.name })
        .from(wineGrapes)
        .innerJoin(grapes, eq(wineGrapes.grapeId, grapes.id))
        .where(eq(wineGrapes.wineId, wine.id))
      const grapeNames = wineGrapeRows.map(g => g.name).join(', ') || null

      const estimate = await estimateMaturity({
        wineName: wine.name,
        producer: wine.producerName,
        color: wine.color,
        region: regionName,
        appellation: appellationName,
        grapes: grapeNames,
      })

      if (estimate) {
        await db.update(wines).set({
          defaultDrinkFromYears: estimate.drinkFromYears,
          defaultDrinkUntilYears: estimate.drinkUntilYears,
        }).where(eq(wines.id, wine.id))

        updated++
        results.push({
          wine: wine.name,
          producer: wine.producerName,
          from: estimate.drinkFromYears,
          until: estimate.drinkUntilYears,
          confidence: estimate.confidence,
          reasoning: estimate.reasoning,
        })
      } else {
        failed++
      }

      // Rate limit — don't hammer Claude
      await new Promise(r => setTimeout(r, 200))
    } catch (e) {
      console.error(`[backfill] Failed for ${wine.producerName} ${wine.name}:`, e)
      failed++
    }
  }

  return {
    total: winesToUpdate.length,
    updated,
    failed,
    results,
  }
})
