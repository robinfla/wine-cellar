import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { inventoryLots, maturityOverrides } from '~/server/db/schema'

const updateSchema = z.object({
  drinkFromYear: z.number().int().min(1900).max(2100).nullable(),
  drinkUntilYear: z.number().int().min(1900).max(2100).nullable(),
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

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid maturity data',
      data: parsed.error.flatten(),
    })
  }

  // Verify lot exists
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

  // Check if override already exists
  const [existing] = await db
    .select()
    .from(maturityOverrides)
    .where(eq(maturityOverrides.lotId, id))

  if (existing) {
    // Update existing override
    const [updated] = await db
      .update(maturityOverrides)
      .set({
        drinkFromYear: parsed.data.drinkFromYear,
        drinkUntilYear: parsed.data.drinkUntilYear,
        updatedAt: new Date(),
      })
      .where(eq(maturityOverrides.lotId, id))
      .returning()

    return updated
  } else {
    // Create new override
    const [created] = await db
      .insert(maturityOverrides)
      .values({
        lotId: id,
        drinkFromYear: parsed.data.drinkFromYear,
        drinkUntilYear: parsed.data.drinkUntilYear,
      })
      .returning()

    return created
  }
})
