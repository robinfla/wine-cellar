import { wineCriticScores } from '~/server/db/schema'

type Critic = typeof wineCriticScores.$inferInsert['critic']

const CRITIC_MAP: Record<string, Critic> = {
  'robert parker the wine advocate': 'robert_parker',
  'robert parker': 'robert_parker',
  'wine advocate': 'robert_parker',
  'wine spectator': 'wine_spectator',
  'james suckling': 'james_suckling',
  'decanter': 'decanter',
  'jancis robinson': 'jancis_robinson',
  'wine enthusiast': 'wine_enthusiast',
  'vinous': 'vinous',
  'antonio galloni': 'vinous',
}

const normalizeCriticName = ({ criticName }: { criticName: string }) => {
  return criticName
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export const mapCriticNameToEnum = ({ criticName }: { criticName: string }): Critic => {
  const normalized = normalizeCriticName({ criticName })
  return CRITIC_MAP[normalized] || 'other'
}
