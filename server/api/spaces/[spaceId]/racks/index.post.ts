import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { cellarSpaces, cellarRacks, rackSlots } from '~/server/db/schema'

const createSchema = z.object({
  wallId: z.number().int().optional(),
  columns: z.number().int().min(1).max(50),
  rows: z.number().int().min(1).max(50),
  depth: z.number().int().min(1).max(10).optional().default(1),
})

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const spaceId = Number(getRouterParam(event, 'spaceId'))
  if (isNaN(spaceId)) throw createError({ statusCode: 400, message: 'Invalid space ID' })

  const [space] = await db.select().from(cellarSpaces)
    .where(and(eq(cellarSpaces.id, spaceId), eq(cellarSpaces.userId, userId)))
  if (!space) throw createError({ statusCode: 404, message: 'Space not found' })

  const body = await readBody(event)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Invalid data', data: parsed.error.flatten() })

  const { wallId, columns, rows, depth } = parsed.data

  // Create rack
  const [rack] = await db.insert(cellarRacks).values({
    spaceId,
    wallId: wallId ?? null,
    columns,
    rows,
    depth,
  }).returning()

  // Pre-create all slots (empty)
  const slotValues: Array<{ rackId: number; row: number; column: number; depthPosition: number }> = []
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= columns; c++) {
      for (let d = 1; d <= depth; d++) {
        slotValues.push({ rackId: rack.id, row: r, column: c, depthPosition: d })
      }
    }
  }

  if (slotValues.length > 0) {
    await db.insert(rackSlots).values(slotValues)
  }

  return { ...rack, totalSlots: slotValues.length }
})
