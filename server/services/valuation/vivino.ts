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

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
}

const decodeHtmlEntities = (str: string): string =>
  str.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')

const extractWineData = (html: string): VivinoWine[] => {
  const decoded = decodeHtmlEntities(html)

  const wineMatches = decoded.match(/\{"vintage":\{"id":\d+[^]*?"prices":\[\]\}/g)
  if (!wineMatches) return []

  const wines: VivinoWine[] = []

  for (const match of wineMatches) {
    try {
      const data = JSON.parse(match) as {
        vintage: {
          year: number
          wine: {
            id: number
            name: string
            winery?: { name: string }
          }
          statistics?: {
            ratings_average: number
            ratings_count: number
          }
        }
        price?: {
          amount: number
          currency?: { code: string }
        }
      }

      if (!data.vintage?.wine?.id) continue

      wines.push({
        id: data.vintage.wine.id,
        name: data.vintage.wine.name || '',
        winery: { name: data.vintage.wine.winery?.name || '' },
        vintage: data.vintage.year ? { year: data.vintage.year } : undefined,
        statistics: data.vintage.statistics ? {
          ratings_average: data.vintage.statistics.ratings_average,
          ratings_count: data.vintage.statistics.ratings_count,
        } : undefined,
        price: data.price?.amount ? {
          amount: data.price.amount,
          currency: data.price.currency?.code || 'EUR',
        } : undefined,
      })
    } catch {
      continue
    }
  }

  return wines
}

export const searchVivino = async (
  query: string,
  vintage?: number | null
): Promise<VivinoSearchResult | null> => {
  try {
    const searchTerms = vintage ? `${query} ${vintage}` : query
    const encodedQuery = encodeURIComponent(searchTerms)
    const url = `https://www.vivino.com/search/wines?q=${encodedQuery}`

    const response = await fetch(url, {
      headers: HEADERS,
      redirect: 'follow',
    })

    if (!response.ok) {
      console.error('Vivino search error:', response.status)
      return null
    }

    const html = await response.text()
    const wines = extractWineData(html)

    return { wines }
  } catch (error) {
    console.error('Vivino search error:', error)
    return null
  }
}
