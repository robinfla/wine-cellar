import { eq, and, sql, desc, inArray } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import {
  allocations,
  allocationItems,
  producers,
  regions,
} from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const query = getQuery(event)
  const status = query.status as string | undefined
  const year = query.year ? Number(query.year) : undefined
  const producerId = query.producerId ? Number(query.producerId) : undefined
  const limit = query.limit ? Number(query.limit) : 50
  const offset = query.offset ? Number(query.offset) : 0

  const conditions = [eq(allocations.userId, userId)]

  if (status) {
    conditions.push(eq(allocations.status, status as any))
  }

  if (year) {
    conditions.push(eq(allocations.year, year))
  }

  if (producerId) {
    conditions.push(eq(allocations.producerId, producerId))
  }

  // Get allocations with producer info
  const result = await db
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
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(allocations.year), producers.name)
    .limit(limit)
    .offset(offset)

  // Get items summary for each allocation
  const allocationIds = result.map((a) => a.id)

  const itemsSummary: Record<number, { itemCount: number; totalBottles: number; totalsByCurrency: { currency: string; value: number }[] }> = {}

  if (allocationIds.length > 0) {
    // Get basic counts
    const countsResult = await db
      .select({
        allocationId: allocationItems.allocationId,
        itemCount: sql<number>`count(*)`,
        totalBottles: sql<number>`coalesce(sum(${allocationItems.quantityClaimed}), 0)`,
      })
      .from(allocationItems)
      .where(inArray(allocationItems.allocationId, allocationIds))
      .groupBy(allocationItems.allocationId)

    // Get totals by currency
    const currencyResult = await db
      .select({
        allocationId: allocationItems.allocationId,
        currency: sql<string>`coalesce(${allocationItems.currency}, 'EUR')`.as('currency'),
        totalValue: sql<number>`coalesce(sum(${allocationItems.quantityClaimed} * ${allocationItems.pricePerBottle}), 0)`.as('total_value'),
      })
      .from(allocationItems)
      .where(inArray(allocationItems.allocationId, allocationIds))
      .groupBy(allocationItems.allocationId, sql`coalesce(${allocationItems.currency}, 'EUR')`)

    // Build summary map from counts
    for (const count of countsResult) {
      itemsSummary[count.allocationId] = {
        itemCount: Number(count.itemCount),
        totalBottles: Number(count.totalBottles),
        totalsByCurrency: [],
      }
    }

    // Add currency totals
    for (const curr of currencyResult) {
      if (!itemsSummary[curr.allocationId]) {
        itemsSummary[curr.allocationId] = {
          itemCount: 0,
          totalBottles: 0,
          totalsByCurrency: [],
        }
      }
      itemsSummary[curr.allocationId].totalsByCurrency.push({
        currency: curr.currency,
        value: Number(curr.totalValue),
      })
    }
  }

  // Combine allocation data with items summary
  const allocationsWithSummary = result.map((allocation) => ({
    ...allocation,
    itemCount: itemsSummary[allocation.id]?.itemCount || 0,
    totalBottles: itemsSummary[allocation.id]?.totalBottles || 0,
    totalsByCurrency: itemsSummary[allocation.id]?.totalsByCurrency || [],
  }))

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(allocations)
    .where(conditions.length > 0 ? and(...conditions) : undefined)

  const total = Number(countResult[0].count)

  // Get summary stats for the filtered view
  const statsResult = await db
    .select({
      totalAllocations: sql<number>`count(distinct ${allocations.id})`,
    })
    .from(allocations)
    .where(conditions.length > 0 ? and(...conditions) : undefined)

  return {
    allocations: allocationsWithSummary,
    total,
    totalAllocations: Number(statsResult[0].totalAllocations),
    limit,
    offset,
  }
})
