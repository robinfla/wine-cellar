import { eq } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { cellars, regions, appellations, grapes, formats, inventoryLots } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const [allCellars, allRegions, allAppellations, allGrapes, allFormats, existingHashes] =
    await Promise.all([
      db.select({ id: cellars.id, name: cellars.name }).from(cellars).where(eq(cellars.userId, userId)),
      db.select({ id: regions.id, name: regions.name }).from(regions),
      db.select({ id: appellations.id, name: appellations.name }).from(appellations),
      db.select({ id: grapes.id, name: grapes.name }).from(grapes),
      db.select({ id: formats.id, name: formats.name, volumeMl: formats.volumeMl }).from(formats),
      db.select({ hash: inventoryLots.importHash }).from(inventoryLots).where(eq(inventoryLots.userId, userId)),
    ])

  return {
    cellars: allCellars,
    regions: allRegions,
    appellations: allAppellations,
    grapes: allGrapes,
    formats: allFormats,
    existingHashes: existingHashes.map(h => h.hash).filter(Boolean),
  }
})
