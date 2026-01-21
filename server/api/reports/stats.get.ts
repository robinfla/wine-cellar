import { eq, sql, desc, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import {
  inventoryLots,
  wines,
  cellars,
  regions,
  producers,
  maturityOverrides,
  grapes,
  wineGrapes,
} from '~/server/db/schema'

const DEFAULT_DRINK_FROM_YEARS: Record<string, number> = {
  red: 3,
  white: 1,
  rose: 0,
  sparkling: 0,
  dessert: 2,
  fortified: 0,
}

const DEFAULT_DRINK_UNTIL_YEARS: Record<string, number> = {
  red: 15,
  white: 8,
  rose: 3,
  sparkling: 10,
  dessert: 30,
  fortified: 50,
}

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const totalsResult = await db
    .select({
      bottles: sql<number>`coalesce(sum(${inventoryLots.quantity}), 0)`,
      lots: sql<number>`count(*)`,
      estimatedValue: sql<number>`coalesce(sum(${inventoryLots.quantity} * ${inventoryLots.purchasePricePerBottle}), 0)`,
    })
    .from(inventoryLots)
    .where(and(eq(inventoryLots.userId, userId), sql`${inventoryLots.quantity} > 0`))

  const totals = {
    bottles: Number(totalsResult[0]?.bottles || 0),
    lots: Number(totalsResult[0]?.lots || 0),
    estimatedValue: Number(totalsResult[0]?.estimatedValue || 0),
  }

  const currentYear = new Date().getFullYear()
  const readyToDrinkResult = await db
    .select({
      bottles: sql<number>`coalesce(sum(${inventoryLots.quantity}), 0)`,
    })
    .from(inventoryLots)
    .innerJoin(wines, eq(inventoryLots.wineId, wines.id))
    .leftJoin(maturityOverrides, eq(inventoryLots.id, maturityOverrides.lotId))
    .where(
      and(
        eq(inventoryLots.userId, userId),
        sql`${inventoryLots.quantity} > 0
          AND ${inventoryLots.vintage} IS NOT NULL
          AND coalesce(
            ${maturityOverrides.drinkFromYear}::integer,
            ${inventoryLots.vintage} + coalesce(
              ${wines.defaultDrinkFromYears}::integer,
              CASE ${wines.color}::text
                WHEN 'red' THEN 3
                WHEN 'white' THEN 1
                WHEN 'rose' THEN 0
                WHEN 'sparkling' THEN 0
                WHEN 'dessert' THEN 2
                WHEN 'fortified' THEN 0
                ELSE 3
              END
            )
          ) <= ${currentYear}
          AND coalesce(
            ${maturityOverrides.drinkUntilYear}::integer,
            ${inventoryLots.vintage} + coalesce(
              ${wines.defaultDrinkUntilYears}::integer,
              CASE ${wines.color}::text
                WHEN 'red' THEN 15
                WHEN 'white' THEN 8
                WHEN 'rose' THEN 3
                WHEN 'sparkling' THEN 10
                WHEN 'dessert' THEN 30
                WHEN 'fortified' THEN 50
                ELSE 15
              END
            )
          ) >= ${currentYear}`,
      ),
    )

  const readyToDrink = Number(readyToDrinkResult[0]?.bottles || 0)

  const byColorResult = await db
    .select({
      color: wines.color,
      bottles: sql<number>`coalesce(sum(${inventoryLots.quantity}), 0)`,
    })
    .from(inventoryLots)
    .innerJoin(wines, eq(inventoryLots.wineId, wines.id))
    .where(and(eq(inventoryLots.userId, userId), sql`${inventoryLots.quantity} > 0`))
    .groupBy(wines.color)
    .orderBy(desc(sql`sum(${inventoryLots.quantity})`))

  const byColor = byColorResult.map((row) => ({
    color: row.color,
    bottles: Number(row.bottles),
  }))

  const byCellarResult = await db
    .select({
      cellarName: cellars.name,
      bottles: sql<number>`coalesce(sum(${inventoryLots.quantity}), 0)`,
    })
    .from(inventoryLots)
    .innerJoin(cellars, eq(inventoryLots.cellarId, cellars.id))
    .where(and(eq(inventoryLots.userId, userId), sql`${inventoryLots.quantity} > 0`))
    .groupBy(cellars.name)
    .orderBy(desc(sql`sum(${inventoryLots.quantity})`))

  const byCellar = byCellarResult.map((row) => ({
    cellarName: row.cellarName,
    bottles: Number(row.bottles),
  }))

  const byRegionResult = await db
    .select({
      regionName: regions.name,
      bottles: sql<number>`coalesce(sum(${inventoryLots.quantity}), 0)`,
    })
    .from(inventoryLots)
    .innerJoin(wines, eq(inventoryLots.wineId, wines.id))
    .innerJoin(producers, eq(wines.producerId, producers.id))
    .innerJoin(regions, eq(producers.regionId, regions.id))
    .where(and(eq(inventoryLots.userId, userId), sql`${inventoryLots.quantity} > 0`))
    .groupBy(regions.name)
    .orderBy(desc(sql`sum(${inventoryLots.quantity})`))

  const byRegion = byRegionResult.map((row) => ({
    regionName: row.regionName,
    bottles: Number(row.bottles),
  }))

  const byVintageResult = await db
    .select({
      vintage: inventoryLots.vintage,
      bottles: sql<number>`coalesce(sum(${inventoryLots.quantity}), 0)`,
    })
    .from(inventoryLots)
    .where(and(eq(inventoryLots.userId, userId), sql`${inventoryLots.quantity} > 0 AND ${inventoryLots.vintage} IS NOT NULL`))
    .groupBy(inventoryLots.vintage)
    .orderBy(desc(sql`sum(${inventoryLots.quantity})`))
    .limit(5)

  const byVintage = byVintageResult.map((row) => ({
    vintage: row.vintage,
    bottles: Number(row.bottles),
  }))

  const byGrapeResult = await db
    .select({
      grapeName: grapes.name,
      bottles: sql<number>`coalesce(sum(${inventoryLots.quantity}), 0)`,
    })
    .from(inventoryLots)
    .innerJoin(wines, eq(inventoryLots.wineId, wines.id))
    .innerJoin(wineGrapes, eq(wines.id, wineGrapes.wineId))
    .innerJoin(grapes, eq(wineGrapes.grapeId, grapes.id))
    .where(and(eq(inventoryLots.userId, userId), sql`${inventoryLots.quantity} > 0`))
    .groupBy(grapes.name)
    .orderBy(desc(sql`sum(${inventoryLots.quantity})`))
    .limit(5)

  const byGrape = byGrapeResult.map((row) => ({
    grapeName: row.grapeName,
    bottles: Number(row.bottles),
  }))

  return {
    totals,
    readyToDrink,
    byColor,
    byCellar,
    byRegion,
    byVintage,
    byGrape,
  }
})
