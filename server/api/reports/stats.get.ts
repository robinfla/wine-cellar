import { eq, sql, desc, isNotNull } from 'drizzle-orm'
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

export default defineEventHandler(async () => {
  // Get total bottles and lots
  const totalsResult = await db
    .select({
      bottles: sql<number>`coalesce(sum(${inventoryLots.quantity}), 0)`,
      lots: sql<number>`count(*)`,
      estimatedValue: sql<number>`coalesce(sum(${inventoryLots.quantity} * ${inventoryLots.purchasePricePerBottle}), 0)`,
    })
    .from(inventoryLots)
    .where(sql`${inventoryLots.quantity} > 0`)

  const totals = {
    bottles: Number(totalsResult[0]?.bottles || 0),
    lots: Number(totalsResult[0]?.lots || 0),
    estimatedValue: Number(totalsResult[0]?.estimatedValue || 0),
  }

  // Get ready to drink count (bottles within drinking window)
  // Uses maturity override if present, otherwise calculates from vintage + wine defaults
  const currentYear = new Date().getFullYear()
  const readyToDrinkResult = await db
    .select({
      bottles: sql<number>`coalesce(sum(${inventoryLots.quantity}), 0)`,
    })
    .from(inventoryLots)
    .innerJoin(wines, eq(inventoryLots.wineId, wines.id))
    .leftJoin(maturityOverrides, eq(inventoryLots.id, maturityOverrides.lotId))
    .where(
      sql`${inventoryLots.quantity} > 0
        AND ${inventoryLots.vintage} IS NOT NULL
        AND coalesce(
          ${maturityOverrides.drinkFromYear},
          ${inventoryLots.vintage} + ${wines.defaultDrinkFromYears}
        ) <= ${currentYear}
        AND coalesce(
          ${maturityOverrides.drinkUntilYear},
          ${inventoryLots.vintage} + ${wines.defaultDrinkUntilYears}
        ) >= ${currentYear}`
    )

  const readyToDrink = Number(readyToDrinkResult[0]?.bottles || 0)

  // Get breakdown by wine color
  const byColorResult = await db
    .select({
      color: wines.color,
      bottles: sql<number>`coalesce(sum(${inventoryLots.quantity}), 0)`,
    })
    .from(inventoryLots)
    .innerJoin(wines, eq(inventoryLots.wineId, wines.id))
    .where(sql`${inventoryLots.quantity} > 0`)
    .groupBy(wines.color)
    .orderBy(desc(sql`sum(${inventoryLots.quantity})`))

  const byColor = byColorResult.map((row) => ({
    color: row.color,
    bottles: Number(row.bottles),
  }))

  // Get breakdown by cellar
  const byCellarResult = await db
    .select({
      cellarName: cellars.name,
      bottles: sql<number>`coalesce(sum(${inventoryLots.quantity}), 0)`,
    })
    .from(inventoryLots)
    .innerJoin(cellars, eq(inventoryLots.cellarId, cellars.id))
    .where(sql`${inventoryLots.quantity} > 0`)
    .groupBy(cellars.name)
    .orderBy(desc(sql`sum(${inventoryLots.quantity})`))

  const byCellar = byCellarResult.map((row) => ({
    cellarName: row.cellarName,
    bottles: Number(row.bottles),
  }))

  // Get breakdown by region (through producers)
  const byRegionResult = await db
    .select({
      regionName: regions.name,
      bottles: sql<number>`coalesce(sum(${inventoryLots.quantity}), 0)`,
    })
    .from(inventoryLots)
    .innerJoin(wines, eq(inventoryLots.wineId, wines.id))
    .innerJoin(producers, eq(wines.producerId, producers.id))
    .innerJoin(regions, eq(producers.regionId, regions.id))
    .where(sql`${inventoryLots.quantity} > 0`)
    .groupBy(regions.name)
    .orderBy(desc(sql`sum(${inventoryLots.quantity})`))

  const byRegion = byRegionResult.map((row) => ({
    regionName: row.regionName,
    bottles: Number(row.bottles),
  }))

  // Get breakdown by vintage (top 5, excluding NV)
  const byVintageResult = await db
    .select({
      vintage: inventoryLots.vintage,
      bottles: sql<number>`coalesce(sum(${inventoryLots.quantity}), 0)`,
    })
    .from(inventoryLots)
    .where(sql`${inventoryLots.quantity} > 0 AND ${inventoryLots.vintage} IS NOT NULL`)
    .groupBy(inventoryLots.vintage)
    .orderBy(desc(sql`sum(${inventoryLots.quantity})`))
    .limit(5)

  const byVintage = byVintageResult.map((row) => ({
    vintage: row.vintage,
    bottles: Number(row.bottles),
  }))

  // Get breakdown by grape variety (top 5)
  const byGrapeResult = await db
    .select({
      grapeName: grapes.name,
      bottles: sql<number>`coalesce(sum(${inventoryLots.quantity}), 0)`,
    })
    .from(inventoryLots)
    .innerJoin(wines, eq(inventoryLots.wineId, wines.id))
    .innerJoin(wineGrapes, eq(wines.id, wineGrapes.wineId))
    .innerJoin(grapes, eq(wineGrapes.grapeId, grapes.id))
    .where(sql`${inventoryLots.quantity} > 0`)
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
