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
  const userName = event.context.user?.name
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

  // 2. Load user's cellars
  const cellars = await db.execute(sql`
    SELECT id, name FROM cellars WHERE user_id = ${userId}
  `) as Array<{ id: number; name: string }>

  // 3. Detect cellar name in message (case-insensitive)
  const messageLower = message.toLowerCase()
  const detectedCellar = cellars.find(c => messageLower.includes(c.name.toLowerCase()))

  // 4. Load taste profile
  const [profileRow] = await db.execute(sql`
    SELECT profile FROM taste_profiles WHERE user_id = ${userId}
  `) as any[]
  const tasteProfile: TasteProfile | null = profileRow?.profile || null

  // 5. Load conversation history (last 10 messages)
  const history = await loadMessages(conversationId, 10)

  // 6. Load user's cellar wines for context (filter by cellar if detected)
  const cellarWines = detectedCellar
    ? await db.execute(sql`
        SELECT 
          w.id as wine_id,
          w.name as name,
          p.name as producer,
          w.color::text as color,
          SUM(il.quantity)::int as quantity,
          il.vintage,
          a.name as appellation,
          r.name as region,
          c.name as cellar_name
        FROM inventory_lots il
        JOIN wines w ON il.wine_id = w.id
        JOIN producers p ON w.producer_id = p.id
        JOIN cellars c ON il.cellar_id = c.id
        LEFT JOIN appellations a ON w.appellation_id = a.id
        LEFT JOIN regions r ON a.region_id = r.id
        WHERE il.user_id = ${userId} AND il.quantity > 0 AND il.cellar_id = ${detectedCellar.id}
        GROUP BY w.id, w.name, p.name, w.color, il.vintage, a.name, r.name, c.name
        ORDER BY SUM(il.quantity) DESC
        LIMIT 50
      `) as any[]
    : await db.execute(sql`
        SELECT 
          w.id as wine_id,
          w.name as name,
          p.name as producer,
          w.color::text as color,
          SUM(il.quantity)::int as quantity,
          il.vintage,
          a.name as appellation,
          r.name as region,
          c.name as cellar_name
        FROM inventory_lots il
        JOIN wines w ON il.wine_id = w.id
        JOIN producers p ON w.producer_id = p.id
        JOIN cellars c ON il.cellar_id = c.id
        LEFT JOIN appellations a ON w.appellation_id = a.id
        LEFT JOIN regions r ON a.region_id = r.id
        WHERE il.user_id = ${userId} AND il.quantity > 0
        GROUP BY w.id, w.name, p.name, w.color, il.vintage, a.name, r.name, c.name
        ORDER BY SUM(il.quantity) DESC
        LIMIT 50
      `) as any[]

  // 7. Build system prompt
  const systemPrompt = buildSystemPrompt(userName, tasteProfile, cellarWines, detectedCellar?.name)

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
): Array<{ wineId: number; name: string; region: string; pairingNote: string; imageUrl?: string | null }> {
  const suggestions: any[] = []
  const responseLower = response.toLowerCase()

  for (const wine of cellarWines) {
    // Check if the response mentions this wine's producer or name
    // Only match if producer + wine name appear together (more specific)
    const producerName = `${wine.producer} ${wine.name}`.toLowerCase()
    const producerMatch = wine.producer && responseLower.includes(wine.producer.toLowerCase())
    const fullNameMatch = responseLower.includes(producerName)

    if (fullNameMatch || (producerMatch && responseLower.includes(wine.name.toLowerCase().split(' ')[0]))) {
      suggestions.push({
        wineId: wine.wine_id,
        name: `${wine.producer} ${wine.name}` + (wine.vintage ? ` ${wine.vintage}` : ''),
        region: wine.region || wine.appellation || 'Unknown',
        pairingNote: '', // Extract context from response later
        imageUrl: null,
      })
    }
  }

  // Deduplicate by wineId and return max 3
  const seen = new Set<number>()
  return suggestions.filter(s => {
    if (seen.has(s.wineId)) return false
    seen.add(s.wineId)
    return true
  }).slice(0, 3)
}
