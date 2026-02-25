import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { cellarRacks, cellarSpaces, rackSlots } from '~/server/db/schema'

const moveSchema = z.object({
  targetRackId: z.number().int().positive(),
  row: z.number().int().min(1),
  column: z.number().int().min(1),
  depthPosition: z.number().int().min(1).optional(),
})

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const slotId = Number(event.context.params?.slotId)
  if (!slotId) {
    throw createError({ statusCode: 400, message: 'Invalid slot ID' })
  }

  // Verify source slot ownership
  const sourceSlot = await db
    .select({
      id: rackSlots.id,
      inventoryLotId: rackSlots.inventoryLotId,
    })
    .from(rackSlots)
    .innerJoin(cellarRacks, eq(cellarRacks.id, rackSlots.rackId))
    .innerJoin(cellarSpaces, eq(cellarSpaces.id, cellarRacks.spaceId))
    .where(and(eq(rackSlots.id, slotId), eq(cellarSpaces.userId, userId)))
    .limit(1)
  if (!sourceSlot.length) {
    throw createError({ statusCode: 404, message: 'Slot not found' })
  }

  if (!sourceSlot[0].inventoryLotId) {
    throw createError({ statusCode: 400, message: 'Slot is empty' })
  }

  const body = await readBody(event)
  const parsed = moveSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid input', data: parsed.error.flatten() })
  }

  const { targetRackId, row, column, depthPosition = 1 } = parsed.data

  // Verify target rack ownership and dimensions
  const targetRack = await db
    .select({ id: cellarRacks.id, columns: cellarRacks.columns, rows: cellarRacks.rows, depth: cellarRacks.depth })
    .from(cellarRacks)
    .innerJoin(cellarSpaces, eq(cellarSpaces.id, cellarRacks.spaceId))
    .where(and(eq(cellarRacks.id, targetRackId), eq(cellarSpaces.userId, userId)))
    .limit(1)
  if (!targetRack.length) {
    throw createError({ statusCode: 404, message: 'Target rack not found' })
  }

  const tr = targetRack[0]
  if (row > tr.rows || column > tr.columns || depthPosition > tr.depth) {
    throw createError({ statusCode: 400, message: 'Position exceeds target rack dimensions' })
  }

  return await db.transaction(async (tx) => {
    // Create new slot
    const [newSlot] = await tx.insert(rackSlots).values({
      rackId: targetRackId,
      row,
      column,
      depthPosition,
      inventoryLotId: sourceSlot[0].inventoryLotId,
    }).onConflictDoUpdate({
      target: [rackSlots.rackId, rackSlots.row, rackSlots.column, rackSlots.depthPosition],
      set: { inventoryLotId: sourceSlot[0].inventoryLotId },
    }).returning()

    // Delete old slot
    await tx.delete(rackSlots).where(eq(rackSlots.id, slotId))

    return newSlot
  })
})
