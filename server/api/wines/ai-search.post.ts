import OpenAI from 'openai'
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
  if (!config.openaiApiKey) {
    throw createError({
      statusCode: 503,
      message: 'OpenAI API key is not configured',
    })
  }

  // Step 1: Parse with AI (reuse parse.post.ts logic)
  const openai = new OpenAI({ apiKey: config.openaiApiKey })

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You extract structured wine information from short free-text inputs. When a value is unknown, use null for nullable fields. Keep producer and wineName concise and normalized.',
      },
      {
        role: 'user',
        content: parsedBody.data.text,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'wine_parse_result',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            producer: { type: 'string' },
            wineName: { type: 'string' },
            vintage: { type: ['integer', 'null'] },
            color: {
              type: 'string',
              enum: ['red', 'white', 'rose', 'sparkling', 'dessert', 'fortified'],
            },
            region: { type: ['string', 'null'] },
            appellation: { type: ['string', 'null'] },
          },
          required: ['producer', 'wineName', 'vintage', 'color', 'region', 'appellation'],
        },
      },
    },
  })

  const content = completion.choices[0]?.message?.content
  if (!content) {
    throw createError({ statusCode: 502, message: 'OpenAI returned an empty response' })
  }

  let parsedResponse: unknown
  try {
    parsedResponse = JSON.parse(content)
  } catch {
    throw createError({ statusCode: 502, message: 'OpenAI returned invalid JSON' })
  }

  const validatedResponse = parsedWineSchema.safeParse(parsedResponse)
  if (!validatedResponse.success) {
    throw createError({
      statusCode: 502,
      message: 'OpenAI response did not match expected schema',
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
