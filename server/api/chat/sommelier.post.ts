import { eq, sql, ilike, or } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { inventoryLots, wines, producers, regions } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const body = await readBody(event)
  const { prompt } = body

  if (!prompt || typeof prompt !== 'string') {
    throw createError({ statusCode: 400, message: 'Prompt is required' })
  }

  // Get user's cellar inventory for context
  const userWines = await db
    .select({
      wineId: wines.id,
      wineName: wines.name,
      producerName: producers.name,
      regionName: regions.name,
      color: wines.color,
      quantity: sql<number>`SUM(${inventoryLots.quantity})`,
      bottleImageUrl: wines.bottleImageUrl,
    })
    .from(inventoryLots)
    .innerJoin(wines, eq(inventoryLots.wineId, wines.id))
    .innerJoin(producers, eq(wines.producerId, producers.id))
    .leftJoin(regions, eq(producers.regionId, regions.id))
    .where(eq(inventoryLots.userId, userId))
    .groupBy(wines.id, wines.name, producers.name, regions.name, wines.color, wines.bottleImageUrl)
    .limit(100)

  // Simple pairing logic (can be enhanced with AI later)
  const suggestions = findPairings(prompt.toLowerCase(), userWines)

  // Generate response message
  let message = generateResponseMessage(prompt, suggestions)

  return {
    message,
    suggestions: suggestions.slice(0, 3).map((wine) => ({
      wineId: wine.wineId,
      name: `${wine.producerName} ${wine.wineName}`,
      region: wine.regionName || 'Unknown Region',
      pairingNote: getPairingNote(prompt, wine.color),
      imageUrl: wine.bottleImageUrl,
    })),
  }
})

// Simple pairing rules
function findPairings(prompt: string, wines: any[]) {
  const pairings: any[] = []

  // Keywords for different wine types
  const redMeatKeywords = ['steak', 'beef', 'lamb', 'venison', 'red meat', 'ribs', 'burger']
  const whiteFishKeywords = ['fish', 'salmon', 'cod', 'seafood', 'shrimp', 'oyster', 'sushi']
  const poultryKeywords = ['chicken', 'turkey', 'duck', 'poultry']
  const cheeseKeywords = ['cheese', 'brie', 'cheddar', 'goat cheese']
  const spicyKeywords = ['spicy', 'curry', 'thai', 'indian', 'hot']
  const richKeywords = ['creamy', 'butter', 'rich', 'pasta', 'risotto']

  // Red meat → Red wine
  if (redMeatKeywords.some((kw) => prompt.includes(kw))) {
    pairings.push(...wines.filter((w) => w.color === 'red'))
  }

  // White fish → White wine
  if (whiteFishKeywords.some((kw) => prompt.includes(kw))) {
    pairings.push(...wines.filter((w) => w.color === 'white'))
  }

  // Poultry → White or light red
  if (poultryKeywords.some((kw) => prompt.includes(kw))) {
    pairings.push(...wines.filter((w) => w.color === 'white' || w.color === 'rose'))
  }

  // Cheese → Red or white depending on type
  if (cheeseKeywords.some((kw) => prompt.includes(kw))) {
    pairings.push(...wines.filter((w) => w.color === 'red' || w.color === 'white'))
  }

  // Spicy food → White or rosé
  if (spicyKeywords.some((kw) => prompt.includes(kw))) {
    pairings.push(...wines.filter((w) => w.color === 'white' || w.color === 'rose'))
  }

  // Rich/creamy → White
  if (richKeywords.some((kw) => prompt.includes(kw))) {
    pairings.push(...wines.filter((w) => w.color === 'white'))
  }

  // If no matches, suggest any wine
  if (pairings.length === 0) {
    pairings.push(...wines)
  }

  // Remove duplicates and return
  const uniquePairings = Array.from(new Map(pairings.map((item) => [item.wineId, item])).values())
  return uniquePairings
}

function generateResponseMessage(prompt: string, suggestions: any[]) {
  if (suggestions.length === 0) {
    return "I couldn't find any wines in your cellar for this pairing. Consider adding some wines that would complement your meal!"
  }

  const count = suggestions.length
  const wineType = suggestions[0]?.color || 'wine'

  return `Great choice! For ${extractFood(prompt)}, I'd recommend ${
    wineType === 'red' ? 'a rich red' : wineType === 'white' ? 'a crisp white' : 'a refreshing'
  } wine. I found ${count} ${count === 1 ? 'option' : 'options'} in your cellar that would pair beautifully.`
}

function extractFood(prompt: string) {
  // Simple extraction - can be enhanced
  const foods = [
    'grilled salmon',
    'steak',
    'chicken',
    'pasta',
    'cheese',
    'fish',
    'seafood',
    'beef',
    'lamb',
  ]
  for (const food of foods) {
    if (prompt.toLowerCase().includes(food)) {
      return food
    }
  }
  return 'your meal'
}

function getPairingNote(prompt: string, color: string) {
  if (color === 'red') {
    return 'Bold tannins complement rich flavors'
  }
  if (color === 'white') {
    return 'Crisp acidity balances delicate dishes'
  }
  if (color === 'rose') {
    return 'Versatile pairing for varied flavors'
  }
  return 'Pairs beautifully with your meal'
}
