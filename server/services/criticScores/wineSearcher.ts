const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
}

export interface WineSearcherCriticScore {
  criticName: string
  score: number
  maxScore: number
  sourceUrl: string
  note?: string
}

interface WineSearcherCriticScoresResult {
  wineName: string
  url: string
  scores: WineSearcherCriticScore[]
}

const extractCookies = (response: Response): string => {
  const setCookies = response.headers.getSetCookie?.() || []
  return setCookies
    .map(cookie => cookie.split(';')[0])
    .join('; ')
}

const decodeHtmlEntities = ({ value }: { value: string }) => {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

const stripHtml = ({ value }: { value: string }) => {
  return decodeHtmlEntities({
    value: value
      .replace(/<br\s*\/?\s*>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  })
}

const normalizeScore = ({ score, maxScore }: { score: number; maxScore: number }) => {
  if (maxScore <= 0) {
    return score
  }

  if (maxScore === 100) {
    return score
  }

  return Math.round((score / maxScore) * 100)
}

const extractWineName = ({ html }: { html: string }) => {
  const match = html.match(/"product":\{[^}]*"name":"([^"]+)"/)
  if (!match) {
    return ''
  }

  return decodeHtmlEntities({ value: match[1] })
}

const extractAggregateCriticScore = ({ html }: { html: string }) => {
  const match = html.match(/"criticScore":(\d+)/)
  if (!match) {
    return null
  }

  return Number.parseInt(match[1], 10)
}

const extractSourceUrl = ({ block }: { block: string }) => {
  const anchorMatch = block.match(/<a[^>]*data-event="critics"[^>]*>/)
  if (!anchorMatch) {
    return ''
  }

  const hrefMatch = anchorMatch[0].match(/href="([^"]+)"/)
  if (!hrefMatch) {
    return ''
  }

  const href = hrefMatch[1]
  if (href.includes('wine-searcher.com')) {
    return ''
  }

  return href
}

const extractCriticScoresFromHtml = ({ html, fallbackUrl }: { html: string; fallbackUrl: string }) => {
  const itemPattern = /<div class="info-card__item">([\s\S]*?)(?=<div class="info-card__item">|<\/section>|<\/body>)/g
  const items = [...html.matchAll(itemPattern)]
  const withOptionalNote = ({
    criticName,
    score,
    maxScore,
    sourceUrl,
    note,
  }: {
    criticName: string
    score: number
    maxScore: number
    sourceUrl: string
    note?: string
  }): WineSearcherCriticScore => {
    return note
      ? { criticName, score, maxScore, sourceUrl, note }
      : { criticName, score, maxScore, sourceUrl }
  }

  const scores = items
    .map(([, block]): WineSearcherCriticScore | null => {
      const scoreMatch = block.match(/info-card__critic-score[\s\S]*?<span class="font-strong-bold">([^<]+)<\/span>/)
      const criticMatch = block.match(/data-award="([^"]+)"/)

      if (!scoreMatch || !criticMatch) {
        return null
      }

      const rawScore = stripHtml({ value: scoreMatch[1] })
      if (!/^\d+$/.test(rawScore)) {
        return null
      }

      const maxScoreMatch = block.match(/(?:&nbsp;|\s)*\/(?:&nbsp;|\s)*(\d+)/)
      const maxScore = maxScoreMatch ? Number.parseInt(maxScoreMatch[1], 10) : 100
      const parsedScore = Number.parseInt(rawScore, 10)
      const normalizedScore = normalizeScore({ score: parsedScore, maxScore })
      const sourceUrl = extractSourceUrl({ block }) || fallbackUrl

      const noteMatch = block.match(/<div class="pt-2">([\s\S]*?)<\/div>/)
      const note = noteMatch ? stripHtml({ value: noteMatch[1] }) : undefined

      return withOptionalNote({
        criticName: decodeHtmlEntities({ value: criticMatch[1] }),
        score: normalizedScore,
        maxScore,
        sourceUrl,
        note: note && note.length > 0 ? note : undefined,
      })
    })
    .filter((item): item is WineSearcherCriticScore => item !== null)

  return scores
}

export const searchWineSearcherCriticScoresWithMeta = async (
  query: string,
  vintage?: number | null
): Promise<WineSearcherCriticScoresResult | null> => {
  try {
    const encodedQuery = encodeURIComponent(query.replace(/\s+/g, '+'))
    const vintageSegment = vintage || 1
    const initialUrl = `https://www.wine-searcher.com/find/${encodedQuery}/${vintageSegment}`

    const initialResponse = await fetch(initialUrl, {
      headers: HEADERS,
      redirect: 'manual',
    })

    const cookies = extractCookies(initialResponse)
    const redirectUrl = initialResponse.headers.get('location')
    const targetUrl = redirectUrl
      ? new URL(redirectUrl, initialUrl).toString()
      : initialUrl

    const finalResponse = await fetch(targetUrl, {
      headers: {
        ...HEADERS,
        Cookie: cookies,
      },
    })

    if (!finalResponse.ok) {
      return null
    }

    const html = await finalResponse.text()
    const canonicalMatch = html.match(/<link href="([^"]+)" rel="canonical">/)
    const canonicalUrl = canonicalMatch ? canonicalMatch[1] : targetUrl
    const wineName = extractWineName({ html })
    const perCriticScores = extractCriticScoresFromHtml({ html, fallbackUrl: canonicalUrl })

    const scores = perCriticScores.length > 0
      ? perCriticScores
      : (() => {
          const aggregateScore = extractAggregateCriticScore({ html })
          if (!aggregateScore) {
            return []
          }

          return [{
            criticName: 'Wine-Searcher Aggregate',
            score: aggregateScore,
            maxScore: 100,
            sourceUrl: canonicalUrl,
          }]
        })()

    return {
      wineName,
      url: canonicalUrl,
      scores,
    }
  } catch (error) {
    console.error('Wine-Searcher critic score search error:', error)
    return null
  }
}

export const searchWineSearcherCriticScores = async (
  query: string,
  vintage?: number | null
): Promise<WineSearcherCriticScore[]> => {
  const result = await searchWineSearcherCriticScoresWithMeta(query, vintage)
  return result?.scores || []
}
