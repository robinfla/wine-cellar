/**
 * GET /api/chat/:conversationId
 * 
 * Load full message history for a conversation.
 */
import { sql } from 'drizzle-orm'
import { db } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const conversationId = getRouterParam(event, 'conversationId')
  if (!conversationId) {
    throw createError({ statusCode: 400, message: 'conversationId is required' })
  }

  // Verify conversation belongs to user
  const [conv] = await db.execute(sql`
    SELECT conversation_id, title, created_at
    FROM sommelier_conversations
    WHERE conversation_id = ${conversationId}::uuid AND user_id = ${userId}
  `) as any[]

  if (!conv) {
    throw createError({ statusCode: 404, message: 'Conversation not found' })
  }

  const messages = await db.execute(sql`
    SELECT role, content, model_used, created_at
    FROM sommelier_messages
    WHERE conversation_id = ${conversationId}::uuid
    ORDER BY created_at ASC
  `) as any[]

  return {
    conversationId: conv.conversation_id,
    title: conv.title,
    createdAt: conv.created_at,
    messages: messages.map((m: any) => ({
      role: m.role,
      content: m.content,
      model: m.model_used,
      createdAt: m.created_at,
    }))
  }
})
