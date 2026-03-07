import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '~/server/utils/db'
import { inventoryLots, rackSlots } from '~/server/db/schema'

const transferSchema = z.object({
  targetSpaceId: z.number(),
  quantity: z.number().min(1),
})

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const lotId = Number(getRouterParam(event, 'id'))
  if (isNaN(lotId)) throw createError({ statusCode: 400, message: 'Invalid lot ID' })

  const body = await readBody(event)
  const parsed = transferSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid transfer data', data: parsed.error })
  }

  const { targetSpaceId, quantity } = parsed.data

  // Verify source lot ownership and stock
  const [sourceLot] = await db
    .select()
    .from(inventoryLots)
    .where(and(eq(inventoryLots.id, lotId), eq(inventoryLots.userId, userId)))

  if (!sourceLot) {
    throw createError({ statusCode: 404, message: 'Inventory lot not found' })
  }

  if (sourceLot.quantity < quantity) {
    throw createError({ statusCode: 400, message: 'Insufficient stock to transfer' })
  }

  // Remove bottles from current rack slots (if assigned)
  // This moves them to "unassigned" state within the same cellar
  // User will need to manually place them in the destination space's racks
  await db
    .delete(rackSlots)
    .where(eq(rackSlots.inventoryLotId, lotId))

  // Create a new lot or update existing lot (keeping same cellar, but removing rack assignment)
  // For now, we just remove from racks - bottles stay in inventory but need manual placement
  // This is a simplified version - a full implementation would handle space-to-space moves

  // Decrease source lot quantity if transferring partial amount
  if (sourceLot.quantity === quantity) {
    // If transferring all bottles, we keep the lot but it's now unassigned
    // No changes needed to inventory_lots
  } else {
    // Split the lot - keep some in original position, move some to unassigned
    const newLotQuantity = quantity
    const remainingQuantity = sourceLot.quantity - quantity

    // Update original lot quantity
    await db
      .update(inventoryLots)
      .set({ quantity: remainingQuantity })
      .where(eq(inventoryLots.id, lotId))

    // Create new lot with transferred quantity (unassigned)
    await db.insert(inventoryLots).values({
      userId,
      cellarId: sourceLot.cellarId,
      wineId: sourceLot.wineId,
      formatId: sourceLot.formatId,
      vintage: sourceLot.vintage,
      quantity: newLotQuantity,
      purchasePricePerBottle: sourceLot.purchasePricePerBottle,
      purchaseCurrency: sourceLot.purchaseCurrency,
      purchaseDate: sourceLot.purchaseDate,
      purchaseSource: sourceLot.purchaseSource,
      binLocation: null, // Unassigned - user needs to place manually
    })
  }

  return { 
    ok: true, 
    transferred: quantity,
    note: 'Bottles removed from current location. Please place them manually in the destination space.'
  }
})
