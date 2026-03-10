/**
 * Sommelier Brain
 * System prompt construction, model routing, and preference extraction.
 */
import Anthropic from '@anthropic-ai/sdk'
import { profileToSommelierContext } from './taste-profile'
import type { TasteProfile } from './taste-profile'
import type { ConversationMessage } from './conversation-store'

const anthropic = new Anthropic()

const SOMMELIER_PERSONALITY = `You are the user's personal wine sommelier in Bibo. You're knowledgeable, warm, and opinionated — not a generic chatbot.

Personality:
- Conversational and friendly, like a sommelier at your favorite restaurant
- Opinionated — you have preferences and aren't afraid to share them
- Concise — no walls of text. 2-3 short paragraphs max unless asked for detail
- When recommending from their cellar, name the specific wine and why
- When they don't have the right wine, suggest what to buy with a price range
- Reference their past preferences and history when relevant
- Gently push them to explore new things based on their adventure level
- If they're a beginner, be educational without being condescending
- Use emoji sparingly — one per message max, if it fits

Rules:
- Always check their cellar first before suggesting purchases
- Respect their dislikes — NEVER recommend something they've said they dislike
- If you're not sure about something, say so — don't make up wine facts
- Keep food pairing suggestions specific (not just "red with meat")
- When discussing wine regions or producers, share one interesting fact they might not know`

type ModelTier = 'haiku' | 'sonnet'

interface ModelConfig {
  model: string
  maxTokens: number
}

const MODELS: Record<ModelTier, ModelConfig> = {
  haiku: { model: 'claude-3-haiku-20240307', maxTokens: 1024 },
  sonnet: { model: 'claude-3-5-sonnet-20241022', maxTokens: 2048 },
}

/**
 * Route to the appropriate model based on query complexity.
 */
export function routeModel(message: string): ModelTier {
  const lower = message.toLowerCase()

  // Sonnet: personalized recommendations, complex analysis
  const sonnetPatterns = [
    /what should i (open|drink|bring|serve)/,
    /recommend/,
    /suggest/,
    /build.*(collection|cellar)/,
    /what.*(missing|gap|lack)/,
    /compare/,
    /which.*(better|prefer)/,
    /plan.*(trip|visit|tasting)/,
    /invest/,
    /sell/,
    /how.*improv/,
  ]

  if (sonnetPatterns.some(p => p.test(lower))) return 'sonnet'

  // Everything else: Haiku (pairing, Q&A, facts, definitions)
  return 'haiku'
}

/**
 * Build the full system prompt with user context.
 */
export function buildSystemPrompt(
  userName: string | undefined,
  profile: TasteProfile | null,
  cellarWines: Array<{ name: string; producer: string; color: string; quantity: number; vintage?: number; appellation?: string; cellar_name?: string }>,
  cellarName?: string,
): string {
  const parts: string[] = [SOMMELIER_PERSONALITY]

  // Inject user name
  if (userName) {
    parts.push(`\nUser's name: ${userName}`)
  }

  // Inject taste profile
  if (profile) {
    parts.push('\n' + profileToSommelierContext(profile))
  } else {
    parts.push('\nNo taste profile available yet — this may be a new user. Be welcoming and ask about their preferences.')
  }

  // Inject relevant cellar wines (compact format)
  if (cellarWines.length > 0) {
    const wineList = cellarWines
      .slice(0, 50) // cap at 50 to control tokens (SQL already limits to 50)
      .map(w => {
        const parts = [w.producer, w.name]
        if (w.vintage) parts.push(String(w.vintage))
        if (w.appellation) parts.push(`(${w.appellation})`)
        parts.push(`[${w.color}, qty:${w.quantity}]`)
        return parts.join(' ')
      })
      .join('\n')

    const cellarHeader = cellarName 
      ? `## User's ${cellarName} Cellar (${cellarWines.length} wines)\nNote: User specifically asked about their ${cellarName} cellar. Only show wines from this location.`
      : `## User's Cellar (${cellarWines.length} wines)`
    
    parts.push(`\n${cellarHeader}\n${wineList}`)
  } else {
    const emptyMessage = cellarName
      ? `User has no wines in their ${cellarName} cellar.`
      : 'User has no wines in their cellar yet.'
    parts.push(`\n${emptyMessage}`)
  }

  return parts.join('\n')
}

/**
 * Call Claude with the sommelier context.
 */
export async function chat(
  systemPrompt: string,
  history: ConversationMessage[],
  userMessage: string,
  tier: ModelTier,
): Promise<{ response: string; tokensIn: number; tokensOut: number; model: string }> {
  const config = MODELS[tier]

  // Build messages array from history
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []

  for (const msg of history) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({ role: msg.role, content: msg.content })
    }
  }

  // Add current message
  messages.push({ role: 'user', content: userMessage })

  const result = await anthropic.messages.create({
    model: config.model,
    max_tokens: config.maxTokens,
    system: systemPrompt,
    messages,
  })

  const response = result.content
    .filter(block => block.type === 'text')
    .map(block => (block as any).text)
    .join('')

  return {
    response,
    tokensIn: result.usage.input_tokens,
    tokensOut: result.usage.output_tokens,
    model: config.model,
  }
}

/**
 * Stream Claude response with callbacks.
 */
export async function chatStream(
  systemPrompt: string,
  history: ConversationMessage[],
  userMessage: string,
  tier: ModelTier,
  onChunk: (text: string) => void,
  onUsage: (usage: { input_tokens: number; output_tokens: number }) => void,
): Promise<void> {
  const config = MODELS[tier]

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []

  for (const msg of history) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({ role: msg.role, content: msg.content })
    }
  }

  messages.push({ role: 'user', content: userMessage })

  const stream = await anthropic.messages.stream({
    model: config.model,
    max_tokens: config.maxTokens,
    system: systemPrompt,
    messages,
  })

  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      onChunk(chunk.delta.text)
    }
    if (chunk.type === 'message_stop') {
      const message = await stream.finalMessage()
      onUsage({
        input_tokens: message.usage.input_tokens,
        output_tokens: message.usage.output_tokens,
      })
    }
  }
}

/**
 * Extract taste preferences from a conversation exchange.
 * Uses Haiku for cost efficiency.
 */
export async function extractPreferences(
  userMessage: string,
  assistantMessage: string,
): Promise<string[]> {
  try {
    const result = await anthropic.messages.create({
      model: MODELS.haiku.model,
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `Extract any wine taste preferences expressed by the user in this exchange.
Return ONLY a JSON array of short preference strings, or [] if none found.
Only extract EXPLICIT preferences, not inferred ones.

Examples: ["doesn't like oaky wines", "prefers dry whites", "loves Northern Rhône Syrah", "finds Pinot Noir too light"]

User: ${userMessage}
Assistant: ${assistantMessage}

JSON array:`
      }]
    })

    const text = (result.content[0] as any).text.trim()
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return [] // fail silently — preference extraction is best-effort
  }
}
