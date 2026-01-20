import { eq, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import {
  allocations,
  allocationItems,
  inventoryLots,
  producers,
  cellars,
} from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const allocationId = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)

  // Optional: cellarId to store the bottles in (defaults to first cellar)
  const cellarId = body?.cellarId ? Number(body.cellarId) : undefined

  if (isNaN(allocationId)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid allocation ID',
    })
  }

  // Get allocation with producer
  const [allocation] = await db
    .select({
      id: allocations.id,
      producerId: allocations.producerId,
      producerName: producers.name,
      year: allocations.year,
      status: allocations.status,
      claimOpensAt: allocations.claimOpensAt,
      claimClosesAt: allocations.claimClosesAt,
      notes: allocations.notes,
    })
    .from(allocations)
    .innerJoin(producers, eq(allocations.producerId, producers.id))
    .where(eq(allocations.id, allocationId))

  if (!allocation) {
    throw createError({
      statusCode: 404,
      message: 'Allocation not found',
    })
  }

  if (allocation.status === 'received') {
    throw createError({
      statusCode: 400,
      message: 'Allocation already received',
    })
  }

  // Get items with claimed quantity > 0
  const items = await db
    .select()
    .from(allocationItems)
    .where(eq(allocationItems.allocationId, allocationId))

  const claimedItems = items.filter((item) => item.quantityClaimed > 0)

  // Get default cellar if not provided
  let targetCellarId = cellarId
  if (!targetCellarId) {
    const [defaultCellar] = await db.select().from(cellars).limit(1)
    if (!defaultCellar) {
      throw createError({
        statusCode: 400,
        message: 'No cellar available to store bottles',
      })
    }
    targetCellarId = defaultCellar.id
  }

  // Create inventory lots for each claimed item
  const createdLots = []
  for (const item of claimedItems) {
    const [lot] = await db
      .insert(inventoryLots)
      .values({
        wineId: item.wineId,
        cellarId: targetCellarId,
        formatId: item.formatId,
        vintage: allocation.year,
        quantity: item.quantityClaimed,
        purchaseDate: new Date(),
        purchasePricePerBottle: item.pricePerBottle,
        purchaseCurrency: item.currency || 'EUR',
        purchaseSource: `Allocation: ${allocation.producerName}`,
      })
      .returning()

    createdLots.push(lot)

    // Update item with received info
    await db
      .update(allocationItems)
      .set({
        quantityReceived: item.quantityClaimed,
        receivedAt: new Date(),
        inventoryLotId: lot.id,
        updatedAt: new Date(),
      })
      .where(eq(allocationItems.id, item.id))
  }

  // Mark allocation as received
  await db
    .update(allocations)
    .set({
      status: 'received',
      updatedAt: new Date(),
    })
    .where(eq(allocations.id, allocationId))

  // Auto-create next year's allocation
  const nextYear = allocation.year + 1

  // Check if next year allocation already exists
  const [existingNextYear] = await db
    .select()
    .from(allocations)
    .where(and(eq(allocations.producerId, allocation.producerId), eq(allocations.year, nextYear)))

  let nextYearAllocation = null

  if (!existingNextYear) {
    // Create next year allocation
    const [newAllocation] = await db
      .insert(allocations)
      .values({
        producerId: allocation.producerId,
        year: nextYear,
        previousYearId: allocationId,
        claimOpensAt: allocation.claimOpensAt
          ? new Date(allocation.claimOpensAt.getTime() + 365 * 24 * 60 * 60 * 1000)
          : null,
        claimClosesAt: allocation.claimClosesAt
          ? new Date(allocation.claimClosesAt.getTime() + 365 * 24 * 60 * 60 * 1000)
          : null,
        status: 'upcoming',
        notes: allocation.notes,
      })
      .returning()

    nextYearAllocation = newAllocation

    // Copy items to next year (with quantities reset)
    for (const item of items) {
      await db.insert(allocationItems).values({
        allocationId: newAllocation.id,
        wineId: item.wineId,
        formatId: item.formatId,
        quantityAvailable: item.quantityAvailable,
        quantityClaimed: 0,
        pricePerBottle: item.pricePerBottle,
        currency: item.currency,
        notes: item.notes,
      })
    }
  }

  return {
    success: true,
    createdLots: createdLots.length,
    nextYearAllocation,
  }
})
