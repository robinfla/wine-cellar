import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { users } from '~/server/db/schema'

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  preferredCurrency: z.enum(['EUR', 'USD', 'GBP', 'ZAR', 'CHF']).optional(),
})

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized',
    })
  }

  const body = await readBody(event)

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid update data',
      data: parsed.error.flatten(),
    })
  }

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  }

  if (parsed.data.name !== undefined) {
    updates.name = parsed.data.name
  }

  if (parsed.data.preferredCurrency !== undefined) {
    updates.preferredCurrency = parsed.data.preferredCurrency
  }

  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, userId))
    .returning()

  return {
    id: updated.id,
    email: updated.email,
    name: updated.name,
    preferredCurrency: updated.preferredCurrency,
  }
})
