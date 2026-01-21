import { sql } from 'drizzle-orm'
import { db } from '~/server/utils/db'

export default defineEventHandler(async () => {
  const start = Date.now()
  
  try {
    const result = await db.execute(sql`SELECT 1 as ping`)
    return {
      status: 'ok',
      db: 'connected',
      latency: Date.now() - start,
      timestamp: new Date().toISOString(),
    }
  } catch (error: unknown) {
    const err = error as Error & { code?: string }
    return {
      status: 'ok',
      db: 'error',
      error: err.message,
      code: err.code,
      latency: Date.now() - start,
      timestamp: new Date().toISOString(),
    }
  }
})
