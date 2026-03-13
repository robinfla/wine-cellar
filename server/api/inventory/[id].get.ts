import { eq, and, sql } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import {
  inventoryLots,
  wines,
  producers,
  appellations,
  regions,
  cellars,
  formats,
  maturityOverrides,
  vintages,
} from '~/server/db/schema'
import { getDrinkingWindow } from '~/server/utils/maturity'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const id = Number(getRouterParam(event, 'id'))
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: 'Invalid lot ID' })
  }

  const result = await db
    .select({
      id: inventoryLots.id,
      wineId: inventoryLots.wineId,
      wineName: wines.name,
      wineColor: wines.color,
      producerId: wines.producerId,
      producerName: producers.name,
      appellationId: wines.appellationId,
      appellationName: appellations.name,
      regionId: sql<number | null>`COALESCE(${wines.regionId}, ${producers.regionId})`.as('region_id'),
      wineRegionId: wines.regionId,
      regionName: sql<string | null>`COALESCE(wr.name, ${regions.name})`.as('region_name'),
      cellarId: inventoryLots.cellarId,
      cellarName: cellars.name,
      formatId: inventoryLots.formatId,
      formatName: formats.name,
      formatVolumeMl: formats.volumeMl,
      // Vintage via vintages table
      vintageId: inventoryLots.vintageId,
      vintage: vintages.year,
      ratingsCount: vintages.ratingsCount,
      ratingsAverage: vintages.ratingsAverage,
      vintageDrinkFrom: vintages.drinkFromYear,
      vintageDrinkUntil: vintages.drinkUntilYear,
      vintageDrinkPeak: vintages.drinkPeakYear,
      quantity: inventoryLots.quantity,
      purchaseDate: inventoryLots.purchaseDate,
      purchasePricePerBottle: inventoryLots.purchasePricePerBottle,
      purchaseCurrency: inventoryLots.purchaseCurrency,
      purchaseSource: inventoryLots.purchaseSource,
      binLocation: inventoryLots.binLocation,
      defaultDrinkFromYears: wines.defaultDrinkFromYears,
      defaultDrinkUntilYears: wines.defaultDrinkUntilYears,
      primaryGrape: sql<string | null>`(SELECT g.name FROM wine_grapes wg JOIN grapes g ON g.id = wg.grape_id WHERE wg.wine_id = ${wines.id} LIMIT 1)`.as('primary_grape'),
      overrideDrinkFromYear: maturityOverrides.drinkFromYear,
      overrideDrinkUntilYear: maturityOverrides.drinkUntilYear,
      notes: inventoryLots.notes,
      createdAt: inventoryLots.createdAt,
    })
    .from(inventoryLots)
    .innerJoin(wines, eq(inventoryLots.wineId, wines.id))
    .innerJoin(producers, eq(wines.producerId, producers.id))
    .innerJoin(cellars, eq(inventoryLots.cellarId, cellars.id))
    .innerJoin(formats, eq(inventoryLots.formatId, formats.id))
    .leftJoin(vintages, eq(inventoryLots.vintageId, vintages.id))
    .leftJoin(appellations, eq(wines.appellationId, appellations.id))
    .leftJoin(regions, eq(producers.regionId, regions.id))
    .leftJoin(sql`${regions} as wr`, sql`wr.id = ${wines.regionId}`)
    .leftJoin(maturityOverrides, eq(maturityOverrides.lotId, inventoryLots.id))
    .where(and(eq(inventoryLots.id, id), eq(inventoryLots.userId, userId)))
    .limit(1)

  if (!result.length) {
    throw createError({ statusCode: 404, message: 'Lot not found' })
  }

  const lot = result[0]
  
  // Priority: lot override > vintage-specific > wine default
  const maturityInfo = getDrinkingWindow({
    vintage: lot.vintage,
    color: lot.wineColor,
    appellationName: lot.appellationName,
    regionName: lot.regionName,
    grapeName: lot.primaryGrape,
    defaultDrinkFromYears: lot.defaultDrinkFromYears,
    defaultDrinkUntilYears: lot.defaultDrinkUntilYears,
    overrideDrinkFromYear: lot.overrideDrinkFromYear ?? lot.vintageDrinkFrom,
    overrideDrinkUntilYear: lot.overrideDrinkUntilYear ?? lot.vintageDrinkUntil,
  })

  return {
    ...lot,
    ratingsAverage: lot.ratingsAverage ? Number(lot.ratingsAverage) : null,
    maturity: maturityInfo,
  }
})
