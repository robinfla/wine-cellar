import { eq, and, sql } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { inventoryLots, wines, producers, cellars, wineGrapes, grapes, binBottles, cellarRacks, cellarSpaces } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const cellarId = Number(event.context.params?.cellarId)
  const query = getQuery(event)
  const wineId = query.wineId ? Number(query.wineId) : undefined

  if (!wineId) {
    throw createError({ statusCode: 400, message: 'wineId query param required' })
  }

  // Find bottles for this wine that are assigned to bins
  const binAssignments = await db
    .select({
      lotId: inventoryLots.id,
      binRow: binBottles.binRow,
      binColumn: binBottles.binColumn,
      rackId: binBottles.rackId,
      rackName: cellarRacks.name,
      quantity: inventoryLots.quantity,
      vintage: inventoryLots.vintage,
      wineName: wines.name,
      producerName: producers.name,
      cellarName: cellars.name,
    })
    .from(binBottles)
    .innerJoin(inventoryLots, eq(binBottles.inventoryLotId, inventoryLots.id))
    .innerJoin(wines, eq(inventoryLots.wineId, wines.id))
    .innerJoin(producers, eq(wines.producerId, producers.id))
    .innerJoin(cellars, eq(inventoryLots.cellarId, cellars.id))
    .innerJoin(cellarRacks, eq(binBottles.rackId, cellarRacks.id))
    .innerJoin(cellarSpaces, eq(cellarRacks.spaceId, cellarSpaces.id))
    .where(
      and(
        eq(inventoryLots.userId, userId),
        eq(cellarSpaces.cellarId, cellarId), // Filter by cellar through spaces
        eq(inventoryLots.wineId, wineId),
        sql`${inventoryLots.quantity} > 0`
      )
    )
    .limit(1)

  if (binAssignments.length === 0) {
    throw createError({
      statusCode: 404,
      message: "This wine hasn't been assigned a bin location yet",
    })
  }

  const firstBin = binAssignments[0]
  const position = { row: firstBin.binRow, column: firstBin.binColumn }
  const rackId = firstBin.rackId

  // Get grape info for filter context
  const grapeData = await db
    .select({
      grapeName: grapes.name,
    })
    .from(wineGrapes)
    .innerJoin(grapes, eq(wineGrapes.grapeId, grapes.id))
    .where(eq(wineGrapes.wineId, wineId))
    .limit(1)

  // Get wine color for highlighting
  const wineData = await db
    .select({ color: wines.color })
    .from(wines)
    .where(eq(wines.id, wineId))
    .limit(1)

  const wineColor = wineData[0]?.color || 'red'

  // Calculate zoom context (3 rows × 5 columns centered on target)
  const targetRow = position.row
  const targetCol = position.column
  
  // Calculate zoom window (±1 row, ±2 columns)
  const rowStart = Math.max(1, targetRow - 1)
  const rowEnd = rowStart + 2
  const columnStart = Math.max(1, targetCol - 2)
  const columnEnd = columnStart + 4

  // Get all bottles in the same rack within zoom window
  const zoomBottles = await db
    .select({
      lotId: inventoryLots.id,
      wineId: inventoryLots.wineId,
      binRow: binBottles.binRow,
      binColumn: binBottles.binColumn,
      color: wines.color,
    })
    .from(binBottles)
    .innerJoin(inventoryLots, eq(binBottles.inventoryLotId, inventoryLots.id))
    .innerJoin(wines, eq(inventoryLots.wineId, wines.id))
    .innerJoin(cellarRacks, eq(binBottles.rackId, cellarRacks.id))
    .innerJoin(cellarSpaces, eq(cellarRacks.spaceId, cellarSpaces.id))
    .where(
      and(
        eq(inventoryLots.userId, userId),
        eq(cellarSpaces.cellarId, cellarId), // Filter by cellar
        eq(binBottles.rackId, rackId),
        sql`${inventoryLots.quantity} > 0`,
        sql`${binBottles.binRow} >= ${rowStart}`,
        sql`${binBottles.binRow} <= ${rowEnd}`,
        sql`${binBottles.binColumn} >= ${columnStart}`,
        sql`${binBottles.binColumn} <= ${columnEnd}`
      )
    )

  // Format bottles for response
  const bottlesInZoom = zoomBottles.map((bottle) => ({
    row: bottle.binRow,
    column: bottle.binColumn,
    wineId: bottle.wineId,
    color: bottle.color,
    highlighted: bottle.wineId === wineId,
  }))

  return {
    cellarId,
    cellarName: firstBin.cellarName,
    rackName: firstBin.rackName || '10×9 Rack',
    position,
    wineColor,
    zoomContext: {
      rowStart,
      rowEnd,
      columnStart,
      columnEnd,
      bottles: bottlesInZoom,
    },
    filters: {
      wineName: `${firstBin.producerName} ${firstBin.wineName}`,
      grape: grapeData[0]?.grapeName || null,
      vintage: firstBin.vintage,
    },
  }
})
