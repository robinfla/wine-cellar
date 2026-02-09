import { z } from 'zod'
import { db } from '~/server/utils/db'
import { wishlistItems } from '~/server/db/schema'

const createWishlistItemSchema = z.object({
  itemType: z.enum(['wine', 'producer']),
  name: z.string().min(1).max(500),
  wineId: z.number().int().positive().optional().nullable(),
  producerId: z.number().int().positive().optional().nullable(),
  regionId: z.number().int().positive().optional().nullable(),
  vintage: z.number().int().min(1900).max(2100).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  winesOfInterest: z.string().max(2000).optional().nullable(),
  priceTarget: z.string().optional().nullable(),
  priceCurrency: z.enum(['EUR', 'USD', 'GBP', 'ZAR', 'CHF']).optional(),
  url: z.string().url().max(2000).optional().nullable(),
})

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const body = await readBody(event)

  const parsed = createWishlistItemSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid wishlist item data',
      data: parsed.error.flatten(),
    })
  }

  const [item] = await db
    .insert(wishlistItems)
    .values({
      ...parsed.data,
      userId,
    })
    .returning()

  return item
})
