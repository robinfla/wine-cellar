import { eq, and, sql } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { inventoryLots, wines, cellars, binBottles } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const cellarId = Number(event.context.params?.cellarId)
  const query = getQuery(event)
  const highlightWineId = query.highlightWineId ? Number(query.highlightWineId) : undefined

  // Get all bottles assigned to bins in this cellar
  const bottlesInBins = await db
    .select({
      lotId: inventoryLots.id,
      wineId: inventoryLots.wineId,
      binRow: binBottles.binRow,
      binColumn: binBottles.binColumn,
      quantity: inventoryLots.quantity,
      wineColor: wines.color,
    })
    .from(binBottles)
    .innerJoin(inventoryLots, eq(binBottles.inventoryLotId, inventoryLots.id))
    .innerJoin(wines, eq(inventoryLots.wineId, wines.id))
    .where(
      and(
        eq(inventoryLots.userId, userId),
        eq(inventoryLots.cellarId, cellarId),
        sql`${inventoryLots.quantity} > 0`
      )
    )

  // Build grid from bin positions
  const gridMap: Record<number, Record<number, any>> = {}
  
  bottlesInBins.forEach((bottle) => {
    const row = bottle.binRow
    const col = bottle.binColumn

    if (!gridMap[row]) gridMap[row] = {}
    gridMap[row][col] = {
      lotId: bottle.lotId,
      wineId: bottle.wineId,
      quantity: bottle.quantity,
      color: bottle.wineColor,
      isEmpty: false,
      highlighted: highlightWineId ? bottle.wineId === highlightWineId : false,
    }
  })

  // Convert to array format with dynamic columns (determine max column from data)
  const rows = []
  const maxRow = Math.max(...Object.keys(gridMap).map(Number), 3) // At least 3 rows
  const maxCol = Math.max(
    ...Object.values(gridMap).flatMap(row => Object.keys(row).map(Number)),
    4
  ) // At least 4 columns

  for (let rowNum = 1; rowNum <= maxRow; rowNum++) {
    const slots = []
    for (let colNum = 1; colNum <= maxCol; colNum++) {
      if (gridMap[rowNum] && gridMap[rowNum][colNum]) {
        slots.push({
          slotNumber: colNum,
          ...gridMap[rowNum][colNum],
        })
      } else {
        slots.push({
          slotNumber: colNum,
          isEmpty: true,
          highlighted: false,
        })
      }
    }
    rows.push({ rowNumber: rowNum, slots })
  }

  return {
    cellarId,
    rows,
  }
})
