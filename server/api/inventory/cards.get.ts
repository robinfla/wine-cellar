import { eq, and, sql, desc, or, ilike, gt } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import {
  inventoryLots,
  wines,
  producers,
  appellations,
  regions,
  maturityOverrides,
} from '~/server/db/schema'
import { getDrinkingWindow, type MaturityStatus } from '~/server/utils/maturity'

interface VintageData {
  vintage: number | null
  bottleCount: number
  maturityStatus: MaturityStatus
  maturityLabel: string
  maturityColor: string
  drinkFrom?: number
  drinkUntil?: number
}

interface WineCardData {
  wineId: number
  wineName: string
  producerName: string
  regionName: string | null
  appellationName: string | null
  wineColor: string
  bottleImageUrl: string | null
  vintages: VintageData[]
  totalBottles: number
}

const getMaturityColor = (status: MaturityStatus): string => {
  switch (status) {
    case 'peak':
    case 'approaching':
      return '#2e7d32' // Peak: green
    case 'past_prime':
    case 'declining':
      return '#ef6c00' // Ready/past: orange
    case 'to_age':
      return '#1565c0' // Young: blue
    default:
      return '#757575' // Unknown: gray
  }
}

const getMaturityBgColor = (status: MaturityStatus): string => {
  switch (status) {
    case 'peak':
    case 'approaching':
      return '#e8f5e9' // Peak: light green
    case 'past_prime':
    case 'declining':
      return '#fff3e0' // Ready/past: light orange
    case 'to_age':
      return '#e3f2fd' // Young: light blue
    default:
      return '#f5f5f5' // Unknown: light gray
  }
}

const getMaturityLabel = (status: MaturityStatus): string => {
  switch (status) {
    case 'peak':
      return 'Peak'
    case 'approaching':
      return 'Ready'
    case 'past_prime':
    case 'declining':
      return 'Drink Now'
    case 'to_age':
      return 'Young'
    default:
      return 'Unknown'
  }
}

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const query = getQuery(event)
  const search = query.search as string | undefined
  const cellarId = query.cellarId ? Number(query.cellarId) : undefined
  const color = query.color as string | undefined
  const maturityFilter = query.maturity as string | undefined // 'ready' for peak/approaching wines
  const lotIdsParam = query.lotIds as string | undefined
  const lotIds = lotIdsParam ? lotIdsParam.split(',').map(id => Number(id)).filter(id => !isNaN(id)) : undefined

  // Build conditions
  const conditions = [
    eq(inventoryLots.userId, userId),
    gt(inventoryLots.quantity, 0),
  ]

  if (search) {
    const searchCondition = or(
      ilike(wines.name, `%${search}%`),
      ilike(producers.name, `%${search}%`),
    )
    if (searchCondition) {
      conditions.push(searchCondition)
    }
  }

  if (cellarId) {
    conditions.push(eq(inventoryLots.cellarId, cellarId))
  }

  if (color) {
    conditions.push(eq(wines.color, color as any))
  }

  if (lotIds && lotIds.length > 0) {
    conditions.push(inArray(inventoryLots.id, lotIds))
  }

  // Fetch all lots grouped by wine + vintage
  const lotsGrouped = await db
    .select({
      wineId: wines.id,
      wineName: wines.name,
      producerName: producers.name,
      regionName: sql<string | null>`COALESCE(wr.name, pr.name)`.as('region_name'),
      appellationName: appellations.name,
      wineColor: wines.color,
      bottleImageUrl: wines.bottleImageUrl,
      vintage: inventoryLots.vintage,
      totalQuantity: sql<number>`SUM(${inventoryLots.quantity})`.as('total_quantity'),
      // Maturity data
      defaultDrinkFromYears: wines.defaultDrinkFromYears,
      defaultDrinkUntilYears: wines.defaultDrinkUntilYears,
      primaryGrape: sql<string | null>`(
        SELECT g.name 
        FROM wine_grapes wg 
        JOIN grapes g ON g.id = wg.grape_id 
        WHERE wg.wine_id = ${wines.id} 
        ORDER BY wg.percentage DESC
        LIMIT 1
      )`.as('primary_grape'),
      // For overrides, use the first lot's override if any exist
      overrideDrinkFromYear: sql<number | null>`(
        SELECT mo.drink_from_year 
        FROM maturity_overrides mo 
        WHERE mo.lot_id = ANY(array_agg(${inventoryLots.id}))
        LIMIT 1
      )`.as('override_drink_from_year'),
      overrideDrinkUntilYear: sql<number | null>`(
        SELECT mo.drink_until_year 
        FROM maturity_overrides mo 
        WHERE mo.lot_id = ANY(array_agg(${inventoryLots.id}))
        LIMIT 1
      )`.as('override_drink_until_year'),
    })
    .from(inventoryLots)
    .innerJoin(wines, eq(inventoryLots.wineId, wines.id))
    .innerJoin(producers, eq(wines.producerId, producers.id))
    .leftJoin(appellations, eq(wines.appellationId, appellations.id))
    .leftJoin(sql`${regions} as wr`, sql`wr.id = ${wines.regionId}`)
    .leftJoin(sql`${regions} as pr`, sql`pr.id = ${producers.regionId}`)
    .where(and(...conditions))
    .groupBy(
      wines.id,
      wines.name,
      wines.bottleImageUrl,
      wines.color,
      wines.defaultDrinkFromYears,
      wines.defaultDrinkUntilYears,
      producers.name,
      sql`wr.name`,
      sql`pr.name`,
      appellations.name,
      inventoryLots.vintage,
    )
    .orderBy(producers.name, wines.name, desc(inventoryLots.vintage))

  // Group by wine, collecting all vintages
  const wineMap = new Map<number, WineCardData>()

  for (const row of lotsGrouped) {
    // Calculate maturity for this vintage
    const maturityInfo = getDrinkingWindow({
      vintage: row.vintage,
      color: row.wineColor,
      appellationName: row.appellationName,
      regionName: row.regionName,
      grapeName: row.primaryGrape,
      defaultDrinkFromYears: row.defaultDrinkFromYears,
      defaultDrinkUntilYears: row.defaultDrinkUntilYears,
      overrideDrinkFromYear: row.overrideDrinkFromYear,
      overrideDrinkUntilYear: row.overrideDrinkUntilYear,
    })

    const vintageData: VintageData = {
      vintage: row.vintage,
      bottleCount: Number(row.totalQuantity),
      maturityStatus: maturityInfo.status,
      maturityLabel: getMaturityLabel(maturityInfo.status),
      maturityColor: getMaturityColor(maturityInfo.status),
      drinkFrom: maturityInfo.drinkFrom,
      drinkUntil: maturityInfo.drinkUntil,
    }

    if (wineMap.has(row.wineId)) {
      // Add vintage to existing wine
      const wine = wineMap.get(row.wineId)!
      wine.vintages.push(vintageData)
      wine.totalBottles += vintageData.bottleCount
    } else {
      // Create new wine entry
      wineMap.set(row.wineId, {
        wineId: row.wineId,
        wineName: row.wineName,
        producerName: row.producerName,
        regionName: row.regionName,
        appellationName: row.appellationName,
        wineColor: row.wineColor,
        bottleImageUrl: row.bottleImageUrl,
        vintages: [vintageData],
        totalBottles: vintageData.bottleCount,
      })
    }
  }

  let cards = Array.from(wineMap.values())

  // Apply maturity filter if requested
  if (maturityFilter) {
    cards = cards
      .map((wine) => {
        // Filter vintages to only matching maturity status
        let matchingVintages
        if (maturityFilter === 'ready') {
          matchingVintages = wine.vintages.filter(
            (v) => v.maturityStatus === 'peak' || v.maturityStatus === 'approaching'
          )
        } else {
          matchingVintages = wine.vintages.filter((v) => v.maturityStatus === maturityFilter)
        }

        if (matchingVintages.length === 0) return null

        // Recalculate total bottles for filtered vintages only
        const totalBottles = matchingVintages.reduce((sum, v) => sum + v.bottleCount, 0)

        return {
          ...wine,
          vintages: matchingVintages,
          totalBottles,
        }
      })
      .filter((wine) => wine !== null)
  }

  // Sort by total bottles descending
  cards.sort((a, b) => b.totalBottles - a.totalBottles)

  return {
    cards,
    total: cards.length,
  }
})
