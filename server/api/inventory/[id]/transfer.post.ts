import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { inventoryLots, inventoryEvents, cellars } from '~/server/db/schema'

const transferSchema = z.object({
  quantity: z.number().int().min(1),
  toCellarId: z.number().int().positive(),
  eventDate: z.string().datetime().optional(),
  notes: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid lot ID',
    })
  }

  const parsed = transferSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid transfer data',
      data: parsed.error.flatten(),
    })
  }

  // Get current lot
  const [lot] = await db
    .select()
    .from(inventoryLots)
    .where(eq(inventoryLots.id, id))

  if (!lot) {
    throw createError({
      statusCode: 404,
      message: 'Inventory lot not found',
    })
  }

  if (lot.quantity < parsed.data.quantity) {
    throw createError({
      statusCode: 400,
      message: `Not enough bottles. Available: ${lot.quantity}`,
    })
  }

  if (lot.cellarId === parsed.data.toCellarId) {
    throw createError({
      statusCode: 400,
      message: 'Cannot transfer to the same cellar',
    })
  }

  // Verify target cellar exists
  const [targetCellar] = await db
    .select()
    .from(cellars)
    .where(eq(cellars.id, parsed.data.toCellarId))

  if (!targetCellar) {
    throw createError({
      statusCode: 404,
      message: 'Target cellar not found',
    })
  }

  const eventDate = parsed.data.eventDate ? new Date(parsed.data.eventDate) : new Date()

  // Update source lot quantity
  const newSourceQuantity = lot.quantity - parsed.data.quantity
  await db
    .update(inventoryLots)
    .set({
      quantity: newSourceQuantity,
      updatedAt: new Date(),
    })
    .where(eq(inventoryLots.id, id))

  // Create transfer out event
  await db.insert(inventoryEvents).values({
    lotId: id,
    eventType: 'transfer',
    quantityChange: -parsed.data.quantity,
    toCellarId: parsed.data.toCellarId,
    eventDate,
    notes: parsed.data.notes,
  })

  // Check if a lot already exists in target cellar with same wine/vintage/format
  const [existingLot] = await db
    .select()
    .from(inventoryLots)
    .where(and(
      eq(inventoryLots.wineId, lot.wineId),
      eq(inventoryLots.cellarId, parsed.data.toCellarId),
      eq(inventoryLots.formatId, lot.formatId),
      lot.vintage ? eq(inventoryLots.vintage, lot.vintage) : undefined,
    ))

  let targetLotId: number

  if (existingLot) {
    // Update existing lot
    await db
      .update(inventoryLots)
      .set({
        quantity: existingLot.quantity + parsed.data.quantity,
        updatedAt: new Date(),
      })
      .where(eq(inventoryLots.id, existingLot.id))
    targetLotId = existingLot.id
  } else {
    // Create new lot in target cellar
    const [newLot] = await db
      .insert(inventoryLots)
      .values({
        wineId: lot.wineId,
        cellarId: parsed.data.toCellarId,
        formatId: lot.formatId,
        vintage: lot.vintage,
        quantity: parsed.data.quantity,
        purchaseDate: lot.purchaseDate,
        purchasePricePerBottle: lot.purchasePricePerBottle,
        purchaseCurrency: lot.purchaseCurrency,
        purchaseSource: lot.purchaseSource,
        notes: lot.notes,
      })
      .returning()
    targetLotId = newLot.id
  }

  // Create transfer in event for target lot
  await db.insert(inventoryEvents).values({
    lotId: targetLotId,
    eventType: 'transfer',
    quantityChange: parsed.data.quantity,
    eventDate,
    notes: `Transferred from ${lot.cellarId}`,
  })

  return {
    success: true,
    sourceNewQuantity: newSourceQuantity,
    targetLotId,
  }
})
