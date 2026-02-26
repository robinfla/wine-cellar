import { eq, and, sql, desc, or, ilike } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import {
  inventoryLots,
  wines,
  producers,
  appellations,
  regions,
  wineValuations,
  maturityOverrides,
} from '~/server/db/schema'
import { getDrinkingWindow, type MaturityStatus } from '~/server/utils/maturity'

interface WineCardData {
  wineId: number
  wineName: string
  producerName: string
  regionName: string | null
  appellationName: string | null
  wineColor: string
  bottleImageUrl: string | null
  vintage: number | null
  totalQuantity: number
  avgPurchasePrice: number
  purchaseCurrency: string | null
  currentValue: number | null
  valueChangePercent: number | null
  maturity: {
    status: MaturityStatus
    message: string
    drinkFrom?: number
    drinkUntil?: number
  }
}

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const query = getQuery(event)
  const search = query.search as string | undefined

  // Group lots by wine + vintage, collecting data needed for maturity calc
  const grouped = await db
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
      avgPurchasePrice: sql<number>`ROUND(AVG(CAST(${inventoryLots.purchasePricePerBottle} AS NUMERIC)), 2)`.as('avg_purchase_price'),
      purchaseCurrency: sql<string>`(array_agg(${inventoryLots.purchaseCurrency}))[1]`.as('purchase_currency'),
      // Maturity data
      defaultDrinkFromYears: wines.defaultDrinkFromYears,
      defaultDrinkUntilYears: wines.defaultDrinkUntilYears,
      primaryGrape: sql<string | null>`(
        SELECT g.name 
        FROM wine_grapes wg 
        JOIN grapes g ON g.id = wg.grape_id 
        WHERE wg.wine_id = ${wines.id} 
        LIMIT 1
      )`.as('primary_grape'),
      // For overrides, we'll use the first lot's override if any exist
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
    .where(
      and(
        eq(inventoryLots.userId, userId),
        sql`${inventoryLots.quantity} > 0`,
        search ? or(
          ilike(wines.name, `%${search}%`),
          ilike(producers.name, `%${search}%`)
        ) : undefined
      )
    )
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
      inventoryLots.vintage
    )
    .orderBy(desc(sql`SUM(${inventoryLots.quantity})`))

  // Fetch valuations for all wine+vintage pairs
  const valuationsMap = new Map<string, number>()
  if (grouped.length > 0) {
    const wineVintageKeys = grouped
      .filter(g => g.vintage != null)
      .map(g => ({ wineId: g.wineId, vintage: g.vintage! }))
    
    if (wineVintageKeys.length > 0) {
      const valuations = await db
        .select({
          wineId: wineValuations.wineId,
          vintage: wineValuations.vintage,
          priceEstimate: wineValuations.priceEstimate,
        })
        .from(wineValuations)
        .where(
          and(
            sql`(wine_id, vintage) IN (${sql.raw(
              wineVintageKeys.map(k => `(${k.wineId}, ${k.vintage})`).join(', ')
            )})`,
            sql`status IN ('matched', 'confirmed', 'manual')`
          )
        )

      valuations.forEach(v => {
        if (v.priceEstimate) {
          const key = `${v.wineId}-${v.vintage}`
          valuationsMap.set(key, Number(v.priceEstimate))
        }
      })
    }
  }

  // Build card data with maturity calculation
  const cards: WineCardData[] = grouped.map((row) => {
    // Calculate maturity
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

    // Get current value
    const valueKey = `${row.wineId}-${row.vintage}`
    const currentValue = valuationsMap.get(valueKey) || null
    
    // Calculate value change %
    let valueChangePercent: number | null = null
    if (currentValue && row.avgPurchasePrice > 0) {
      valueChangePercent = Math.round(
        ((currentValue - row.avgPurchasePrice) / row.avgPurchasePrice) * 100
      )
    }

    return {
      wineId: row.wineId,
      wineName: row.wineName,
      producerName: row.producerName,
      regionName: row.regionName,
      appellationName: row.appellationName,
      wineColor: row.wineColor,
      bottleImageUrl: row.bottleImageUrl,
      vintage: row.vintage,
      totalQuantity: Number(row.totalQuantity),
      avgPurchasePrice: row.avgPurchasePrice,
      purchaseCurrency: row.purchaseCurrency,
      currentValue,
      valueChangePercent,
      maturity: {
        status: maturityInfo.status,
        message: maturityInfo.message,
        drinkFrom: maturityInfo.drinkFrom,
        drinkUntil: maturityInfo.drinkUntil,
      },
    }
  })

  // Sort by maturity urgency (peak first, then approaching, etc.)
  const statusOrder: Record<MaturityStatus, number> = {
    declining: 0,
    past_prime: 1,
    peak: 2,
    approaching: 3,
    to_age: 4,
    unknown: 5,
  }
  cards.sort((a, b) => {
    const aOrder = statusOrder[a.maturity.status] ?? 6
    const bOrder = statusOrder[b.maturity.status] ?? 6
    if (aOrder !== bOrder) return aOrder - bOrder
    // Secondary sort by value change (highest first)
    if (a.valueChangePercent != null && b.valueChangePercent != null) {
      return b.valueChangePercent - a.valueChangePercent
    }
    return 0
  })

  return {
    cards,
    total: cards.length,
  }
})
