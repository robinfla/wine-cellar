import { eq } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { grapes } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const color = query.color as string | undefined

  let q = db.select().from(grapes)

  if (color) {
    q = q.where(eq(grapes.color, color as any)) as typeof q
  }

  const result = await q.orderBy(grapes.name)
  return result
})
