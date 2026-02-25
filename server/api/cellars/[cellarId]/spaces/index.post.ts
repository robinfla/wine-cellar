import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { cellarSpaces, spaceWalls, cellars } from '~/server/db/schema'

const createSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['room', 'fridge']),
  walls: z.array(z.enum(['left', 'right', 'back', 'front', 'floor'])).optional(),
})

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const cellarId = Number(getRouterParam(event, 'cellarId'))
  if (isNaN(cellarId)) throw createError({ statusCode: 400, message: 'Invalid cellar ID' })

  const [cellar] = await db.select().from(cellars)
    .where(and(eq(cellars.id, cellarId), eq(cellars.userId, userId)))
  if (!cellar) throw createError({ statusCode: 404, message: 'Cellar not found' })

  const body = await readBody(event)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Invalid data', data: parsed.error.flatten() })

  const { name, type, walls } = parsed.data

  const [space] = await db.insert(cellarSpaces).values({
    cellarId,
    userId,
    name,
    type,
  }).returning()

  // Create walls if room type
  if (type === 'room' && walls && walls.length > 0) {
    await db.insert(spaceWalls).values(
      walls.map(position => ({ spaceId: space.id, position }))
    )
  }

  // Return space with walls
  const createdWalls = type === 'room'
    ? await db.select().from(spaceWalls).where(eq(spaceWalls.spaceId, space.id))
    : []

  return { ...space, walls: createdWalls }
})
