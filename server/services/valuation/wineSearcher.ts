const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
}

export interface WineSearcherResult {
  name: string
  price: number
  url: string
}

const extractCookies = (response: Response): string => {
  const setCookies = response.headers.getSetCookie?.() || []
  return setCookies
    .map(cookie => cookie.split(';')[0])
    .join('; ')
}

export const searchWineSearcher = async (
  query: string,
  vintage?: number | null
): Promise<WineSearcherResult | null> => {
  try {
    const searchTerms = vintage ? `${query} ${vintage}` : query
    const encodedQuery = encodeURIComponent(searchTerms.replace(/\s+/g, '+'))
    const initialUrl = `https://www.wine-searcher.com/find/${encodedQuery}`

    const initialResponse = await fetch(initialUrl, {
      headers: HEADERS,
      redirect: 'manual',
    })

    const cookies = extractCookies(initialResponse)
    const redirectUrl = initialResponse.headers.get('location')

    const targetUrl = redirectUrl || initialUrl
    const finalResponse = await fetch(targetUrl, {
      headers: {
        ...HEADERS,
        'Cookie': cookies,
      },
    })

    if (!finalResponse.ok) {
      return null
    }

    const html = await finalResponse.text()

    const titleMatch = html.match(/<title>Best local price for ([^<]+)<\/title>/)
    const priceMatch = html.match(/Avg Price \(ex-tax\) €([0-9,]+)/)
    const canonicalMatch = html.match(/<link href="([^"]+)" rel="canonical">/)

    if (!priceMatch) {
      return null
    }

    const price = parseFloat(priceMatch[1].replace(',', ''))
    const rawName = titleMatch ? titleMatch[1].trim() : query
    const name = rawName
      .replace(/&#039;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/ - stores near you.*$/i, '')
    const canonicalUrl = canonicalMatch ? canonicalMatch[1] : targetUrl

    return {
      name,
      price,
      url: canonicalUrl,
    }
  } catch (error) {
    console.error('Wine-Searcher search error:', error)
    return null
  }
}
