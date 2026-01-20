import { eq } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import {
  allocations,
  allocationItems,
  producers,
  regions,
  wines,
  formats,
} from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid allocation ID',
    })
  }

  // Get allocation with producer info
  const [allocation] = await db
    .select({
      id: allocations.id,
      producerId: allocations.producerId,
      producerName: producers.name,
      regionName: regions.name,
      year: allocations.year,
      previousYearId: allocations.previousYearId,
      claimOpensAt: allocations.claimOpensAt,
      claimClosesAt: allocations.claimClosesAt,
      status: allocations.status,
      notes: allocations.notes,
      createdAt: allocations.createdAt,
      updatedAt: allocations.updatedAt,
    })
    .from(allocations)
    .innerJoin(producers, eq(allocations.producerId, producers.id))
    .leftJoin(regions, eq(producers.regionId, regions.id))
    .where(eq(allocations.id, id))

  if (!allocation) {
    throw createError({
      statusCode: 404,
      message: 'Allocation not found',
    })
  }

  // Get items for this allocation
  const items = await db
    .select({
      id: allocationItems.id,
      wineId: allocationItems.wineId,
      wineName: wines.name,
      wineColor: wines.color,
      formatId: allocationItems.formatId,
      formatName: formats.name,
      formatVolumeMl: formats.volumeMl,
      quantityAvailable: allocationItems.quantityAvailable,
      quantityClaimed: allocationItems.quantityClaimed,
      pricePerBottle: allocationItems.pricePerBottle,
      currency: allocationItems.currency,
      quantityReceived: allocationItems.quantityReceived,
      receivedAt: allocationItems.receivedAt,
      inventoryLotId: allocationItems.inventoryLotId,
      notes: allocationItems.notes,
    })
    .from(allocationItems)
    .innerJoin(wines, eq(allocationItems.wineId, wines.id))
    .innerJoin(formats, eq(allocationItems.formatId, formats.id))
    .where(eq(allocationItems.allocationId, id))

  // Get linked years (previous and next)
  let previousYear = null
  let nextYear = null

  if (allocation.previousYearId) {
    const [prev] = await db
      .select({ id: allocations.id, year: allocations.year, status: allocations.status })
      .from(allocations)
      .where(eq(allocations.id, allocation.previousYearId))
    previousYear = prev || null
  }

  // Find next year (allocation that has this one as previousYearId)
  const [next] = await db
    .select({ id: allocations.id, year: allocations.year, status: allocations.status })
    .from(allocations)
    .where(eq(allocations.previousYearId, id))
  nextYear = next || null

  // Calculate totals
  const totalBottles = items.reduce((sum, item) => sum + item.quantityClaimed, 0)
  const totalValue = items.reduce(
    (sum, item) => sum + item.quantityClaimed * Number(item.pricePerBottle || 0),
    0
  )

  return {
    ...allocation,
    items,
    previousYear,
    nextYear,
    totalBottles,
    totalValue,
  }
})
