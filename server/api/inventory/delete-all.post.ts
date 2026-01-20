import { db } from '~/server/utils/db'
import { inventoryLots, tastingNotes, inventoryEvents, maturityOverrides } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  // Require explicit confirmation for safety
  if (!body?.confirm) {
    throw createError({
      statusCode: 400,
      message: 'Confirmation required. Set confirm: true to proceed.',
    })
  }

  // Count lots before deletion for response
  const [{ count: lotCount }] = await db
    .select({ count: db.$count(inventoryLots) })
    .from(inventoryLots)

  // Delete in cascade order:
  // 1. Tasting notes (references inventory lots)
  await db.delete(tastingNotes)

  // 2. Inventory events (references inventory lots)
  await db.delete(inventoryEvents)

  // 3. Maturity overrides (references inventory lots)
  await db.delete(maturityOverrides)

  // 4. Inventory lots
  await db.delete(inventoryLots)

  return {
    success: true,
    deleted: Number(lotCount),
  }
})
