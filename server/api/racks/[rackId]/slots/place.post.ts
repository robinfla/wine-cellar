import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { cellarRacks, cellarSpaces, rackSlots, inventoryLots } from '~/server/db/schema'

const placeSchema = z.object({
  row: z.number().int().min(1),
  column: z.number().int().min(1),
  depthPosition: z.number().int().min(1).optional(),
  inventoryLotId: z.number().int().positive(),
})

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const rackId = Number(event.context.params?.rackId)
  if (!rackId) {
    throw createError({ statusCode: 400, message: 'Invalid rack ID' })
  }

  // Verify rack ownership
  const rack = await db
    .select({ rackId: cellarRacks.id, columns: cellarRacks.columns, rows: cellarRacks.rows, depth: cellarRacks.depth })
    .from(cellarRacks)
    .innerJoin(cellarSpaces, eq(cellarSpaces.id, cellarRacks.spaceId))
    .where(and(eq(cellarRacks.id, rackId), eq(cellarSpaces.userId, userId)))
    .limit(1)
  if (!rack.length) {
    throw createError({ statusCode: 404, message: 'Rack not found' })
  }

  const body = await readBody(event)
  const parsed = placeSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid input', data: parsed.error.flatten() })
  }

  const { row, column, depthPosition = 1, inventoryLotId } = parsed.data
  const r = rack[0]

  if (row > r.rows || column > r.columns || depthPosition > r.depth) {
    throw createError({ statusCode: 400, message: 'Position exceeds rack dimensions' })
  }

  // Verify lot ownership
  const lot = await db.select({ id: inventoryLots.id }).from(inventoryLots)
    .where(and(eq(inventoryLots.id, inventoryLotId), eq(inventoryLots.userId, userId)))
    .limit(1)
  if (!lot.length) {
    throw createError({ statusCode: 404, message: 'Inventory lot not found' })
  }

  const [slot] = await db.insert(rackSlots).values({
    rackId,
    row,
    column,
    depthPosition,
    inventoryLotId,
  }).onConflictDoUpdate({
    target: [rackSlots.rackId, rackSlots.row, rackSlots.column, rackSlots.depthPosition],
    set: { inventoryLotId },
  }).returning()

  return slot
})
