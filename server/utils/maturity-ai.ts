import Anthropic from '@anthropic-ai/sdk'
import { eq, and, sql } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { wineReferences } from '~/server/db/schema'

interface MaturityEstimateInput {
  wineName: string
  producer: string
  color: string
  region?: string | null
  appellation?: string | null
  grapes?: string | null
  vintage?: number | null
}

interface MaturityEstimate {
  drinkFromYears: number
  drinkUntilYears: number
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
  fromReference: boolean
}

/**
 * Normalize strings for matching (lowercase, trim, collapse whitespace)
 */
function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ')
}

/**
 * Look up existing wine reference, or estimate with AI and store the result.
 * Returns null only if AI is unavailable AND no reference exists.
 */
export async function estimateMaturity(input: MaturityEstimateInput): Promise<MaturityEstimate | null> {
  const normProducer = normalize(input.producer)
  const normWine = normalize(input.wineName)
  const normColor = input.color.toLowerCase() as any

  // 1. Check global reference table first
  const [existing] = await db
    .select()
    .from(wineReferences)
    .where(
      and(
        sql`lower(${wineReferences.producerName}) = ${normProducer}`,
        sql`lower(${wineReferences.wineName}) = ${normWine}`,
        eq(wineReferences.color, normColor),
      ),
    )
    .limit(1)

  if (existing) {
    return {
      drinkFromYears: existing.drinkFromYears,
      drinkUntilYears: existing.drinkUntilYears,
      confidence: existing.confidence as 'high' | 'medium' | 'low',
      reasoning: existing.reasoning || '',
      fromReference: true,
    }
  }

  // 2. No reference found — estimate with AI
  const config = useRuntimeConfig()
  if (!config.anthropicApiKey) return null

  const anthropic = new Anthropic({ apiKey: config.anthropicApiKey })

  const prompt = `You are a sommelier expert. Estimate the optimal drinking window for this wine.

Wine: ${input.producer} - ${input.wineName}
Color: ${input.color}
${input.region ? `Region: ${input.region}` : ''}
${input.appellation ? `Appellation: ${input.appellation}` : ''}
${input.grapes ? `Grapes: ${input.grapes}` : ''}
${input.vintage ? `Vintage: ${input.vintage}` : ''}

Return a JSON object with:
- drinkFromYears: number of years after vintage when the wine starts being enjoyable (minimum 0)
- drinkUntilYears: number of years after vintage when quality starts declining
- confidence: "high" if you recognize the wine/producer, "medium" if you can estimate from the region/grape, "low" if guessing from color alone
- reasoning: one short sentence explaining your estimate

Examples:
- Simple Beaujolais: {"drinkFromYears": 0, "drinkUntilYears": 3, "confidence": "high", "reasoning": "Light Gamay for early drinking"}
- Barolo Riserva: {"drinkFromYears": 8, "drinkUntilYears": 30, "confidence": "high", "reasoning": "Premium Nebbiolo needs extended aging"}
- Generic Côtes du Rhône: {"drinkFromYears": 1, "drinkUntilYears": 5, "confidence": "medium", "reasoning": "Southern Rhône blend, drink young"}

Respond ONLY with the JSON object.`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    })

    const contentBlock = message.content[0]
    if (!contentBlock || contentBlock.type !== 'text') return null

    let jsonText = contentBlock.text.trim()
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
    }

    const parsed = JSON.parse(jsonText)

    const estimate = {
      drinkFromYears: Math.max(0, Math.round(parsed.drinkFromYears)),
      drinkUntilYears: Math.max(1, Math.round(parsed.drinkUntilYears)),
      confidence: (['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'low') as 'high' | 'medium' | 'low',
      reasoning: parsed.reasoning || '',
    }

    // 3. Store in reference table for future lookups
    try {
      await db.insert(wineReferences).values({
        producerName: input.producer.trim(),
        wineName: input.wineName.trim(),
        color: normColor,
        region: input.region?.trim() || null,
        appellation: input.appellation?.trim() || null,
        grapes: input.grapes?.trim() || null,
        drinkFromYears: estimate.drinkFromYears,
        drinkUntilYears: estimate.drinkUntilYears,
        confidence: estimate.confidence,
        reasoning: estimate.reasoning,
      }).onConflictDoNothing()
    } catch (e) {
      console.error('[maturity-ai] Failed to store reference:', e)
    }

    return { ...estimate, fromReference: false }
  } catch (e) {
    console.error('[maturity-ai] Failed to estimate:', e)
    return null
  }
}
