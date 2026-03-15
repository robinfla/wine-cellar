import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { db } from '~/server/utils/db'
import { wines, producers, regions } from '~/server/db/schema'
import { eq, ilike, and, or } from 'drizzle-orm'
import { enrichWithKnowledge, searchKnowledgeRich, matchAndEnrich } from '~/server/utils/knowledge'

const scanRequestSchema = z.object({
  image: z.string().min(1),
})

const parsedWineSchema = z.object({
  producer: z.string(),
  wineName: z.string(),
  vintage: z.number().int().nullable(),
  color: z.enum(['red', 'white', 'rose', 'sparkling', 'dessert', 'fortified']),
  region: z.string().nullable(),
  appellation: z.string().nullable(),
})

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const body = await readBody(event)
  const parsedBody = scanRequestSchema.safeParse(body)

  if (!parsedBody.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid request',
      data: parsedBody.error.flatten(),
    })
  }

  const config = useRuntimeConfig()
  if (!config.anthropicApiKey) {
    throw createError({
      statusCode: 503,
      message: 'Anthropic API key is not configured',
    })
  }

  // Step 1: Parse wine label with Claude Vision
  const anthropic = new Anthropic({ apiKey: config.anthropicApiKey })

  // Handle both data URL format and raw base64
  let imageData = parsedBody.data.image
  if (imageData.startsWith('data:')) {
    // Extract base64 part from data URL
    imageData = imageData.split(',')[1]
  }

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    system: 'You are a wine label reader. Extract structured information from this wine label image. Respond ONLY with a JSON object: { producer, wineName, vintage (integer or null), color (red/white/rose/sparkling/dessert/fortified), region (or null), appellation (or null) }',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: imageData,
            },
          },
        ],
      },
    ],
  })

  const contentBlock = message.content[0]
  if (!contentBlock || contentBlock.type !== 'text') {
    throw createError({ statusCode: 502, message: 'Anthropic returned an empty response' })
  }

  let parsedResponse: unknown
  try {
    let jsonText = contentBlock.text.trim()
    // Strip markdown code fences if present
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
    }
    // If still not valid JSON, try to extract the first JSON object from the text
    if (!jsonText.startsWith('{')) {
      const match = jsonText.match(/\{[\s\S]*\}/)
      if (match) jsonText = match[0]
    }
    parsedResponse = JSON.parse(jsonText)
  } catch {
    console.error('[scan] Failed to parse Anthropic response:', contentBlock.text)
    throw createError({ statusCode: 502, message: 'Anthropic returned invalid JSON' })
  }

  const validatedResponse = parsedWineSchema.safeParse(parsedResponse)
  if (!validatedResponse.success) {
    throw createError({
      statusCode: 502,
      message: 'Anthropic response did not match expected schema',
      data: validatedResponse.error.flatten(),
    })
  }

  // Enrich AI vision result with knowledge base data
  const parsed = enrichWithKnowledge(validatedResponse.data)

  // Step 2: Search existing wines for matches
  const matches = await db
    .select({
      wine: wines,
      producer: producers,
      region: regions,
    })
    .from(wines)
    .innerJoin(producers, eq(wines.producerId, producers.id))
    .leftJoin(regions, eq(producers.regionId, regions.id))
    .where(
      and(
        eq(wines.userId, userId),
        or(
          ilike(producers.name, `%${parsed.producer}%`),
          ilike(wines.name, `%${parsed.wineName}%`),
        ),
      ),
    )
    .limit(10)

  // Score matches by relevance (copied from ai-search.post.ts)
  const scoredMatches = matches.map((m) => {
    let score = 0
    const producerNameLower = m.producer.name.toLowerCase()
    const wineNameLower = m.wine.name.toLowerCase()
    const parsedProducerLower = parsed.producer.toLowerCase()
    const parsedWineNameLower = parsed.wineName.toLowerCase()

    // Exact producer match
    if (producerNameLower === parsedProducerLower) score += 50
    else if (producerNameLower.includes(parsedProducerLower) || parsedProducerLower.includes(producerNameLower)) score += 30

    // Exact wine name match
    if (wineNameLower === parsedWineNameLower) score += 40
    else if (wineNameLower.includes(parsedWineNameLower) || parsedWineNameLower.includes(wineNameLower)) score += 20

    // Color match
    if (m.wine.color === parsed.color) score += 10

    return {
      wine: m.wine,
      producer: m.producer,
      region: m.region,
      score,
    }
  })

  // Sort by score descending
  scoredMatches.sort((a, b) => b.score - a.score)

  // Knowledge base suggestions with full enrichment data (images, scores, pairings)
  const searchTerms = [parsed.producer, parsed.wineName].filter(Boolean).join(' ')
  const kbSuggestions = searchKnowledgeRich(searchTerms, 5)

  // Try to find a high-confidence match for auto-enrichment
  const fullLabelText = [parsed.producer, parsed.wineName, parsed.region, parsed.appellation]
    .filter(Boolean)
    .join(' ')
  const bestMatch = matchAndEnrich(fullLabelText)

  return {
    parsed,
    matches: scoredMatches,
    suggestions: kbSuggestions,
    // If we found a confident KB match, include full enrichment
    enrichment: bestMatch && bestMatch.confidence >= 50 ? bestMatch : null,
  }
})