import { sql, eq, gt } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import {
  inventoryLots,
  wines,
  producers,
  regions,
  cellars,
  maturityOverrides,
} from '~/server/db/schema'
import { getDrinkingWindow } from '~/server/utils/maturity'

export default defineEventHandler(async () => {
  // Get total bottles and lots
  const totals = await db
    .select({
      totalLots: sql<number>`count(*)`,
      totalBottles: sql<number>`coalesce(sum(${inventoryLots.quantity}), 0)`,
    })
    .from(inventoryLots)
    .where(gt(inventoryLots.quantity, 0))

  // Get bottles by cellar
  const byCellar = await db
    .select({
      cellarId: cellars.id,
      cellarName: cellars.name,
      bottles: sql<number>`coalesce(sum(${inventoryLots.quantity}), 0)`,
      lots: sql<number>`count(*)`,
    })
    .from(inventoryLots)
    .innerJoin(cellars, eq(inventoryLots.cellarId, cellars.id))
    .where(gt(inventoryLots.quantity, 0))
    .groupBy(cellars.id, cellars.name)

  // Get bottles by color
  const byColor = await db
    .select({
      color: wines.color,
      bottles: sql<number>`coalesce(sum(${inventoryLots.quantity}), 0)`,
    })
    .from(inventoryLots)
    .innerJoin(wines, eq(inventoryLots.wineId, wines.id))
    .where(gt(inventoryLots.quantity, 0))
    .groupBy(wines.color)

  // Get bottles by region (top 10)
  const byRegion = await db
    .select({
      regionId: regions.id,
      regionName: regions.name,
      countryCode: regions.countryCode,
      bottles: sql<number>`coalesce(sum(${inventoryLots.quantity}), 0)`,
    })
    .from(inventoryLots)
    .innerJoin(wines, eq(inventoryLots.wineId, wines.id))
    .innerJoin(producers, eq(wines.producerId, producers.id))
    .innerJoin(regions, eq(producers.regionId, regions.id))
    .where(gt(inventoryLots.quantity, 0))
    .groupBy(regions.id, regions.name, regions.countryCode)
    .orderBy(sql`sum(${inventoryLots.quantity}) desc`)
    .limit(10)

  // Get maturity breakdown
  const lotsWithMaturity = await db
    .select({
      vintage: inventoryLots.vintage,
      quantity: inventoryLots.quantity,
      color: wines.color,
      defaultDrinkFromYears: wines.defaultDrinkFromYears,
      defaultDrinkUntilYears: wines.defaultDrinkUntilYears,
      overrideDrinkFromYear: maturityOverrides.drinkFromYear,
      overrideDrinkUntilYear: maturityOverrides.drinkUntilYear,
    })
    .from(inventoryLots)
    .innerJoin(wines, eq(inventoryLots.wineId, wines.id))
    .leftJoin(maturityOverrides, eq(inventoryLots.id, maturityOverrides.lotId))
    .where(gt(inventoryLots.quantity, 0))

  const maturityBreakdown = {
    too_early: 0,
    approaching: 0,
    ready: 0,
    peak: 0,
    declining: 0,
    past: 0,
    unknown: 0,
  }

  for (const lot of lotsWithMaturity) {
    const window = getDrinkingWindow({
      vintage: lot.vintage,
      color: lot.color,
      defaultDrinkFromYears: lot.defaultDrinkFromYears,
      defaultDrinkUntilYears: lot.defaultDrinkUntilYears,
      overrideDrinkFromYear: lot.overrideDrinkFromYear,
      overrideDrinkUntilYear: lot.overrideDrinkUntilYear,
    })
    maturityBreakdown[window.status] += lot.quantity
  }

  // Calculate estimated value (from purchase prices)
  const valueResult = await db
    .select({
      totalValue: sql<number>`coalesce(sum(${inventoryLots.quantity} * ${inventoryLots.purchasePricePerBottle}), 0)`,
    })
    .from(inventoryLots)
    .where(gt(inventoryLots.quantity, 0))

  return {
    totals: {
      lots: Number(totals[0].totalLots),
      bottles: Number(totals[0].totalBottles),
      estimatedValue: Number(valueResult[0].totalValue),
    },
    byCellar,
    byColor,
    byRegion,
    maturity: maturityBreakdown,
    readyToDrink: maturityBreakdown.ready + maturityBreakdown.peak + maturityBreakdown.approaching,
  }
})
