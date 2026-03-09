/**
 * POST /api/chat/sommelier-stream
 * 
 * Streaming version of sommelier chat.
 * Uses Server-Sent Events (SSE) to stream Claude's response in real-time.
 * 
 * Body:
 *   message: string
 *   conversationId?: string
 * 
 * Response: text/event-stream
 *   data: {"type": "start", "conversationId": "..."}
 *   data: {"type": "chunk", "text": "..."}
 *   data: {"type": "done", "tokensIn": 100, "tokensOut": 200}
 */
import { eq, sql } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { inventoryLots, wines, producers } from '~/server/db/schema'
import { getOrCreateConversation, loadMessages, saveMessage } from '~/server/utils/conversation-store'
import { buildSystemPrompt, routeModel, chatStream } from '~/server/utils/sommelier'
import type { TasteProfile } from '~/server/utils/taste-profile'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  const userName = event.context.user?.name
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const body = await readBody(event)
  const { message, conversationId: inputConversationId } = body

  if (!message || typeof message !== 'string') {
    throw createError({ statusCode: 400, message: 'message is required' })
  }

  // Set SSE headers
  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  })

  const conversationId = await getOrCreateConversation(userId, inputConversationId)

  // Load context
  const [profileRow] = await db.execute(sql`
    SELECT profile FROM taste_profiles WHERE user_id = ${userId}
  `) as any[]
  const tasteProfile: TasteProfile | null = profileRow?.profile || null

  const history = await loadMessages(conversationId, 10)

  const cellarWines = await db.execute(sql`
    SELECT 
      w.name as name,
      p.name as producer,
      w.color::text as color,
      SUM(il.quantity)::int as quantity,
      il.vintage,
      a.name as appellation
    FROM inventory_lots il
    JOIN wines w ON il.wine_id = w.id
    JOIN producers p ON w.producer_id = p.id
    LEFT JOIN appellations a ON w.appellation_id = a.id
    WHERE il.user_id = ${userId} AND il.quantity > 0
    GROUP BY w.id, w.name, p.name, w.color, il.vintage, a.name
    ORDER BY SUM(il.quantity) DESC
    LIMIT 50
  `) as any[]

  const systemPrompt = buildSystemPrompt(userName, tasteProfile, cellarWines)
  const tier = routeModel(message)

  // Save user message
  await saveMessage(conversationId, { role: 'user', content: message })

  // Send start event
  event.node.res.write(`data: ${JSON.stringify({ type: 'start', conversationId })}\n\n`)

  let fullResponse = ''
  let tokensIn = 0
  let tokensOut = 0

  try {
    // Stream from Claude
    await chatStream(
      systemPrompt,
      history,
      message,
      tier,
      (chunk: string) => {
        fullResponse += chunk
        event.node.res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`)
      },
      (usage: { input_tokens: number; output_tokens: number }) => {
        tokensIn = usage.input_tokens
        tokensOut = usage.output_tokens
      }
    )

    // Save assistant message
    await saveMessage(conversationId, { role: 'assistant', content: fullResponse })

    // Send done event
    event.node.res.write(`data: ${JSON.stringify({ type: 'done', tokensIn, tokensOut })}\n\n`)
  } catch (error) {
    event.node.res.write(`data: ${JSON.stringify({ type: 'error', message: 'Failed to generate response' })}\n\n`)
  }

  event.node.res.end()
})
