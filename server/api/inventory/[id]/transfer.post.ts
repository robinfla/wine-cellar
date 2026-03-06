import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '~/server/utils/db'
import { inventoryLots } from '~/server/db/schema'

const transferSchema = z.object({
  targetCellarId: z.number(),
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

  const { targetCellarId, quantity } = parsed.data

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

  // Check if a lot already exists in target cellar for the same wine+vintage
  const existingTargetLots = await db
    .select()
    .from(inventoryLots)
    .where(
      and(
        eq(inventoryLots.userId, userId),
        eq(inventoryLots.cellarId, targetCellarId),
        eq(inventoryLots.wineId, sourceLot.wineId)
      )
    )

  // Find exact match including vintage (handling null)
  const existingTargetLot = existingTargetLots.find(
    lot => lot.vintage === sourceLot.vintage
  )

  if (existingTargetLot) {
    // Add to existing lot
    await db
      .update(inventoryLots)
      .set({ quantity: existingTargetLot.quantity + quantity })
      .where(eq(inventoryLots.id, existingTargetLot.id))
  } else {
    // Create new lot in target cellar
    await db.insert(inventoryLots).values({
      userId,
      cellarId: targetCellarId,
      wineId: sourceLot.wineId,
      formatId: sourceLot.formatId,
      vintage: sourceLot.vintage,
      quantity,
      purchasePricePerBottle: sourceLot.purchasePricePerBottle,
      purchaseCurrency: sourceLot.purchaseCurrency,
      purchaseDate: sourceLot.purchaseDate,
      purchaseSource: sourceLot.purchaseSource,
    })
  }

  // Decrease source lot quantity
  if (sourceLot.quantity === quantity) {
    // Remove lot entirely if transferring all bottles
    await db.delete(inventoryLots).where(eq(inventoryLots.id, lotId))
  } else {
    await db
      .update(inventoryLots)
      .set({ quantity: sourceLot.quantity - quantity })
      .where(eq(inventoryLots.id, lotId))
  }

  return { ok: true, transferred: quantity }
})
