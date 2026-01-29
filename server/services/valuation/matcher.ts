const levenshteinDistance = (a: string, b: string): number => {
  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

const normalizeString = (str: string): string => {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const stringSimilarity = (a: string, b: string): number => {
  const normA = normalizeString(a)
  const normB = normalizeString(b)

  if (normA === normB) return 1.0

  const maxLen = Math.max(normA.length, normB.length)
  if (maxLen === 0) return 1.0

  const distance = levenshteinDistance(normA, normB)
  return 1 - distance / maxLen
}

export interface MatchCandidate {
  sourceId: string
  sourceName: string
  sourceWinery: string
  sourceVintage?: number
  price?: number
  priceLow?: number
  priceHigh?: number
  sourceUrl?: string
}

export interface MatchResult {
  candidate: MatchCandidate
  confidence: number
  source: 'vivino' | 'wine-searcher'
}

export const CONFIDENCE_THRESHOLD = 0.85
export const REVIEW_THRESHOLD = 0.60

export const calculateMatchConfidence = (
  wine: { name: string; producerName: string },
  vintage: number | null,
  candidate: MatchCandidate
): number => {
  const nameSimilarity = stringSimilarity(wine.name, candidate.sourceName)
  const producerSimilarity = stringSimilarity(wine.producerName, candidate.sourceWinery)

  let vintageSimilarity = 1.0
  if (vintage && candidate.sourceVintage) {
    vintageSimilarity = vintage === candidate.sourceVintage ? 1.0 : 0.0
  } else if (vintage !== null && candidate.sourceVintage === undefined) {
    vintageSimilarity = 0.5
  }

  const confidence =
    nameSimilarity * 0.50 +
    producerSimilarity * 0.35 +
    vintageSimilarity * 0.15

  return Math.round(confidence * 100) / 100
}

export const findBestMatch = (
  wine: { name: string; producerName: string },
  vintage: number | null,
  candidates: MatchCandidate[],
  source: 'vivino' | 'wine-searcher'
): MatchResult | null => {
  if (candidates.length === 0) return null

  const results = candidates.map(candidate => ({
    candidate,
    confidence: calculateMatchConfidence(wine, vintage, candidate),
    source,
  }))

  results.sort((a, b) => b.confidence - a.confidence)

  return results[0]
}
