import { eq, and, or, isNull, lt, sql } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { wines, producers, wineValuations, inventoryLots } from '~/server/db/schema'
import { searchVivino } from './vivino'
import { searchWineSearcher } from './wineSearcher'
import {
  findBestMatch,
  CONFIDENCE_THRESHOLD,
  REVIEW_THRESHOLD,
  type MatchCandidate,
} from './matcher'

const STALE_DAYS = 7
const WINE_SEARCHER_CONFIDENCE = 0.90

const saveValuation = async (
  wineId: number,
  vintage: number | null,
  data: Partial<typeof wineValuations.$inferInsert>
) => {
  const valuationData = {
    wineId,
    vintage,
    fetchedAt: new Date(),
    updatedAt: new Date(),
    ...data,
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
}

export const fetchValuationForWine = async (
  wineId: number,
  vintage: number | null,
  userId: number
): Promise<{ success: boolean; valuation?: any; error?: string }> => {
  const [wine] = await db
    .select({
      id: wines.id,
      name: wines.name,
      producerName: producers.name,
    })
    .from(wines)
    .innerJoin(producers, eq(wines.producerId, producers.id))
    .where(and(eq(wines.id, wineId), eq(wines.userId, userId)))

  if (!wine) {
    return { success: false, error: 'Wine not found' }
  }

  const query = `${wine.producerName} ${wine.name}`

  // Try Vivino first
  const vivinoResults = await searchVivino(query, vintage)

  if (vivinoResults?.wines && vivinoResults.wines.length > 0) {
    const candidates: MatchCandidate[] = vivinoResults.wines
      .filter(w => w.id && w.name)
      .map(w => ({
        sourceId: w.id.toString(),
        sourceName: w.name,
        sourceWinery: w.winery?.name || '',
        sourceVintage: w.vintage?.year,
        price: w.price?.amount,
      }))

    const match = findBestMatch(
      { name: wine.name, producerName: wine.producerName },
      vintage,
      candidates,
      'vivino'
    )

    if (match && match.confidence >= REVIEW_THRESHOLD) {
      const status = match.confidence >= CONFIDENCE_THRESHOLD
        ? 'matched' as const
        : 'needs_review' as const

      const valuation = await saveValuation(wineId, vintage, {
        priceEstimate: match.candidate.price?.toString() || null,
        priceLow: match.candidate.priceLow?.toString() || null,
        priceHigh: match.candidate.priceHigh?.toString() || null,
        source: 'vivino',
        sourceUrl: `https://www.vivino.com/w/${match.candidate.sourceId}`,
        sourceWineId: match.candidate.sourceId,
        sourceName: `${match.candidate.sourceWinery} ${match.candidate.sourceName}`.trim(),
        status,
        confidence: match.confidence.toString(),
      })

      return { success: true, valuation }
    }
  }

  try {
    const wineSearcherResult = await searchWineSearcher(query, vintage)

    if (wineSearcherResult && wineSearcherResult.price > 0) {
      const valuation = await saveValuation(wineId, vintage, {
        priceEstimate: wineSearcherResult.price.toString(),
        source: 'wine-searcher',
        sourceUrl: wineSearcherResult.url,
        sourceName: wineSearcherResult.name,
        status: 'matched' as const,
        confidence: WINE_SEARCHER_CONFIDENCE.toString(),
      })

      return { success: true, valuation }
    }
  } catch (err) {
    console.error(`[Valuation] Wine-Searcher error:`, err)
  }

  const valuation = await saveValuation(wineId, vintage, {
    status: 'pending' as const,
  })

  return { success: true, valuation }
}

export const getWinesNeedingValuation = async (userId: number) => {
  const staleDate = new Date()
  staleDate.setDate(staleDate.getDate() - STALE_DAYS)

  const result = await db
    .selectDistinct({
      wineId: inventoryLots.wineId,
      vintage: inventoryLots.vintage,
      wineName: wines.name,
      producerName: producers.name,
    })
    .from(inventoryLots)
    .innerJoin(wines, eq(inventoryLots.wineId, wines.id))
    .innerJoin(producers, eq(wines.producerId, producers.id))
    .leftJoin(
      wineValuations,
      and(
        eq(wineValuations.wineId, inventoryLots.wineId),
        or(
          eq(wineValuations.vintage, inventoryLots.vintage),
          and(isNull(wineValuations.vintage), isNull(inventoryLots.vintage))
        )
      )
    )
    .where(
      and(
        eq(inventoryLots.userId, userId),
        or(
          isNull(wineValuations.id),
          lt(wineValuations.fetchedAt, staleDate)
        )
      )
    )

  return result
}

export const getAllValuations = async (userId: number) => {
  const valuations = await db
    .select({
      id: wineValuations.id,
      wineId: wineValuations.wineId,
      wineName: wines.name,
      wineColor: wines.color,
      producerName: producers.name,
      vintage: wineValuations.vintage,
      priceEstimate: wineValuations.priceEstimate,
      priceLow: wineValuations.priceLow,
      priceHigh: wineValuations.priceHigh,
      source: wineValuations.source,
      sourceUrl: wineValuations.sourceUrl,
      sourceName: wineValuations.sourceName,
      status: wineValuations.status,
      confidence: wineValuations.confidence,
      fetchedAt: wineValuations.fetchedAt,
    })
    .from(wineValuations)
    .innerJoin(wines, eq(wineValuations.wineId, wines.id))
    .innerJoin(producers, eq(wines.producerId, producers.id))
    .where(eq(wines.userId, userId))

  return valuations
}

export const getValuationSummary = async (userId: number) => {
  const [stats] = await db
    .select({
      totalBottles: sql<number>`COALESCE(SUM(${inventoryLots.quantity}), 0)`,
      totalCost: sql<number>`COALESCE(SUM(${inventoryLots.quantity} * ${inventoryLots.purchasePricePerBottle}), 0)`,
      totalValue: sql<number>`COALESCE(SUM(${inventoryLots.quantity} * ${wineValuations.priceEstimate}), 0)`,
      winesWithValuation: sql<number>`COUNT(DISTINCT CASE WHEN ${wineValuations.priceEstimate} IS NOT NULL THEN ${inventoryLots.wineId} END)`,
      winesNeedingReview: sql<number>`COUNT(DISTINCT CASE WHEN ${wineValuations.status} = 'needs_review' THEN ${inventoryLots.wineId} END)`,
      winesNoMatch: sql<number>`COUNT(DISTINCT CASE WHEN ${wineValuations.status} = 'no_match' THEN ${inventoryLots.wineId} END)`,
    })
    .from(inventoryLots)
    .leftJoin(
      wineValuations,
      and(
        eq(wineValuations.wineId, inventoryLots.wineId),
        sql`(${wineValuations.vintage} = ${inventoryLots.vintage} OR (${wineValuations.vintage} IS NULL AND ${inventoryLots.vintage} IS NULL))`
      )
    )
    .where(eq(inventoryLots.userId, userId))

  const totalCost = Number(stats.totalCost)
  const totalValue = Number(stats.totalValue)
  const gainLoss = totalValue - totalCost

  return {
    totalBottles: Number(stats.totalBottles),
    totalCost,
    totalValue,
    gainLoss,
    gainLossPercent: totalCost > 0
      ? Number(((gainLoss / totalCost) * 100).toFixed(1))
      : 0,
    winesWithValuation: Number(stats.winesWithValuation),
    winesNeedingReview: Number(stats.winesNeedingReview),
    winesNoMatch: Number(stats.winesNoMatch),
  }
}
