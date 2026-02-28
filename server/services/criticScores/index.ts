import { and, eq, isNull, lt, or, sql } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { inventoryLots, producers, wineCriticScores, wines } from '~/server/db/schema'
import { mapCriticNameToEnum } from './mapper'
import { REVIEW_THRESHOLD, findBestMatch, type MatchCandidate } from '../valuation/matcher'
import { searchWineSearcherCriticScoresWithMeta } from './wineSearcher'

const STALE_DAYS = 30

const saveCriticScore = async ({
  wineId,
  vintage,
  critic,
  score,
  note,
  sourceUrl,
}: {
  wineId: number
  vintage: number | null
  critic: typeof wineCriticScores.$inferInsert['critic']
  score: number
  note?: string
  sourceUrl?: string
}) => {
  const now = new Date()
  const insertData = {
    wineId,
    vintage,
    critic,
    score,
    note: note || null,
    sourceUrl: sourceUrl || null,
    source: 'wine-searcher',
    updatedAt: now,
  }

  const [savedScore] = await db
    .insert(wineCriticScores)
    .values(insertData)
    .onConflictDoUpdate({
      target: [
        wineCriticScores.wineId,
        wineCriticScores.vintage,
        wineCriticScores.critic,
      ],
      set: insertData,
    })
    .returning()

  return savedScore
}

export const fetchCriticScoresForWine = async (
  wineId: number,
  vintage: number | null,
  userId: number
): Promise<{
  success: boolean
  scores: (typeof wineCriticScores.$inferSelect)[]
  error?: string
}> => {
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
    return { success: false, scores: [], error: 'Wine not found' }
  }

  const query = `${wine.producerName} ${wine.name}`
  const wineSearcherResult = await searchWineSearcherCriticScoresWithMeta(query, vintage)

  if (!wineSearcherResult || wineSearcherResult.scores.length === 0) {
    return { success: false, scores: [], error: 'No critic scores found' }
  }

  const candidates: MatchCandidate[] = [
    {
      sourceId: wineSearcherResult.url,
      sourceName: wineSearcherResult.wineName || query,
      sourceWinery: wineSearcherResult.wineName || '',
      sourceVintage: vintage || undefined,
      sourceUrl: wineSearcherResult.url,
    },
  ]

  const match = findBestMatch(
    { name: wine.name, producerName: wine.producerName },
    vintage,
    candidates,
    'wine-searcher'
  )

  if (!match || match.confidence < REVIEW_THRESHOLD) {
    return { success: false, scores: [], error: 'Wine-Searcher result did not match wine confidently' }
  }

  const dedupedByCritic = wineSearcherResult.scores.reduce<Record<string, {
    critic: typeof wineCriticScores.$inferInsert['critic']
    score: number
    note?: string
    sourceUrl?: string
  }>>((acc, scoreItem) => {
    const critic = mapCriticNameToEnum({ criticName: scoreItem.criticName })
    const current = acc[critic]

    if (!current || scoreItem.score > current.score) {
      acc[critic] = {
        critic,
        score: scoreItem.score,
        note: scoreItem.note,
        sourceUrl: scoreItem.sourceUrl,
      }
    }

    return acc
  }, {})

  const scoresToSave = Object.values(dedupedByCritic)
  if (scoresToSave.length === 0) {
    return { success: false, scores: [], error: 'No valid critic scores to save' }
  }

  const savedScores = await Promise.all(
    scoresToSave.map(item => saveCriticScore({
      wineId,
      vintage,
      critic: item.critic,
      score: item.score,
      note: item.note,
      sourceUrl: item.sourceUrl,
    }))
  )

  return {
    success: true,
    scores: savedScores,
  }
}

export const getWinesNeedingCriticScores = async (userId: number) => {
  const staleDate = new Date()
  staleDate.setDate(staleDate.getDate() - STALE_DAYS)

  const latestScoresByWineVintage = db
    .select({
      wineId: wineCriticScores.wineId,
      vintage: wineCriticScores.vintage,
      latestUpdatedAt: sql<Date>`MAX(${wineCriticScores.updatedAt})`,
    })
    .from(wineCriticScores)
    .groupBy(wineCriticScores.wineId, wineCriticScores.vintage)
    .as('latest_critic_scores')

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
      latestScoresByWineVintage,
      and(
        eq(latestScoresByWineVintage.wineId, inventoryLots.wineId),
        sql`(${latestScoresByWineVintage.vintage} = ${inventoryLots.vintage} OR (${latestScoresByWineVintage.vintage} IS NULL AND ${inventoryLots.vintage} IS NULL))`
      )
    )
    .where(
      and(
        eq(inventoryLots.userId, userId),
        or(
          isNull(latestScoresByWineVintage.latestUpdatedAt),
          lt(latestScoresByWineVintage.latestUpdatedAt, staleDate)
        )
      )
    )

  return result
}

export const getAllCriticScores = async (userId: number) => {
  const scores = await db
    .select({
      id: wineCriticScores.id,
      wineId: wineCriticScores.wineId,
      wineName: wines.name,
      producerName: producers.name,
      vintage: wineCriticScores.vintage,
      critic: wineCriticScores.critic,
      score: wineCriticScores.score,
      note: wineCriticScores.note,
      sourceUrl: wineCriticScores.sourceUrl,
      source: wineCriticScores.source,
      updatedAt: wineCriticScores.updatedAt,
    })
    .from(wineCriticScores)
    .innerJoin(wines, eq(wineCriticScores.wineId, wines.id))
    .innerJoin(producers, eq(wines.producerId, producers.id))
    .where(eq(wines.userId, userId))

  return scores
}
