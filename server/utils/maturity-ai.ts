import Anthropic from '@anthropic-ai/sdk'

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
}

/**
 * Use Claude to estimate the drinking window for a wine based on its characteristics.
 * Returns years after vintage (e.g. drinkFromYears=3 means vintage+3).
 */
export async function estimateMaturity(input: MaturityEstimateInput): Promise<MaturityEstimate | null> {
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

    return {
      drinkFromYears: Math.max(0, Math.round(parsed.drinkFromYears)),
      drinkUntilYears: Math.max(1, Math.round(parsed.drinkUntilYears)),
      confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'low',
      reasoning: parsed.reasoning || '',
    }
  } catch (e) {
    console.error('[maturity-ai] Failed to estimate:', e)
    return null
  }
}
