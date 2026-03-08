/**
 * POST /api/chat/sommelier
 * 
 * The main sommelier chat endpoint.
 * Handles conversation continuity, taste profile injection,
 * cellar context, model routing, and preference learning.
 * 
 * Body:
 *   message: string          — user's message
 *   conversationId?: string  — existing conversation UUID (omit for new)
 * 
 * Returns:
 *   message: string          — sommelier's response
 *   conversationId: string   — conversation UUID for continuity
 *   suggestions?: []         — wine cards from cellar (when recommending)
 *   model: string            — which model was used
 */
import { eq, sql } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { inventoryLots, wines, producers, regions, appellations } from '~/server/db/schema'
import { getOrCreateConversation, loadMessages, saveMessage } from '~/server/utils/conversation-store'
import { buildSystemPrompt, routeModel, chat, extractPreferences } from '~/server/utils/sommelier'
import type { TasteProfile } from '~/server/utils/taste-profile'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const body = await readBody(event)
  const { message, conversationId: inputConversationId } = body

  if (!message || typeof message !== 'string') {
    throw createError({ statusCode: 400, message: 'message is required' })
  }

  // 1. Get or create conversation
  const conversationId = await getOrCreateConversation(userId, inputConversationId)

  // 2. Load taste profile
  const [profileRow] = await db.execute(sql`
    SELECT profile FROM taste_profiles WHERE user_id = ${userId}
  `) as any[]
  const tasteProfile: TasteProfile | null = profileRow?.profile || null

  // 3. Load conversation history (last 10 messages)
  const history = await loadMessages(conversationId, 10)

  // 4. Load user's cellar wines for context
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

  // 5. Build system prompt
  const systemPrompt = buildSystemPrompt(tasteProfile, cellarWines)

  // 6. Route to model
  const tier = routeModel(message)

  // 7. Save user message
  await saveMessage(conversationId, { role: 'user', content: message })

  // 8. Call Claude
  const result = await chat(systemPrompt, history, message, tier)

  // 9. Save assistant response
  await saveMessage(conversationId, {
    role: 'assistant',
    content: result.response,
    modelUsed: result.model,
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut,
  })

  // 10. Async: extract preferences and update profile (fire-and-forget)
  extractAndUpdatePreferences(userId, message, result.response).catch(() => {})

  // 11. Extract wine suggestions from response (match against cellar)
  const suggestions = extractSuggestions(result.response, cellarWines)

  return {
    message: result.response,
    conversationId,
    suggestions,
    model: tier,
  }
})

/**
 * Extract preferences from the exchange and update the taste profile.
 */
async function extractAndUpdatePreferences(
  userId: number,
  userMessage: string,
  assistantMessage: string,
): Promise<void> {
  const newPrefs = await extractPreferences(userMessage, assistantMessage)
  if (newPrefs.length === 0) return

  // Append to learned preferences in the profile
  await db.execute(sql`
    UPDATE taste_profiles
    SET 
      profile = jsonb_set(
        profile,
        '{learnedPreferences}',
        COALESCE(profile->'learnedPreferences', '[]'::jsonb) || ${JSON.stringify(newPrefs)}::jsonb
      ),
      updated_at = NOW()
    WHERE user_id = ${userId}
  `)
}

/**
 * Try to match wine names mentioned in the response to cellar wines.
 * Returns structured wine cards for the mobile app.
 */
function extractSuggestions(
  response: string,
  cellarWines: any[],
): Array<{ name: string; producer: string; color: string; quantity: number; vintage?: number }> {
  const suggestions: any[] = []
  const responseLower = response.toLowerCase()

  for (const wine of cellarWines) {
    // Check if the response mentions this wine's producer or name
    const producerMatch = wine.producer && responseLower.includes(wine.producer.toLowerCase())
    const nameMatch = wine.name && responseLower.includes(wine.name.toLowerCase())

    if (producerMatch || nameMatch) {
      suggestions.push({
        name: wine.name,
        producer: wine.producer,
        color: wine.color,
        quantity: wine.quantity,
        vintage: wine.vintage,
        appellation: wine.appellation,
      })
    }
  }

  // Deduplicate by producer+name and return max 5
  const seen = new Set<string>()
  return suggestions.filter(s => {
    const key = `${s.producer}-${s.name}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 5)
}
