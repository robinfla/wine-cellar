import { eq, inArray, and, isNull, sql } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { wines, inventoryLots, allocationItems, wineGrapes } from '~/server/db/schema'
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

  const [targetWine] = await db.select().from(wines).where(eq(wines.id, targetId))
  if (!targetWine) {
    throw createError({ statusCode: 404, message: 'Target wine not found' })
  }

  try {
    await db.transaction(async (tx) => {
      const sourceLots = await tx
        .select()
        .from(inventoryLots)
        .where(inArray(inventoryLots.wineId, sourceIds))

      for (const sourceLot of sourceLots) {
        const vintageCond = sourceLot.vintage === null
          ? isNull(inventoryLots.vintage)
          : eq(inventoryLots.vintage, sourceLot.vintage)

        const binCond = sourceLot.binLocation === null
          ? isNull(inventoryLots.binLocation)
          : eq(inventoryLots.binLocation, sourceLot.binLocation)

        const [existingLot] = await tx
          .select()
          .from(inventoryLots)
          .where(and(
            eq(inventoryLots.wineId, targetId),
            eq(inventoryLots.cellarId, sourceLot.cellarId),
            eq(inventoryLots.formatId, sourceLot.formatId),
            vintageCond,
            binCond,
            eq(inventoryLots.userId, sourceLot.userId),
          ))

        if (existingLot) {
          await tx
            .update(inventoryLots)
            .set({ quantity: existingLot.quantity + sourceLot.quantity })
            .where(eq(inventoryLots.id, existingLot.id))

          await tx.delete(inventoryLots).where(eq(inventoryLots.id, sourceLot.id))
        } else {
          await tx
            .update(inventoryLots)
            .set({ wineId: targetId })
            .where(eq(inventoryLots.id, sourceLot.id))
        }
      }

      await tx
        .update(allocationItems)
        .set({ wineId: targetId })
        .where(inArray(allocationItems.wineId, sourceIds))

      await tx
        .delete(wineGrapes)
        .where(inArray(wineGrapes.wineId, sourceIds))

      await tx.delete(wines).where(inArray(wines.id, sourceIds))
    })
  } catch (e: any) {
    console.error('Wine merge error:', e)
    if (e.code === '23505') {
      throw createError({
        statusCode: 409,
        message: 'Cannot merge: duplicate constraint violation. Contact admin.',
      })
    }
    throw e
  }

  return { success: true, mergedCount: sourceIds.length }
})
