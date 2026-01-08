import { eq } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { regions } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const countryCode = query.country as string | undefined

  let q = db.select().from(regions)

  if (countryCode) {
    q = q.where(eq(regions.countryCode, countryCode)) as typeof q
  }

  const result = await q.orderBy(regions.name)
  return result
})
