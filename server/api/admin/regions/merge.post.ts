import { eq, inArray } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { regions, producers, appellations, wines } from '~/server/db/schema'
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

  const [targetRegion] = await db.select().from(regions).where(eq(regions.id, targetId))
  if (!targetRegion) {
    throw createError({ statusCode: 404, message: 'Target region not found' })
  }

  await db.transaction(async (tx) => {
    await tx
      .update(producers)
      .set({ regionId: targetId })
      .where(inArray(producers.regionId, sourceIds))

    await tx
      .update(appellations)
      .set({ regionId: targetId })
      .where(inArray(appellations.regionId, sourceIds))

    await tx
      .update(wines)
      .set({ regionId: targetId })
      .where(inArray(wines.regionId, sourceIds))

    await tx.delete(regions).where(inArray(regions.id, sourceIds))
  })

  return { success: true, mergedCount: sourceIds.length }
})
