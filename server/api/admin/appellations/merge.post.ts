import { eq, inArray } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { appellations, wines } from '~/server/db/schema'
import { z } from 'zod'

const mergeSchema = z.object({
  sourceIds: z.array(z.number().int().positive()).min(1),
  targetId: z.number().int().positive(),
})

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user?.isAdmin) {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const body = await readBody(event)
  const parsed = mergeSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid merge data' })
  }

  const { sourceIds, targetId } = parsed.data

  if (sourceIds.includes(targetId)) {
    throw createError({ statusCode: 400, message: 'Target cannot be in source list' })
  }

  const [targetAppellation] = await db.select().from(appellations).where(eq(appellations.id, targetId))
  if (!targetAppellation) {
    throw createError({ statusCode: 404, message: 'Target appellation not found' })
  }

  await db.transaction(async (tx) => {
    await tx
      .update(wines)
      .set({ appellationId: targetId })
      .where(inArray(wines.appellationId, sourceIds))

    await tx.delete(appellations).where(inArray(appellations.id, sourceIds))
  })

  return { success: true, mergedCount: sourceIds.length }
})
