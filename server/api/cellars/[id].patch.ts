import { eq, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { cellars } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const id = Number(getRouterParam(event, 'id'))
  if (isNaN(id)) {
    throw createError({ statusCode: 400, message: 'Invalid cellar ID' })
  }

  const body = await readBody(event)

  const [existing] = await db
    .select({ id: cellars.id })
    .from(cellars)
    .where(and(eq(cellars.id, id), eq(cellars.userId, userId)))

  if (!existing) {
    throw createError({ statusCode: 404, message: 'Cellar not found' })
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  }

  if (body.name !== undefined) updateData.name = body.name.trim()
  if (body.countryCode !== undefined) updateData.countryCode = body.countryCode
  if (body.isVirtual !== undefined) updateData.isVirtual = body.isVirtual
  if (body.notes !== undefined) updateData.notes = body.notes?.trim() || null
  if (body.rows !== undefined) updateData.rows = body.rows
  if (body.columns !== undefined) updateData.columns = body.columns
  if (body.layoutConfig !== undefined) updateData.layoutConfig = body.layoutConfig

  const [updated] = await db
    .update(cellars)
    .set(updateData)
    .where(eq(cellars.id, id))
    .returning()

  return updated
})
