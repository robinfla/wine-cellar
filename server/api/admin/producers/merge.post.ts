import { eq, inArray, and, isNull } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { producers, wines, inventoryLots, allocationItems, wineGrapes } from '~/server/db/schema'
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

  const [targetProducer] = await db.select().from(producers).where(eq(producers.id, targetId))
  if (!targetProducer) {
    throw createError({ statusCode: 404, message: 'Target producer not found' })
  }

  try {
    await db.transaction(async (tx) => {
      const sourceWines = await tx
        .select()
        .from(wines)
        .where(inArray(wines.producerId, sourceIds))

      for (const sourceWine of sourceWines) {
        const [existingWine] = await tx
          .select()
          .from(wines)
          .where(and(
            eq(wines.producerId, targetId),
            eq(wines.name, sourceWine.name),
            eq(wines.color, sourceWine.color),
            eq(wines.userId, sourceWine.userId),
          ))

        if (existingWine) {
          const sourceLots = await tx
            .select()
            .from(inventoryLots)
            .where(eq(inventoryLots.wineId, sourceWine.id))

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
                eq(inventoryLots.wineId, existingWine.id),
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
                .set({ wineId: existingWine.id })
                .where(eq(inventoryLots.id, sourceLot.id))
            }
          }

          await tx
            .update(allocationItems)
            .set({ wineId: existingWine.id })
            .where(eq(allocationItems.wineId, sourceWine.id))

          await tx
            .delete(wineGrapes)
            .where(eq(wineGrapes.wineId, sourceWine.id))

          await tx.delete(wines).where(eq(wines.id, sourceWine.id))
        } else {
          await tx
            .update(wines)
            .set({ producerId: targetId })
            .where(eq(wines.id, sourceWine.id))
        }
      }

      await tx.delete(producers).where(inArray(producers.id, sourceIds))
    })
  } catch (e: any) {
    console.error('Producer merge error:', e)
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
