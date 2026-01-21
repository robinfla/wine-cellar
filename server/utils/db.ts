import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../db/schema'

const connectionString = useRuntimeConfig().databaseUrl
const isProduction = process.env.NODE_ENV === 'production'

const queryClient = postgres(connectionString, {
  max: isProduction ? 1 : 10,
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: !isProduction,
})

export const db = drizzle(queryClient, { schema })

export { schema }
