import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { db } from '~/server/utils/db'
import { wines, producers, regions } from '~/server/db/schema'
import { eq, ilike, and, or, sql } from 'drizzle-orm'

const searchRequestSchema = z.object({
  text: z.string().min(1).max(500),
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
  const parsedBody = searchRequestSchema.safeParse(body)

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

  // Step 1: Parse with AI (reuse parse.post.ts logic)
  const anthropic = new Anthropic({ apiKey: config.anthropicApiKey })

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    system: 'You extract structured wine information from short free-text inputs. When a value is unknown, use null for nullable fields. Keep producer and wineName concise and normalized. Respond ONLY with a JSON object matching this schema: { "producer": string, "wineName": string, "vintage": integer|null, "color": "red"|"white"|"rose"|"sparkling"|"dessert"|"fortified", "region": string|null, "appellation": string|null }',
    messages: [
      {
        role: 'user',
        content: parsedBody.data.text,
      },
    ],
  })

  const contentBlock = message.content[0]
  if (!contentBlock || contentBlock.type !== 'text') {
    throw createError({ statusCode: 502, message: 'Anthropic returned an empty response' })
  }

  let parsedResponse: unknown
  try {
    parsedResponse = JSON.parse(contentBlock.text)
  } catch {
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

  const parsed = validatedResponse.data

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

  // Score matches by relevance
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

  return {
    parsed,
    matches: scoredMatches,
  }
})
