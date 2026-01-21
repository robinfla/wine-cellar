import { db } from '~/server/utils/db'
import { cellars } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const body = await readBody(event)

  if (!body.name?.trim()) {
    throw createError({ statusCode: 400, message: 'Cellar name is required' })
  }

  const [cellar] = await db
    .insert(cellars)
    .values({
      userId,
      name: body.name.trim(),
      countryCode: body.countryCode || 'FR',
      isVirtual: body.isVirtual || false,
      notes: body.notes?.trim() || null,
    })
    .returning()

  return cellar
})
