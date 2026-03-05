import { eq, and, sql } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { inventoryLots, wines, producers, cellars, wineGrapes, grapes } from '~/server/db/schema'

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

  // Find the lot in this cellar
  const lots = await db
    .select({
      lotId: inventoryLots.id,
      binLocation: inventoryLots.binLocation,
      quantity: inventoryLots.quantity,
      vintage: inventoryLots.vintage,
      wineName: wines.name,
      producerName: producers.name,
      cellarName: cellars.name,
    })
    .from(inventoryLots)
    .innerJoin(wines, eq(inventoryLots.wineId, wines.id))
    .innerJoin(producers, eq(wines.producerId, producers.id))
    .innerJoin(cellars, eq(inventoryLots.cellarId, cellars.id))
    .where(
      and(
        eq(inventoryLots.userId, userId),
        eq(inventoryLots.cellarId, cellarId),
        eq(inventoryLots.wineId, wineId)
      )
    )
    .limit(10)

  if (lots.length === 0) {
    throw createError({
      statusCode: 404,
      message: "This wine hasn't been assigned a location yet",
    })
  }

  // Get grape info for filter context
  const grapeData = await db
    .select({
      grapeName: grapes.name,
    })
    .from(wineGrapes)
    .innerJoin(grapes, eq(wineGrapes.grapeId, grapes.id))
    .where(eq(wineGrapes.wineId, wineId))
    .limit(1)

  const firstLot = lots[0]

  // Parse binLocation as "row-column" format
  let position = { row: 1, column: 1 }
  if (firstLot.binLocation) {
    const match = firstLot.binLocation.match(/(\d+)-(\d+)/)
    if (match) {
      position = { row: Number(match[1]), column: Number(match[2]) }
    }
  }

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

  // Get all bottles in zoom window
  const zoomBottles = await db
    .select({
      lotId: inventoryLots.id,
      wineId: inventoryLots.wineId,
      binLocation: inventoryLots.binLocation,
      color: wines.color,
    })
    .from(inventoryLots)
    .innerJoin(wines, eq(inventoryLots.wineId, wines.id))
    .where(
      and(
        eq(inventoryLots.userId, userId),
        eq(inventoryLots.cellarId, cellarId),
        sql`${inventoryLots.quantity} > 0`
      )
    )

  // Parse bottles and filter to zoom window
  const bottlesInZoom = zoomBottles
    .map((bottle) => {
      const match = bottle.binLocation?.match(/(\d+)-(\d+)/)
      if (!match) return null
      
      const row = Number(match[1])
      const col = Number(match[2])
      
      if (row >= rowStart && row <= rowEnd && col >= columnStart && col <= columnEnd) {
        return {
          row,
          column: col,
          wineId: bottle.wineId,
          color: bottle.color,
          highlighted: bottle.wineId === wineId,
        }
      }
      return null
    })
    .filter((b) => b !== null)

  return {
    cellarId,
    cellarName: firstLot.cellarName,
    rackName: '10×9 Rack', // Default name, can be customized later
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
      wineName: `${firstLot.producerName} ${firstLot.wineName}`,
      grape: grapeData[0]?.grapeName || null,
      vintage: firstLot.vintage,
    },
  }
})
