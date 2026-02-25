import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { cellars, cellarSpaces, spaceWalls } from '~/server/db/schema'

const createSpaceSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['room', 'fridge']),
  walls: z.array(z.enum(['left', 'right', 'back', 'front', 'floor'])).optional(),
})

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const cellarId = Number(event.context.params?.cellarId)
  if (!cellarId) {
    throw createError({ statusCode: 400, message: 'Invalid cellar ID' })
  }

  // Verify cellar ownership
  const cellar = await db.select({ id: cellars.id }).from(cellars)
    .where(and(eq(cellars.id, cellarId), eq(cellars.userId, userId)))
    .limit(1)
  if (!cellar.length) {
    throw createError({ statusCode: 404, message: 'Cellar not found' })
  }

  const body = await readBody(event)
  const parsed = createSpaceSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid input', data: parsed.error.flatten() })
  }

  const { name, type, walls } = parsed.data

  return await db.transaction(async (tx) => {
    const [space] = await tx.insert(cellarSpaces).values({
      cellarId,
      userId,
      name,
      type,
    }).returning()

    if (type === 'room' && walls?.length) {
      await tx.insert(spaceWalls).values(
        walls.map(position => ({ spaceId: space.id, position }))
      )
    }

    return space
  })
})
