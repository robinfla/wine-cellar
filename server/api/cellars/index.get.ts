import { db } from '~/server/utils/db'
import { cellars } from '~/server/db/schema'

export default defineEventHandler(async () => {
  const result = await db
    .select()
    .from(cellars)
    .orderBy(cellars.name)

  return result
})
