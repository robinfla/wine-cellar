import { z } from 'zod'
import { eq, and, sql } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { cellarRacks, cellarSpaces, binBottles, inventoryLots } from '~/server/db/schema'

const addSchema = z.object({
  binRow: z.number().int().min(1),
  binColumn: z.number().int().min(1),
  inventoryLotId: z.number().int(),
})

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const rackId = Number(getRouterParam(event, 'rackId'))
  if (isNaN(rackId)) throw createError({ statusCode: 400, message: 'Invalid rack ID' })

  const body = await readBody(event)
  const parsed = addSchema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Invalid data', data: parsed.error.flatten() })

  const { binRow, binColumn, inventoryLotId } = parsed.data

  // Verify rack ownership and type
  const [rack] = await db.select({
    id: cellarRacks.id,
    type: cellarRacks.type,
    columns: cellarRacks.columns,
    rows: cellarRacks.rows,
    capacity: cellarRacks.capacity,
  })
    .from(cellarRacks)
    .innerJoin(cellarSpaces, eq(cellarRacks.spaceId, cellarSpaces.id))
    .where(and(eq(cellarRacks.id, rackId), eq(cellarSpaces.userId, userId)))
  if (!rack) throw createError({ statusCode: 404, message: 'Rack not found' })
  if (rack.type !== 'bin') throw createError({ statusCode: 400, message: 'Rack is not a bin type' })

  // Verify bin coordinates
  if (binRow > rack.rows || binColumn > rack.columns) {
    throw createError({ statusCode: 400, message: 'Bin coordinates out of range' })
  }

  // Check capacity
  if (rack.capacity) {
    const [{ count }] = await db.select({
      count: sql<number>`count(*)::int`,
    }).from(binBottles).where(
      and(eq(binBottles.rackId, rackId), eq(binBottles.binRow, binRow), eq(binBottles.binColumn, binColumn))
    )
    if (count >= rack.capacity) {
      throw createError({ statusCode: 400, message: 'Bin is full' })
    }
  }

  // Verify lot ownership
  const [lot] = await db.select().from(inventoryLots)
    .where(and(eq(inventoryLots.id, inventoryLotId), eq(inventoryLots.userId, userId)))
  if (!lot) throw createError({ statusCode: 404, message: 'Inventory lot not found' })

  const [bottle] = await db.insert(binBottles).values({
    rackId,
    binRow,
    binColumn,
    inventoryLotId,
  }).returning()

  return bottle
})
