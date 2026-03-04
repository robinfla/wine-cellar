import { eq, and, sql } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { inventoryLots, wines, cellars } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const cellarId = Number(event.context.params?.cellarId)
  const query = getQuery(event)
  const highlightWineId = query.highlightWineId ? Number(query.highlightWineId) : undefined

  // Get all lots in this cellar
  const lots = await db
    .select({
      lotId: inventoryLots.id,
      wineId: inventoryLots.wineId,
      binLocation: inventoryLots.binLocation,
      quantity: inventoryLots.quantity,
      wineColor: wines.color,
    })
    .from(inventoryLots)
    .innerJoin(wines, eq(inventoryLots.wineId, wines.id))
    .where(
      and(eq(inventoryLots.userId, userId), eq(inventoryLots.cellarId, cellarId), sql`${inventoryLots.quantity} > 0`)
    )

  // Build grid from binLocation (format: "row-slot")
  const gridMap: Record<number, Record<number, any>> = {}
  
  lots.forEach((lot) => {
    if (!lot.binLocation) return

    const match = lot.binLocation.match(/(\d+)-(\d+)/)
    if (!match) return

    const row = Number(match[1])
    const slot = Number(match[2])

    if (!gridMap[row]) gridMap[row] = {}
    gridMap[row][slot] = {
      lotId: lot.lotId,
      wineId: lot.wineId,
      quantity: lot.quantity,
      color: lot.wineColor,
      isEmpty: false,
      highlighted: highlightWineId ? lot.wineId === highlightWineId : false,
    }
  })

  // Convert to array format with 4 slots per row
  const rows = []
  const maxRow = Math.max(...Object.keys(gridMap).map(Number), 3) // At least 3 rows

  for (let rowNum = 1; rowNum <= maxRow; rowNum++) {
    const slots = []
    for (let slotNum = 1; slotNum <= 4; slotNum++) {
      if (gridMap[rowNum] && gridMap[rowNum][slotNum]) {
        slots.push({
          slotNumber: slotNum,
          ...gridMap[rowNum][slotNum],
        })
      } else {
        slots.push({
          slotNumber: slotNum,
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
