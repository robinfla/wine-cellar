import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { inventoryLots, inventoryEvents, vintages } from '~/server/db/schema'

const createInventoryLotSchema = z.object({
  wineId: z.number().int().positive(),
  cellarId: z.number().int().positive(),
  formatId: z.number().int().positive(),
  vintage: z.number().int().min(1900).max(2100).optional().nullable(),
  quantity: z.number().int().min(1),
  purchaseDate: z.string().datetime().optional().nullable(),
  purchasePricePerBottle: z.string().optional().nullable(), // Decimal as string
  purchaseCurrency: z.enum(['EUR', 'USD', 'GBP', 'ZAR', 'CHF']).optional(),
  purchaseSource: z.string().optional().nullable(),
  binLocation: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const body = await readBody(event)

  const parsed = createInventoryLotSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid inventory data',
      data: parsed.error.flatten(),
    })
  }

  const { purchaseDate, vintage, ...data } = parsed.data

  // Find or create vintage record
  let vintageId: number | null = null
  if (data.wineId) {
    // Check if vintage exists
    const [existingVintage] = await db
      .select({ id: vintages.id })
      .from(vintages)
      .where(and(
        eq(vintages.wineId, data.wineId),
        vintage !== null && vintage !== undefined
          ? eq(vintages.year, vintage)
          : eq(vintages.year, null as any), // NV wines
      ))

    if (existingVintage) {
      vintageId = existingVintage.id
    } else {
      // Create new vintage record
      const [newVintage] = await db
        .insert(vintages)
        .values({
          wineId: data.wineId,
          year: vintage ?? null,
        })
        .returning({ id: vintages.id })
      vintageId = newVintage.id
    }
  }

  const [lot] = await db
    .insert(inventoryLots)
    .values({
      ...data,
      userId,
      vintageId,
      vintage: vintage ?? null, // Keep legacy field in sync for now
      purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
    })
    .returning()

  // Create purchase event
  await db.insert(inventoryEvents).values({
    lotId: lot.id,
    eventType: 'purchase',
    quantityChange: data.quantity,
    eventDate: purchaseDate ? new Date(purchaseDate) : new Date(),
    notes: data.purchaseSource ? `Purchased from ${data.purchaseSource}` : null,
  })

  return lot
})
