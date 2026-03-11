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
  sonnet: { model: 'claude-3-5-sonnet-20240620', maxTokens: 2048 },
}

/**
 * Route to the appropriate model based on query complexity.
 * 
 * Note: Currently using Haiku for all queries since Sonnet 3.5 model names
 * keep changing. Will re-enable Sonnet routing once stable model names confirmed.
 */
export function routeModel(message: string): ModelTier {
  // Use Haiku for everything until Sonnet model name issue resolved
  return 'haiku'
  
  /* Disabled Sonnet routing - uncomment when model name fixed
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
  */
}

/**
 * Build personality-specific prompt overlay.
 */
function buildPersonalityPrompt(personality: any): string {
  if (!personality) return ''

  const parts: string[] = ['\n## Personality Customization']

  // Tone
  const toneMap: Record<string, string> = {
    professional: 'Maintain a professional, expert sommelier tone with refined language',
    friendly: 'Be warm and approachable like a wine buddy',
    casual: 'Keep it laid-back and conversational, like chatting with a friend',
    playful: 'Be fun and enthusiastic, celebrate the joy of wine',
  }
  if (personality.tone && toneMap[personality.tone]) {
    parts.push(`Tone: ${toneMap[personality.tone]}`)
  }

  // Verbosity
  const verbosityMap: Record<string, string> = {
    concise: 'Keep responses brief and to the point (1-2 sentences)',
    balanced: 'Provide right amount of detail (2-3 paragraphs)',
    detailed: 'Give thorough explanations with context and background',
  }
  if (personality.verbosity && verbosityMap[personality.verbosity]) {
    parts.push(`Detail Level: ${verbosityMap[personality.verbosity]}`)
  }

  // Formality
  const formalityMap: Record<string, string> = {
    formal: 'Use traditional sommelier terminology and formal service language',
    casual: 'Talk like a friend, avoid stuffy wine jargon',
    expert: 'Use technical wine terminology and precise descriptions',
  }
  if (personality.formality && formalityMap[personality.formality]) {
    parts.push(`Formality: ${formalityMap[personality.formality]}`)
  }

  // Teaching Style
  const teachingMap: Record<string, string> = {
    skip: 'Assume user knows wine basics, skip educational content',
    explain: 'Teach concepts when relevant, explain why recommendations work',
    deep: 'Always educate about regions, grapes, techniques, and history',
  }
  if (personality.teachingStyle && teachingMap[personality.teachingStyle]) {
    parts.push(`Teaching: ${teachingMap[personality.teachingStyle]}`)
  }

  // Recommendation Style
  const recoMap: Record<string, string> = {
    safe: 'Suggest classic, crowd-pleasing wines they\'ll definitely enjoy',
    adventurous: 'Push them to try unusual grapes, regions, and styles',
    balanced: 'Mix familiar favorites with occasional new discoveries',
  }
  if (personality.recommendationStyle && recoMap[personality.recommendationStyle]) {
    parts.push(`Recommendations: ${recoMap[personality.recommendationStyle]}`)
  }

  // Price Sensitivity
  const priceMap: Record<string, string> = {
    budget: 'Focus on value wines under €20, emphasize affordability',
    value: 'Recommend wines with best quality-to-price ratio',
    premium: 'Don\'t hesitate to suggest premium wines when appropriate',
  }
  if (personality.priceSensitivity && priceMap[personality.priceSensitivity]) {
    parts.push(`Price Approach: ${priceMap[personality.priceSensitivity]}`)
  }

  // Regional Preference
  const regionMap: Record<string, string> = {
    classic: 'Prioritize Old World wines (France, Italy, Spain)',
    modern: 'Lean toward New World wines (US, Australia, South Africa)',
    balanced: 'Draw equally from all wine regions worldwide',
  }
  if (personality.regionalPreference && regionMap[personality.regionalPreference]) {
    parts.push(`Regional Focus: ${regionMap[personality.regionalPreference]}`)
  }

  return parts.join('\n')
}

/**
 * Build the full system prompt with user context.
 */
export function buildSystemPrompt(
  userName: string | undefined,
  profile: TasteProfile | null,
  cellarWines: Array<{ name: string; producer: string; color: string; quantity: number; vintage?: number; appellation?: string; cellar_name?: string }>,
  cellarName?: string,
  personality?: any,
): string {
  const parts: string[] = [SOMMELIER_PERSONALITY]

  // Inject personality customization
  if (personality) {
    const personalityPrompt = buildPersonalityPrompt(personality)
    if (personalityPrompt) {
      parts.push(personalityPrompt)
    }
  }

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
