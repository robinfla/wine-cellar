import { db } from '~/server/utils/db'
import { formats } from '~/server/db/schema'

export default defineEventHandler(async () => {
  const result = await db
    .select()
    .from(formats)
    .orderBy(formats.volumeMl)

  return result
})
