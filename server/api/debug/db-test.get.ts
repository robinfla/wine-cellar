import postgres from 'postgres'

export default defineEventHandler(async () => {
  const timings: Record<string, number> = {}
  const results: Record<string, unknown> = {}
  
  const connectionString = useRuntimeConfig().databaseUrl
  
  // Parse connection string for diagnostics (hide password)
  const urlInfo = (() => {
    try {
      const url = new URL(connectionString)
      return {
        host: url.hostname,
        port: url.port,
        database: url.pathname.slice(1),
        hasPassword: !!url.password,
        searchParams: url.search,
      }
    } catch {
      return { error: 'Could not parse URL' }
    }
  })()
  
  const start = Date.now()
  
  // Create a fresh connection for this test with explicit settings
  const sql = postgres(connectionString, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 30,
    prepare: false,
  })
  
  try {
    // Test 1: Simple query
    const t1 = Date.now()
    const simpleResult = await sql`SELECT 1 as test`
    timings['1_simple_query'] = Date.now() - t1
    results['1_simple_query'] = simpleResult
    
    // Test 2: Count users
    const t2 = Date.now()
    const userCount = await sql`SELECT COUNT(*) as count FROM users`
    timings['2_count_users'] = Date.now() - t2
    results['2_count_users'] = userCount
    
    // Test 3: Count regions
    const t3 = Date.now()
    const regionCount = await sql`SELECT COUNT(*) as count FROM regions`
    timings['3_count_regions'] = Date.now() - t3
    results['3_count_regions'] = regionCount
    
    timings['total'] = Date.now() - start
    
    // Clean up
    await sql.end()
    
    return {
      success: true,
      timings,
      results,
      connection: urlInfo,
      environment: {
        nodeEnv: process.env.NODE_ENV,
      },
    }
  } catch (error: unknown) {
    const err = error as Error & { code?: string }
    timings['error_at'] = Date.now() - start
    
    try { await sql.end() } catch { /* ignore */ }
    
    return {
      success: false,
      error: err.message,
      code: err.code,
      timings,
      connection: urlInfo,
      environment: {
        nodeEnv: process.env.NODE_ENV,
      },
    }
  }
})
