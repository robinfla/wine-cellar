import OpenAI from 'openai'
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
  if (!config.openaiApiKey) {
    throw createError({
      statusCode: 503,
      message: 'OpenAI API key is not configured',
    })
  }

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

  return {
    success: true,
    parsed: validatedResponse.data,
  }
})
