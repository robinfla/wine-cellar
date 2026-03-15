/**
 * Get full enrichment data for a knowledge base wine.
 * 
 * GET /api/knowledge/123
 * 
 * Returns complete wine data including:
 * - Basic info (producer, region, appellation)
 * - Images (CDN URLs from InVintory)
 * - Taste structure (acidity, tannin, sweetness, intensity)
 * - Aging windows (peak drinking years)
 * - Food pairings
 * - Critic reviews with tasting notes
 * 
 * Public endpoint - no auth required.
 */
import { getWineEnrichment } from '~/server/utils/knowledge'

defineRouteMeta({ auth: false })

export default defineEventHandler(async (event) => {
  const id = parseInt(getRouterParam(event, 'id') || '')

  if (isNaN(id) || id <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid wine ID',
    })
  }

  const enrichment = getWineEnrichment(id)

  if (!enrichment) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Wine not found in knowledge base',
    })
  }

  return enrichment
})
