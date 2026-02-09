import { eq, and, sql, desc } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import {
  inventoryEvents,
  inventoryLots,
  wines,
  producers,
  cellars,
} from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const query = getQuery(event)
  const eventType = query.eventType as string | undefined
  const limit = query.limit ? Number(query.limit) : 50
  const offset = query.offset ? Number(query.offset) : 0

  const conditions = [eq(inventoryLots.userId, userId)]

  if (eventType) {
    conditions.push(eq(inventoryEvents.eventType, eventType as any))
  }

  const result = await db
    .select({
      id: inventoryEvents.id,
      lotId: inventoryEvents.lotId,
      eventType: inventoryEvents.eventType,
      quantityChange: inventoryEvents.quantityChange,
      eventDate: inventoryEvents.eventDate,
      notes: inventoryEvents.notes,
      rating: inventoryEvents.rating,
      tastingNotes: inventoryEvents.tastingNotes,
      createdAt: inventoryEvents.createdAt,
      wineName: wines.name,
      wineColor: wines.color,
      producerName: producers.name,
      vintage: inventoryLots.vintage,
      cellarName: cellars.name,
    })
    .from(inventoryEvents)
    .innerJoin(inventoryLots, eq(inventoryEvents.lotId, inventoryLots.id))
    .innerJoin(wines, eq(inventoryLots.wineId, wines.id))
    .innerJoin(producers, eq(wines.producerId, producers.id))
    .innerJoin(cellars, eq(inventoryLots.cellarId, cellars.id))
    .where(and(...conditions))
    .orderBy(desc(inventoryEvents.eventDate), desc(inventoryEvents.id))
    .limit(limit)
    .offset(offset)

  const countResult = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(inventoryEvents)
    .innerJoin(inventoryLots, eq(inventoryEvents.lotId, inventoryLots.id))
    .where(and(...conditions))

  const total = Number(countResult[0].count)

  return {
    events: result,
    total,
    limit,
    offset,
  }
})
