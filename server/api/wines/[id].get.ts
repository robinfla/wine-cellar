import { eq, and, desc, sql, inArray } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import {
  wines,
  producers,
  regions,
  appellations,
  inventoryLots,
  wineValuations,
  inventoryEvents,
  wineGrapes,
  grapes,
  formats,
  cellars,
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

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid wine ID',
    })
  }

  // Get wine with producer, region, appellation (including new enrichment fields)
  const [wine] = await db
    .select({
      id: wines.id,
      name: wines.name,
      color: wines.color,
      notes: wines.notes,
      bottleImageUrl: wines.bottleImageUrl,
      defaultDrinkFromYears: wines.defaultDrinkFromYears,
      defaultDrinkUntilYears: wines.defaultDrinkUntilYears,
      tasteProfile: wines.tasteProfile,
      bodyWeight: wines.bodyWeight,
      tanninLevel: wines.tanninLevel,
      sweetnessLevel: wines.sweetnessLevel,
      acidityLevel: wines.acidityLevel,
      servingTempCelsius: wines.servingTempCelsius,
      decantMinutes: wines.decantMinutes,
      glassType: wines.glassType,
      foodPairings: wines.foodPairings,
      // New enrichment fields
      styleDescription: wines.styleDescription,
      isNatural: wines.isNatural,
      isOrganic: wines.isOrganic,
      isBiodynamic: wines.isBiodynamic,
      dataSource: wines.dataSource,
      producer: {
        id: producers.id,
        name: producers.name,
        website: producers.website,
        // Producer enrichment
        foundedYear: producers.foundedYear,
        description: producers.description,
        isOrganic: producers.isOrganic,
        isBiodynamic: producers.isBiodynamic,
        isNatural: producers.isNatural,
      },
      region: {
        id: regions.id,
        name: regions.name,
        countryCode: regions.countryCode,
        description: regions.description,
      },
      appellation: {
        id: appellations.id,
        name: appellations.name,
        level: appellations.level,
      },
    })
    .from(wines)
    .leftJoin(producers, eq(wines.producerId, producers.id))
    .leftJoin(regions, eq(wines.regionId, regions.id))
    .leftJoin(appellations, eq(wines.appellationId, appellations.id))
    .where(and(eq(wines.id, id), eq(wines.userId, userId)))

  if (!wine) {
    throw createError({
      statusCode: 404,
      message: 'Wine not found',
    })
  }

  // Get grapes (with enrichment)
  const grapeResults = await db
    .select({
      id: grapes.id,
      name: grapes.name,
      color: grapes.color,
      description: grapes.description,
      percentage: wineGrapes.percentage,
    })
    .from(wineGrapes)
    .innerJoin(grapes, eq(wineGrapes.grapeId, grapes.id))
    .where(eq(wineGrapes.wineId, id))
    .orderBy(desc(wineGrapes.percentage))

  // Get inventory lots with vintage data via vintages table
  const lotsData = await db
    .select({
      id: inventoryLots.id,
      vintageId: inventoryLots.vintageId,
      vintage: vintages.year,
      quantity: inventoryLots.quantity,
      binLocation: inventoryLots.binLocation,
      purchaseDate: inventoryLots.purchaseDate,
      purchasePricePerBottle: inventoryLots.purchasePricePerBottle,
      purchaseCurrency: inventoryLots.purchaseCurrency,
      // Vintage enrichment data
      ratingsCount: vintages.ratingsCount,
      ratingsAverage: vintages.ratingsAverage,
      vintageDrinkFrom: vintages.drinkFromYear,
      vintageDrinkUntil: vintages.drinkUntilYear,
      vintageDrinkPeak: vintages.drinkPeakYear,
      format: {
        id: formats.id,
        name: formats.name,
        volumeMl: formats.volumeMl,
      },
      cellar: {
        id: cellars.id,
        name: cellars.name,
      },
    })
    .from(inventoryLots)
    .leftJoin(vintages, eq(inventoryLots.vintageId, vintages.id))
    .leftJoin(formats, eq(inventoryLots.formatId, formats.id))
    .leftJoin(cellars, eq(inventoryLots.cellarId, cellars.id))
    .where(and(eq(inventoryLots.wineId, id), eq(inventoryLots.userId, userId)))
    .orderBy(desc(vintages.year))

  // Get valuations (current prices) for each vintage
  const valuations = await db
    .select({
      vintage: wineValuations.vintage,
      priceEstimate: wineValuations.priceEstimate,
      priceLow: wineValuations.priceLow,
      priceHigh: wineValuations.priceHigh,
      source: wineValuations.source,
      fetchedAt: wineValuations.fetchedAt,
    })
    .from(wineValuations)
    .where(eq(wineValuations.wineId, id))
    .orderBy(desc(wineValuations.vintage))

  // Get consumption history
  const history = await db
    .select({
      id: inventoryEvents.id,
      eventType: inventoryEvents.eventType,
      quantityChange: inventoryEvents.quantityChange,
      eventDate: inventoryEvents.eventDate,
      rating: inventoryEvents.rating,
      tastingNotes: inventoryEvents.tastingNotes,
      notes: inventoryEvents.notes,
      lotId: inventoryEvents.lotId,
      vintage: vintages.year,
      cellarName: cellars.name,
    })
    .from(inventoryEvents)
    .innerJoin(inventoryLots, eq(inventoryEvents.lotId, inventoryLots.id))
    .leftJoin(vintages, eq(inventoryLots.vintageId, vintages.id))
    .leftJoin(cellars, eq(inventoryLots.cellarId, cellars.id))
    .where(and(eq(inventoryLots.wineId, id), eq(inventoryLots.userId, userId)))
    .orderBy(desc(inventoryEvents.eventDate))
    .limit(50)

  // Get maturity overrides for all lots
  const lotIds = lotsData.map(v => v.id)
  const overrides = lotIds.length > 0 ? await db
    .select({
      lotId: maturityOverrides.lotId,
      drinkFromYear: maturityOverrides.drinkFromYear,
      drinkUntilYear: maturityOverrides.drinkUntilYear,
    })
    .from(maturityOverrides)
    .where(inArray(maturityOverrides.lotId, lotIds))
    : []

  const overridesMap = new Map(overrides.map(o => [o.lotId, o]))

  // Calculate maturity for each lot (using vintage-specific data when available)
  const vintagesWithMaturity = lotsData.map((v) => {
    const override = overridesMap.get(v.id)
    
    // Priority: lot override > vintage-specific > wine default
    const maturity = getDrinkingWindow({
      vintage: v.vintage,
      color: wine.color,
      appellationName: wine.appellation?.name,
      regionName: wine.region?.name,
      defaultDrinkFromYears: wine.defaultDrinkFromYears,
      defaultDrinkUntilYears: wine.defaultDrinkUntilYears,
      overrideDrinkFromYear: override?.drinkFromYear ?? v.vintageDrinkFrom,
      overrideDrinkUntilYear: override?.drinkUntilYear ?? v.vintageDrinkUntil,
    })

    return {
      id: v.id,
      vintageId: v.vintageId,
      vintage: v.vintage,
      quantity: v.quantity,
      binLocation: v.binLocation,
      purchaseDate: v.purchaseDate,
      purchasePricePerBottle: v.purchasePricePerBottle,
      purchaseCurrency: v.purchaseCurrency,
      format: v.format,
      cellar: v.cellar,
      // Vintage enrichment
      ratingsCount: v.ratingsCount,
      ratingsAverage: v.ratingsAverage ? Number(v.ratingsAverage) : null,
      drinkPeakYear: v.vintageDrinkPeak,
      valuation: valuations.find((val) => val.vintage === v.vintage) || null,
      maturity: {
        status: maturity.status,
        message: maturity.message,
        drinkFrom: maturity.drinkFrom,
        drinkUntil: maturity.drinkUntil,
      },
    }
  })

  // Parse JSON fields
  const tasteProfile = wine.tasteProfile ? JSON.parse(wine.tasteProfile) : null
  const foodPairings = wine.foodPairings ? JSON.parse(wine.foodPairings) : null

  return {
    ...wine,
    tasteProfile,
    foodPairings,
    grapes: grapeResults,
    vintages: vintagesWithMaturity,
    history,
  }
})
