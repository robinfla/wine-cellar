/**
 * GET /api/chat/conversations
 * 
 * List user's sommelier conversations.
 * Returns most recent first with last message preview.
 */
import { sql } from 'drizzle-orm'
import { db } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const conversations = await db.execute(sql`
    SELECT 
      c.conversation_id,
      c.title,
      c.created_at,
      c.updated_at,
      (
        SELECT content FROM sommelier_messages m
        WHERE m.conversation_id = c.conversation_id
        ORDER BY m.created_at DESC LIMIT 1
      ) as last_message,
      (
        SELECT count(*)::int FROM sommelier_messages m
        WHERE m.conversation_id = c.conversation_id
      ) as message_count
    FROM sommelier_conversations c
    WHERE c.user_id = ${userId}
    ORDER BY c.updated_at DESC
    LIMIT 50
  `) as any[]

  return {
    conversations: conversations.map((c: any) => ({
      conversationId: c.conversation_id,
      title: c.title,
      lastMessage: c.last_message,
      messageCount: c.message_count,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }))
  }
})
