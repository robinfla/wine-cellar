/**
 * Search the wine knowledge base (493K+ wines).
 * 
 * GET /api/knowledge/search?q=chateau margaux
 * 
 * Returns wines with images, scores, and food pairings for display.
 * Public endpoint - no auth required.
 */
import { searchKnowledgeRich } from '~/server/utils/knowledge'

defineRouteMeta({ auth: false })

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const q = (query.q as string)?.trim()
  const limit = Math.min(parseInt(query.limit as string) || 20, 50)

  if (!q || q.length < 2) {
    return { results: [], query: q }
  }

  const results = searchKnowledgeRich(q, limit)

  return {
    query: q,
    count: results.length,
    results,
  }
})
