interface VivinoWine {
  id: number
  name: string
  winery: { name: string }
  vintage?: { year: number }
  statistics?: {
    ratings_average: number
    ratings_count: number
  }
  price?: {
    amount: number
    currency: string
  }
}

export interface VivinoSearchResult {
  wines: VivinoWine[]
}

const VIVINO_BASE_URL = 'https://www.vivino.com/api'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
}

export const searchVivino = async (
  query: string,
  vintage?: number | null
): Promise<VivinoSearchResult | null> => {
  try {
    const params = new URLSearchParams({
      q: query,
      per_page: '25',
      country_code: 'FR',
      currency_code: 'EUR',
      min_rating: '1',
      price_range_min: '0',
      price_range_max: '10000',
    })

    if (vintage) {
      params.append('min_year', vintage.toString())
      params.append('max_year', vintage.toString())
    }

    const response = await fetch(
      `${VIVINO_BASE_URL}/explore/explore?${params}`,
      { headers: HEADERS }
    )

    if (!response.ok) {
      console.error('Vivino API error:', response.status, await response.text())
      return null
    }

    const data = await response.json()
    const matches = data.explore_vintage?.matches || []

    const wines: VivinoWine[] = matches
      .filter((match: any) => match.vintage?.wine?.id)
      .map((match: any) => ({
        id: match.vintage.wine.id,
        name: match.vintage.wine.name || '',
        winery: { name: match.vintage.wine.winery?.name || '' },
        vintage: match.vintage.year ? { year: match.vintage.year } : undefined,
        statistics: {
          ratings_average: match.vintage.statistics?.ratings_average,
          ratings_count: match.vintage.statistics?.ratings_count,
        },
        price: match.price ? {
          amount: match.price.amount,
          currency: match.price.currency?.code || 'EUR',
        } : undefined,
      }))

    return { wines }
  } catch (error) {
    console.error('Vivino search error:', error)
    return null
  }
}

export const getVivinoWinePrice = async (
  vivinoWineId: number,
  vintage?: number | null
): Promise<{ price: number; priceLow?: number; priceHigh?: number } | null> => {
  try {
    const url = vintage
      ? `${VIVINO_BASE_URL}/wines/${vivinoWineId}/years/${vintage}`
      : `${VIVINO_BASE_URL}/wines/${vivinoWineId}`

    const response = await fetch(url, { headers: HEADERS })

    if (!response.ok) return null

    const data = await response.json()
    const stats = data.vintage?.statistics || data.wine?.statistics

    if (!stats?.price_average) return null

    return {
      price: stats.price_average,
      priceLow: stats.price_min,
      priceHigh: stats.price_max,
    }
  } catch (error) {
    console.error('Vivino price fetch error:', error)
    return null
  }
}
