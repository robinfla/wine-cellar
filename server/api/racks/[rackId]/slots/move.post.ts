import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { cellarRacks, cellarSpaces, rackSlots } from '~/server/db/schema'

const moveSchema = z.object({
  fromRow: z.number().int().min(1),
  fromColumn: z.number().int().min(1),
  fromDepth: z.number().int().min(1).optional().default(1),
  toRackId: z.number().int().optional(), // if moving to different rack
  toRow: z.number().int().min(1),
  toColumn: z.number().int().min(1),
  toDepth: z.number().int().min(1).optional().default(1),
})

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const rackId = Number(getRouterParam(event, 'rackId'))
  if (isNaN(rackId)) throw createError({ statusCode: 400, message: 'Invalid rack ID' })

  const body = await readBody(event)
  const parsed = moveSchema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Invalid data', data: parsed.error.flatten() })

  const { fromRow, fromColumn, fromDepth, toRackId, toRow, toColumn, toDepth } = parsed.data
  const targetRackId = toRackId ?? rackId

  // Verify source rack ownership
  const [srcRack] = await db.select({ id: cellarRacks.id })
    .from(cellarRacks)
    .innerJoin(cellarSpaces, eq(cellarRacks.spaceId, cellarSpaces.id))
    .where(and(eq(cellarRacks.id, rackId), eq(cellarSpaces.userId, userId)))
  if (!srcRack) throw createError({ statusCode: 404, message: 'Source rack not found' })

  // If moving to different rack, verify ownership
  if (toRackId && toRackId !== rackId) {
    const [dstRack] = await db.select({ id: cellarRacks.id })
      .from(cellarRacks)
      .innerJoin(cellarSpaces, eq(cellarRacks.spaceId, cellarSpaces.id))
      .where(and(eq(cellarRacks.id, toRackId), eq(cellarSpaces.userId, userId)))
    if (!dstRack) throw createError({ statusCode: 404, message: 'Target rack not found' })
  }

  // Get source slot
  const [sourceSlot] = await db.select().from(rackSlots)
    .where(and(
      eq(rackSlots.rackId, rackId),
      eq(rackSlots.row, fromRow),
      eq(rackSlots.column, fromColumn),
      eq(rackSlots.depthPosition, fromDepth),
    ))
  if (!sourceSlot || !sourceSlot.inventoryLotId) {
    throw createError({ statusCode: 400, message: 'Source slot is empty' })
  }

  // Check target slot is empty
  const [targetSlot] = await db.select().from(rackSlots)
    .where(and(
      eq(rackSlots.rackId, targetRackId),
      eq(rackSlots.row, toRow),
      eq(rackSlots.column, toColumn),
      eq(rackSlots.depthPosition, toDepth),
    ))
  if (!targetSlot) throw createError({ statusCode: 404, message: 'Target slot not found' })
  if (targetSlot.inventoryLotId) throw createError({ statusCode: 400, message: 'Target slot is occupied' })

  // Move: clear source, fill target
  await db.update(rackSlots).set({ inventoryLotId: null }).where(eq(rackSlots.id, sourceSlot.id))
  await db.update(rackSlots).set({ inventoryLotId: sourceSlot.inventoryLotId }).where(eq(rackSlots.id, targetSlot.id))

  return { from: { rackId, row: fromRow, column: fromColumn }, to: { rackId: targetRackId, row: toRow, column: toColumn } }
})
