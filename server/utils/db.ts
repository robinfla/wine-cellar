import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../db/schema'

let _db: PostgresJsDatabase<typeof schema> | null = null

export const getDb = () => {
  if (!_db) {
    const connectionString = process.env.DATABASE_URL || process.env.NUXT_DATABASE_URL || ''
    
    const queryClient = postgres(connectionString, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 30,
      prepare: false,
    })
    
    _db = drizzle(queryClient, { schema })
  }
  return _db
}

export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_, prop) {
    return Reflect.get(getDb(), prop)
  },
})

export { schema }
