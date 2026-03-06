import { eq, and, sql } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { inventoryLots, wines, producers, cellars, wineGrapes, grapes, rackSlots, cellarRacks, cellarSpaces } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const cellarId = Number(event.context.params?.cellarId)
  const query = getQuery(event)
  const wineId = query.wineId ? Number(query.wineId) : undefined
  const vintage = query.vintage ? Number(query.vintage) : undefined

  if (!wineId) {
    throw createError({ statusCode: 400, message: 'wineId query param required' })
  }

  // Find bottles for this wine that are assigned to rack slots
  const slotAssignments = await db
    .select({
      lotId: inventoryLots.id,
      binRow: rackSlots.row,
      binColumn: rackSlots.column,
      rackId: rackSlots.rackId,
      rackName: cellarRacks.name,
      spaceId: cellarSpaces.id,
      spaceName: cellarSpaces.name,
      quantity: inventoryLots.quantity,
      vintage: inventoryLots.vintage,
      wineName: wines.name,
      producerName: producers.name,
      cellarName: cellars.name,
    })
    .from(rackSlots)
    .innerJoin(inventoryLots, eq(rackSlots.inventoryLotId, inventoryLots.id))
    .innerJoin(wines, eq(inventoryLots.wineId, wines.id))
    .innerJoin(producers, eq(wines.producerId, producers.id))
    .innerJoin(cellars, eq(inventoryLots.cellarId, cellars.id))
    .innerJoin(cellarRacks, eq(rackSlots.rackId, cellarRacks.id))
    .innerJoin(cellarSpaces, eq(cellarRacks.spaceId, cellarSpaces.id))
    .where(
      and(
        eq(inventoryLots.userId, userId),
        eq(cellarSpaces.cellarId, cellarId), // Filter by cellar through spaces
        eq(inventoryLots.wineId, wineId),
        vintage ? eq(inventoryLots.vintage, vintage) : undefined, // Optional vintage filter
        sql`${inventoryLots.quantity} > 0`
      )
    )
    .limit(1)

  if (slotAssignments.length === 0) {
    throw createError({
      statusCode: 404,
      message: "This wine hasn't been assigned a rack location yet",
    })
  }

  const firstSlot = slotAssignments[0]
  const position = { row: firstSlot.binRow, column: firstSlot.binColumn }
  const rackId = firstSlot.rackId
  const spaceId = firstSlot.spaceId

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
      binRow: rackSlots.row,
      binColumn: rackSlots.column,
      color: wines.color,
      vintage: inventoryLots.vintage,
      wineName: wines.name,
      producerName: producers.name,
      regionName: sql<string>`COALESCE((SELECT r.name FROM regions r JOIN appellations a ON a.region_id = r.id WHERE a.id = ${wines.appellationId}), 'Unknown')`,
      quantity: inventoryLots.quantity,
    })
    .from(rackSlots)
    .innerJoin(inventoryLots, eq(rackSlots.inventoryLotId, inventoryLots.id))
    .innerJoin(wines, eq(inventoryLots.wineId, wines.id))
    .innerJoin(producers, eq(wines.producerId, producers.id))
    .innerJoin(cellarRacks, eq(rackSlots.rackId, cellarRacks.id))
    .innerJoin(cellarSpaces, eq(cellarRacks.spaceId, cellarSpaces.id))
    .where(
      and(
        eq(inventoryLots.userId, userId),
        eq(cellarSpaces.cellarId, cellarId), // Filter by cellar
        eq(rackSlots.rackId, rackId),
        sql`${inventoryLots.quantity} > 0`,
        sql`${rackSlots.row} >= ${rowStart}`,
        sql`${rackSlots.row} <= ${rowEnd}`,
        sql`${rackSlots.column} >= ${columnStart}`,
        sql`${rackSlots.column} <= ${columnEnd}`
      )
    )

  // Format bottles for response
  const bottlesInZoom = zoomBottles.map((bottle) => ({
    row: bottle.binRow,
    column: bottle.binColumn,
    wineId: bottle.wineId,
    lotId: bottle.lotId,
    color: bottle.color,
    wineName: bottle.wineName,
    producerName: bottle.producerName,
    vintage: bottle.vintage,
    region: bottle.regionName,
    stock: bottle.quantity,
    // Highlight if wine matches AND vintage matches (if vintage filter provided)
    highlighted: bottle.wineId === wineId && (!vintage || bottle.vintage === vintage),
  }))

  return {
    cellarId,
    cellarName: firstSlot.cellarName,
    spaceId,
    spaceName: firstSlot.spaceName,
    rackId,
    rackName: firstSlot.rackName || '10×9 Rack',
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
      wineName: `${firstSlot.producerName} ${firstSlot.wineName}`,
      grape: grapeData[0]?.grapeName || null,
      vintage: firstSlot.vintage,
    },
  }
})
