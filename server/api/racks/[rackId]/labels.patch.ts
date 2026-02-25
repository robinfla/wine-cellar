import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { cellarRacks, cellarSpaces } from '~/server/db/schema'

const labelsSchema = z.object({
  binLabels: z.record(z.string(), z.string()).optional(),
  name: z.string().max(100).nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const rackId = Number(getRouterParam(event, 'rackId'))
  if (isNaN(rackId)) throw createError({ statusCode: 400, message: 'Invalid rack ID' })

  const body = await readBody(event)
  const parsed = labelsSchema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Invalid data', data: parsed.error.flatten() })

  // Verify ownership
  const [rack] = await db.select({ id: cellarRacks.id })
    .from(cellarRacks)
    .innerJoin(cellarSpaces, eq(cellarRacks.spaceId, cellarSpaces.id))
    .where(and(eq(cellarRacks.id, rackId), eq(cellarSpaces.userId, userId)))
  if (!rack) throw createError({ statusCode: 404, message: 'Rack not found' })

  const updates: Record<string, any> = {}
  if (parsed.data.binLabels !== undefined) updates.binLabels = JSON.stringify(parsed.data.binLabels)
  if (parsed.data.name !== undefined) updates.name = parsed.data.name

  const [updated] = await db.update(cellarRacks)
    .set(updates)
    .where(eq(cellarRacks.id, rackId))
    .returning()

  return updated
})
