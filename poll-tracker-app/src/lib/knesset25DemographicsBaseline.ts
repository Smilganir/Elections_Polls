import baselineData from '../data/knesset25FactionBlocBaseline.json'
import type { KnessetMapFilters } from './knessetSeatDemographics'

/**
 * Knesset 25 roster demographics (120 MKs seated as of 2026-09-09), by faction and bloc.
 * Source: knesset25_faction_bloc_stats.xlsx — not the 2022 elected cohort alone.
 */
export type Knesset25BaselineSlice = {
  n: number
  femalePct: number
  newPct: number
  /** Military service only (regular/career/shortened), as a share of all MKs in the slice. */
  servedPct: number
  avgAge: number
  avgKnessetYears: number
}

export type Knesset25BaselineScope = 'full' | 'party' | 'bloc'

export type Knesset25BaselineResolve = {
  scope: Knesset25BaselineScope
  slice: Knesset25BaselineSlice
}

const FACTION_BASELINE = baselineData.factions as Record<string, Knesset25BaselineSlice>
const BLOC_BASELINE = baselineData.blocs as {
  coalition: Knesset25BaselineSlice
  oppositionMerged: Knesset25BaselineSlice
  oppositionExclArabs: Knesset25BaselineSlice
}
const FULL_BASELINE = baselineData.full as Knesset25BaselineSlice

/** @deprecated Use resolveKnesset25Baseline().slice — kept for imports. */
export const KNESSET_25_DEMOGRAPHICS_BASELINE = {
  femalePct: FULL_BASELINE.femalePct,
  newPct: FULL_BASELINE.newPct,
  servedPct: FULL_BASELINE.servedPct,
  avgAge: FULL_BASELINE.avgAge,
  avgKnessetYears: FULL_BASELINE.avgKnessetYears,
} as const

/** K26 canonical party key → K25 seated faction name (when a slice exists). */
const PARTY_KEY_TO_K25_FACTION: Partial<Record<string, string>> = {
  Likud: 'הליכוד',
  'Yesh Atid': 'יש עתיד',
  Shas: 'ש"ס',
  'Blue & White': 'כחול לבן - המחנה הממלכתי',
  'Religious Zionism': 'הציונות הדתית',
  UTJ: 'יהדות התורה',
  'Yisrael Beiteinu': 'ישראל ביתנו',
  'Otzma Yehudit': 'עוצמה יהודית',
  "Hadash Ta'al": 'חד"ש-תע"ל',
  "Ra'am": 'רע"ם',
  'The Democrats': 'העבודה',
  "Bennett's Party": 'הימין הממלכתי',
}

function factionBaselineByPartyKey(partyKey: string): Knesset25BaselineSlice | null {
  const factionName = PARTY_KEY_TO_K25_FACTION[partyKey]
  if (!factionName) return null
  return FACTION_BASELINE[factionName] ?? null
}

/**
 * Pick the K25 baseline slice for hero-chart badges.
 * - No filters → full Knesset
 * - Party filter → matching K25 faction (if mapped)
 * - Bloc filter → coalition / opposition bloc
 * - Demographic-only filters → none (hide badge)
 */
export function resolveKnesset25Baseline(
  filters: KnessetMapFilters,
  mergeArabsWithOpposition = false,
): Knesset25BaselineResolve | null {
  const partyFilter = filters.find((f) => f.kind === 'party')
  const segmentFilter = filters.find((f) => f.kind === 'segment')
  const hasDemographicOnly = filters.some(
    (f) => f.kind !== 'party' && f.kind !== 'segment',
  )

  if (partyFilter) {
    const slice = factionBaselineByPartyKey(partyFilter.partyKey)
    if (!slice) return null
    return { scope: 'party', slice }
  }

  if (segmentFilter) {
    if (segmentFilter.segment === 'Coalition') {
      return { scope: 'bloc', slice: BLOC_BASELINE.coalition }
    }
    const slice = mergeArabsWithOpposition
      ? BLOC_BASELINE.oppositionMerged
      : BLOC_BASELINE.oppositionExclArabs
    return { scope: 'bloc', slice }
  }

  if (hasDemographicOnly) return null

  return { scope: 'full', slice: FULL_BASELINE }
}

/** Percentage-point delta for share metrics (current & baseline are 0–1 portions). */
export function knessetSharePpDelta(
  current: number | null | undefined,
  baseline: number,
): number | null {
  if (current == null || !Number.isFinite(current)) return null
  return (current - baseline) * 100
}

/** Relative % change for scalar averages (age, tenure years). */
export function knessetScalarPctDelta(
  current: number | null | undefined,
  baseline: number,
): number | null {
  if (current == null || !Number.isFinite(current) || baseline === 0) return null
  return ((current - baseline) / baseline) * 100
}

export function formatKnessetPpDelta(deltaPp: number): string {
  const rounded = Math.round(deltaPp * 10) / 10
  const sign = rounded > 0 ? '+' : ''
  return `${sign}${rounded}pp`
}

export function formatKnessetScalarPctDelta(deltaPct: number): string {
  const rounded = Math.round(deltaPct * 10) / 10
  const sign = rounded > 0 ? '+' : ''
  return `${sign}${rounded}%`
}
