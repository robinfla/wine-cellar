import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '~/server/utils/db'
import { inventoryLots, rackSlots, cellarRacks, cellarSpaces } from '~/server/db/schema'

const assignSchema = z.object({
  rackId: z.number(),
  row: z.number().min(1),
  column: z.number().min(1),
  depthPosition: z.number().min(1).default(1),
})

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const lotId = Number(getRouterParam(event, 'lotId'))
  if (isNaN(lotId)) throw createError({ statusCode: 400, message: 'Invalid lot ID' })

  const body = await readBody(event)
  const parsed = assignSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid assignment data', data: parsed.error })
  }

  const { rackId, row, column, depthPosition } = parsed.data

  // Verify lot ownership
  const [lot] = await db
    .select()
    .from(inventoryLots)
    .where(and(eq(inventoryLots.id, lotId), eq(inventoryLots.userId, userId)))

  if (!lot) {
    throw createError({ statusCode: 404, message: 'Inventory lot not found' })
  }

  // Verify rack exists and belongs to same cellar
  const [rack] = await db
    .select({ spaceId: cellarRacks.spaceId })
    .from(cellarRacks)
    .innerJoin(cellarSpaces, eq(cellarRacks.spaceId, cellarSpaces.id))
    .where(
      and(
        eq(cellarRacks.id, rackId),
        eq(cellarSpaces.cellarId, lot.cellarId)
      )
    )

  if (!rack) {
    throw createError({ statusCode: 400, message: 'Rack not found or not in the same cellar' })
  }

  // Check if position is already occupied
  const [existingSlot] = await db
    .select()
    .from(rackSlots)
    .where(
      and(
        eq(rackSlots.rackId, rackId),
        eq(rackSlots.row, row),
        eq(rackSlots.column, column),
        eq(rackSlots.depthPosition, depthPosition)
      )
    )

  if (existingSlot && existingSlot.inventoryLotId) {
    throw createError({ statusCode: 400, message: 'This rack position is already occupied' })
  }

  // Remove any existing rack slot assignments for this lot
  await db.delete(rackSlots).where(eq(rackSlots.inventoryLotId, lotId))

  // Create new rack slot assignment
  if (existingSlot) {
    // Update existing empty slot
    await db
      .update(rackSlots)
      .set({ inventoryLotId: lotId })
      .where(eq(rackSlots.id, existingSlot.id))
  } else {
    // Create new slot
    await db.insert(rackSlots).values({
      rackId,
      row,
      column,
      depthPosition,
      inventoryLotId: lotId,
    })
  }

  return { 
    success: true,
    lotId,
    rackId,
    row,
    column,
    depthPosition,
  }
})
