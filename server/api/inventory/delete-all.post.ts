import { eq, inArray, and, ilike, gt, or } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import {
  inventoryLots,
  tastingNotes,
  inventoryEvents,
  maturityOverrides,
  wines,
  producers,
} from '~/server/db/schema'
import { getDrinkingWindow, type MaturityStatus } from '~/server/utils/maturity'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized',
    })
  }

  const body = await readBody(event)

  if (!body?.confirm) {
    throw createError({
      statusCode: 400,
      message: 'Confirmation required. Set confirm: true to proceed.',
    })
  }

  const { search, cellarId, producerId, color, regionId, vintage, maturity } = body

  const conditions = [eq(inventoryLots.userId, userId), gt(inventoryLots.quantity, 0)]

  if (search) {
    const searchCondition = or(
      ilike(wines.name, `%${search}%`),
      ilike(producers.name, `%${search}%`),
    )
    if (searchCondition) {
      conditions.push(searchCondition)
    }
  }

  if (cellarId) {
    conditions.push(eq(inventoryLots.cellarId, cellarId))
  }

  if (producerId) {
    conditions.push(eq(wines.producerId, producerId))
  }

  if (color) {
    conditions.push(eq(wines.color, color as any))
  }

  if (regionId) {
    conditions.push(eq(producers.regionId, regionId))
  }

  if (vintage) {
    conditions.push(eq(inventoryLots.vintage, vintage))
  }

  const userLots = await db
    .select({
      id: inventoryLots.id,
      vintage: inventoryLots.vintage,
      wineColor: wines.color,
    })
    .from(inventoryLots)
    .innerJoin(wines, eq(inventoryLots.wineId, wines.id))
    .innerJoin(producers, eq(wines.producerId, producers.id))
    .where(and(...conditions))

  const maturityStatusMap: Record<string, MaturityStatus[]> = {
    ready: ['ready', 'peak', 'approaching'],
    past: ['declining', 'past'],
    young: ['too_early'],
  }

  let filteredLots = userLots
  if (maturity && maturityStatusMap[maturity]) {
    const allowedStatuses = maturityStatusMap[maturity]
    filteredLots = userLots.filter((lot) => {
      const maturityInfo = getDrinkingWindow({
        vintage: lot.vintage,
        color: lot.wineColor,
      })
      return allowedStatuses.includes(maturityInfo.status)
    })
  }

  const lotIds = filteredLots.map(({ id }) => id)

  if (lotIds.length === 0) {
    return {
      success: true,
      deleted: 0,
    }
  }

  await db.delete(tastingNotes).where(inArray(tastingNotes.lotId, lotIds))
  await db.delete(inventoryEvents).where(inArray(inventoryEvents.lotId, lotIds))
  await db.delete(maturityOverrides).where(inArray(maturityOverrides.lotId, lotIds))
  await db.delete(inventoryLots).where(inArray(inventoryLots.id, lotIds))

  return {
    success: true,
    deleted: lotIds.length,
  }
})
