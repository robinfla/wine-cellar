import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

const parseRequestSchema = z.object({
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
  const parsedBody = parseRequestSchema.safeParse(body)

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

  return {
    success: true,
    parsed: validatedResponse.data,
  }
})
