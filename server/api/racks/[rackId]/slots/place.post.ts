import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { cellarRacks, cellarSpaces, rackSlots, inventoryLots } from '~/server/db/schema'

const placeSchema = z.object({
  row: z.number().int().min(1),
  column: z.number().int().min(1),
  depthPosition: z.number().int().min(1).optional().default(1),
  inventoryLotId: z.number().int(),
})

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const rackId = Number(getRouterParam(event, 'rackId'))
  if (isNaN(rackId)) throw createError({ statusCode: 400, message: 'Invalid rack ID' })

  const body = await readBody(event)
  const parsed = placeSchema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Invalid data', data: parsed.error.flatten() })

  const { row, column, depthPosition, inventoryLotId } = parsed.data

  // Verify rack ownership
  const [rack] = await db.select({ id: cellarRacks.id, spaceId: cellarRacks.spaceId })
    .from(cellarRacks)
    .innerJoin(cellarSpaces, eq(cellarRacks.spaceId, cellarSpaces.id))
    .where(and(eq(cellarRacks.id, rackId), eq(cellarSpaces.userId, userId)))
  if (!rack) throw createError({ statusCode: 404, message: 'Rack not found' })

  // Verify lot ownership
  const [lot] = await db.select().from(inventoryLots)
    .where(and(eq(inventoryLots.id, inventoryLotId), eq(inventoryLots.userId, userId)))
  if (!lot) throw createError({ statusCode: 404, message: 'Inventory lot not found' })

  // Update the slot
  const [updated] = await db.update(rackSlots)
    .set({ inventoryLotId })
    .where(and(
      eq(rackSlots.rackId, rackId),
      eq(rackSlots.row, row),
      eq(rackSlots.column, column),
      eq(rackSlots.depthPosition, depthPosition),
    ))
    .returning()

  if (!updated) throw createError({ statusCode: 404, message: 'Slot not found' })

  return updated
})
