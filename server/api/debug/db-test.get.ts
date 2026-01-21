import { sql } from 'drizzle-orm'
import { db } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const timings: Record<string, number> = {}
  const results: Record<string, any> = {}
  
  const start = Date.now()
  
  try {
    // Test 1: Simple query
    const t1 = Date.now()
    const simpleResult = await db.execute(sql`SELECT 1 as test`)
    timings['1_simple_query'] = Date.now() - t1
    results['1_simple_query'] = 'OK'
    
    // Test 2: Count users
    const t2 = Date.now()
    const userCount = await db.execute(sql`SELECT COUNT(*) as count FROM users`)
    timings['2_count_users'] = Date.now() - t2
    results['2_count_users'] = userCount
    
    // Test 3: Count cellars
    const t3 = Date.now()
    const cellarCount = await db.execute(sql`SELECT COUNT(*) as count FROM cellars`)
    timings['3_count_cellars'] = Date.now() - t3
    results['3_count_cellars'] = cellarCount
    
    // Test 4: Count regions
    const t4 = Date.now()
    const regionCount = await db.execute(sql`SELECT COUNT(*) as count FROM regions`)
    timings['4_count_regions'] = Date.now() - t4
    results['4_count_regions'] = regionCount
    
    // Test 5: Count inventory_lots
    const t5 = Date.now()
    const lotCount = await db.execute(sql`SELECT COUNT(*) as count FROM inventory_lots`)
    timings['5_count_inventory_lots'] = Date.now() - t5
    results['5_count_inventory_lots'] = lotCount
    
    timings['total'] = Date.now() - start
    
    return {
      success: true,
      timings,
      results,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasDbUrl: !!process.env.DATABASE_URL || !!process.env.NUXT_DATABASE_URL,
      },
    }
  } catch (error: any) {
    timings['error_at'] = Date.now() - start
    return {
      success: false,
      error: error.message,
      code: error.code,
      timings,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasDbUrl: !!process.env.DATABASE_URL || !!process.env.NUXT_DATABASE_URL,
      },
    }
  }
})
