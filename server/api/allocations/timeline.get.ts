import { eq, and, sql, gte, lt, inArray } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { getLatestFxRates, convertToBase } from '~/server/utils/currency'
import {
  allocations,
  allocationItems,
  producers,
  regions,
} from '~/server/db/schema'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

interface TimelineAllocation {
  id: number
  producerName: string
  regionName: string | null
  status: string
  totalBottles: number
  totalValueEur: number
}

interface TimelineMonth {
  month: number
  monthName: string
  allocations: TimelineAllocation[]
  totals: {
    totalBottles: number
    totalValueEur: number
  }
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const year = query.year ? Number(query.year) : new Date().getFullYear()

  // Define date range for the year
  const yearStart = new Date(year, 0, 1) // Jan 1
  const yearEnd = new Date(year + 1, 0, 1) // Jan 1 of next year

  // Get FX rates for conversion to EUR
  const fxRates = await getLatestFxRates('EUR')

  // Get allocations with claimOpensAt in the selected year
  const allocationsResult = await db
    .select({
      id: allocations.id,
      producerId: allocations.producerId,
      producerName: producers.name,
      regionName: regions.name,
      status: allocations.status,
      claimOpensAt: allocations.claimOpensAt,
    })
    .from(allocations)
    .innerJoin(producers, eq(allocations.producerId, producers.id))
    .leftJoin(regions, eq(producers.regionId, regions.id))
    .where(
      and(
        sql`${allocations.claimOpensAt} IS NOT NULL`,
        gte(allocations.claimOpensAt, yearStart),
        lt(allocations.claimOpensAt, yearEnd)
      )
    )

  // Get allocation IDs for item queries
  const allocationIds = allocationsResult.map((a) => a.id)

  // Get items for all these allocations
  let itemsByAllocation: Record<number, { totalBottles: number; totalValueEur: number }> = {}

  if (allocationIds.length > 0) {
    const itemsResult = await db
      .select({
        allocationId: allocationItems.allocationId,
        quantityClaimed: allocationItems.quantityClaimed,
        pricePerBottle: allocationItems.pricePerBottle,
        currency: allocationItems.currency,
      })
      .from(allocationItems)
      .where(inArray(allocationItems.allocationId, allocationIds))

    // Calculate totals per allocation with EUR conversion
    for (const item of itemsResult) {
      if (!itemsByAllocation[item.allocationId]) {
        itemsByAllocation[item.allocationId] = { totalBottles: 0, totalValueEur: 0 }
      }

      const quantity = item.quantityClaimed || 0
      const price = item.pricePerBottle ? Number(item.pricePerBottle) : 0
      const valueOriginal = quantity * price
      const valueEur = convertToBase(valueOriginal, item.currency, fxRates)

      itemsByAllocation[item.allocationId].totalBottles += quantity
      itemsByAllocation[item.allocationId].totalValueEur += valueEur
    }
  }

  // Group allocations by month
  const allocationsByMonth: Record<number, TimelineAllocation[]> = {}

  for (const allocation of allocationsResult) {
    const month = new Date(allocation.claimOpensAt!).getMonth() + 1 // 1-12

    if (!allocationsByMonth[month]) {
      allocationsByMonth[month] = []
    }

    const items = itemsByAllocation[allocation.id] || { totalBottles: 0, totalValueEur: 0 }

    allocationsByMonth[month].push({
      id: allocation.id,
      producerName: allocation.producerName,
      regionName: allocation.regionName,
      status: allocation.status,
      totalBottles: items.totalBottles,
      totalValueEur: Math.round(items.totalValueEur * 100) / 100,
    })
  }

  // Build month cards for all 12 months
  const months: TimelineMonth[] = []

  for (let m = 1; m <= 12; m++) {
    const monthAllocations = allocationsByMonth[m] || []
    const totals = monthAllocations.reduce(
      (acc, a) => ({
        totalBottles: acc.totalBottles + a.totalBottles,
        totalValueEur: acc.totalValueEur + a.totalValueEur,
      }),
      { totalBottles: 0, totalValueEur: 0 }
    )

    months.push({
      month: m,
      monthName: MONTH_NAMES[m - 1],
      allocations: monthAllocations,
      totals: {
        totalBottles: totals.totalBottles,
        totalValueEur: Math.round(totals.totalValueEur * 100) / 100,
      },
    })
  }

  // Calculate year totals
  const yearTotals = months.reduce(
    (acc, m) => ({
      totalBottles: acc.totalBottles + m.totals.totalBottles,
      totalValueEur: acc.totalValueEur + m.totals.totalValueEur,
      allocationCount: acc.allocationCount + m.allocations.length,
    }),
    { totalBottles: 0, totalValueEur: 0, allocationCount: 0 }
  )

  yearTotals.totalValueEur = Math.round(yearTotals.totalValueEur * 100) / 100

  // Get available years for year selector
  const yearsResult = await db
    .select({
      year: sql<number>`EXTRACT(YEAR FROM ${allocations.claimOpensAt})::int`.as('year'),
    })
    .from(allocations)
    .where(sql`${allocations.claimOpensAt} IS NOT NULL`)
    .groupBy(sql`EXTRACT(YEAR FROM ${allocations.claimOpensAt})`)
    .orderBy(sql`EXTRACT(YEAR FROM ${allocations.claimOpensAt}) DESC`)

  const availableYears = yearsResult.map((r) => r.year).filter((y) => y !== null)

  // Add current year if not in the list
  if (!availableYears.includes(year)) {
    availableYears.push(year)
    availableYears.sort((a, b) => b - a)
  }

  return {
    year,
    months,
    yearTotals,
    availableYears,
  }
})
