import postgres from 'postgres'

export default defineNitroPlugin(async () => {
  const connectionString = process.env.DATABASE_URL || process.env.NUXT_DATABASE_URL || ''

  if (!connectionString) {
    console.error('\x1b[31m[Database] No DATABASE_URL configured\x1b[0m')
    console.error('\x1b[31m[Database] Please set DATABASE_URL in your environment\x1b[0m')
    process.exit(1)
  }

  const testClient = postgres(connectionString, {
    max: 1,
    connect_timeout: 5,
    idle_timeout: 1,
  })

  try {
    await testClient`SELECT 1`
    console.log('\x1b[32m[Database] Connection successful\x1b[0m')
  } catch (err) {
    console.error('\x1b[31m[Database] Failed to connect to database\x1b[0m')
    console.error('\x1b[31m[Database] Please ensure PostgreSQL is running and DATABASE_URL is correct\x1b[0m')
    if (err instanceof Error) {
      console.error(`\x1b[31m[Database] Error: ${err.message}\x1b[0m`)
    }
    process.exit(1)
  } finally {
    await testClient.end()
  }
})
