import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { eq, gt, and } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { inventoryLots, wines, producers, regions } from '~/server/db/schema'

const pairingRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(4000),
  })).max(20).optional(),
})

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const body = await readBody(event)
  const parsedBody = pairingRequestSchema.safeParse(body)

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

  const inventory = await db
    .select({
      producer: producers.name,
      wineName: wines.name,
      vintage: inventoryLots.vintage,
      color: wines.color,
      region: regions.name,
      quantity: inventoryLots.quantity,
    })
    .from(inventoryLots)
    .innerJoin(wines, eq(inventoryLots.wineId, wines.id))
    .innerJoin(producers, eq(wines.producerId, producers.id))
    .leftJoin(regions, eq(producers.regionId, regions.id))
    .where(and(eq(inventoryLots.userId, userId), gt(inventoryLots.quantity, 0)))

  const inventoryList = inventory.length > 0
    ? inventory
      .map(({ producer, wineName, vintage, color, region, quantity }) => {
        const vintageLabel = vintage ?? 'NV'
        const regionLabel = region ?? 'Unknown region'
        return `${producer} ${wineName} (${vintageLabel}, ${color}, ${regionLabel}) - ${quantity} bottle(s)`
      })
      .join('\n')
    : 'No wines currently in cellar.'

  const systemPrompt = [
    'You are a sommelier assistant.',
    `The user has the following wines in their cellar:\n${inventoryList}`,
    'Help them with food and wine pairing suggestions.',
    'Be concise, warm, and knowledgeable.',
    'When suggesting a wine, reference specific bottles from their cellar.',
  ].join(' ')

  const anthropic = new Anthropic({ apiKey: config.anthropicApiKey })

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      ...(parsedBody.data.history ?? []).map(({ role, content }) => ({
        role: role as 'user' | 'assistant',
        content,
      })),
      {
        role: 'user' as const,
        content: parsedBody.data.message,
      },
    ],
  })

  const contentBlock = message.content[0]
  if (!contentBlock || contentBlock.type !== 'text') {
    throw createError({ statusCode: 502, message: 'Anthropic returned an empty response' })
  }

  return {
    reply: contentBlock.text.trim(),
  }
})
