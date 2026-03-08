/**
 * Conversation Store
 * Manages per-user sommelier conversation history in PostgreSQL.
 */
import { db } from './db'
import { sql } from 'drizzle-orm'

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  modelUsed?: string
  tokensIn?: number
  tokensOut?: number
  createdAt?: string
}

/**
 * Get or create a conversation for a user.
 * If conversationId is provided, validates it belongs to the user.
 * If not, creates a new one.
 */
export async function getOrCreateConversation(
  userId: number,
  conversationId?: string
): Promise<string> {
  if (conversationId) {
    const [existing] = await db.execute(sql`
      SELECT conversation_id FROM sommelier_conversations
      WHERE conversation_id = ${conversationId}::uuid AND user_id = ${userId}
    `)
    if (existing) return conversationId
  }

  // Create new conversation
  const [row] = await db.execute(sql`
    INSERT INTO sommelier_conversations (user_id)
    VALUES (${userId})
    RETURNING conversation_id
  `) as any[]
  return row.conversation_id
}

/**
 * Load recent messages for a conversation.
 * Returns last N messages in chronological order.
 */
export async function loadMessages(
  conversationId: string,
  limit: number = 10
): Promise<ConversationMessage[]> {
  const rows = await db.execute(sql`
    SELECT role, content, model_used, tokens_in, tokens_out, created_at
    FROM sommelier_messages
    WHERE conversation_id = ${conversationId}::uuid
    ORDER BY created_at DESC
    LIMIT ${limit}
  `) as any[]

  return rows.reverse().map((r: any) => ({
    role: r.role,
    content: r.content,
    modelUsed: r.model_used,
    tokensIn: r.tokens_in,
    tokensOut: r.tokens_out,
    createdAt: r.created_at,
  }))
}

/**
 * Save a message to a conversation.
 */
export async function saveMessage(
  conversationId: string,
  message: ConversationMessage
): Promise<void> {
  await db.execute(sql`
    INSERT INTO sommelier_messages (conversation_id, role, content, model_used, tokens_in, tokens_out)
    VALUES (
      ${conversationId}::uuid,
      ${message.role},
      ${message.content},
      ${message.modelUsed || null},
      ${message.tokensIn || null},
      ${message.tokensOut || null}
    )
  `)

  // Update conversation timestamp
  await db.execute(sql`
    UPDATE sommelier_conversations
    SET updated_at = NOW()
    WHERE conversation_id = ${conversationId}::uuid
  `)
}

/**
 * List conversations for a user.
 */
export async function listConversations(
  userId: number,
  limit: number = 20
): Promise<Array<{ conversationId: string; title: string | null; updatedAt: string }>> {
  const rows = await db.execute(sql`
    SELECT conversation_id, title, updated_at
    FROM sommelier_conversations
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
    LIMIT ${limit}
  `) as any[]

  return rows.map((r: any) => ({
    conversationId: r.conversation_id,
    title: r.title,
    updatedAt: r.updated_at,
  }))
}
