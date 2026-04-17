import type { AppLocale } from '../i18n/localeContext'
import {
  formatNarrativeSheetDateDisplay,
  generatePollSummaryBackground,
  rollingWindowLatestPollDateIso,
} from '../lib/generatePollSummaryHeroNarrative'
import type { RollingWindowRow } from '../lib/pollRollingWindow'
import doc from './poll-summary-narrative.json'

/**
 * Live hero reads `locales.*.background` from `poll-summary-narrative.json` when non-empty;
 * otherwise `generatePollSummaryBackground` (TS fallbacks). Trend bullets stay in-app only.
 */
export type PollSummaryNarrativePick = {
  background: string
  asOfUtc?: string
}

function localeBlock(locale: AppLocale) {
  const loc = doc.locales as Record<string, { background?: string; trendBullets?: string[] }>
  return locale === 'he' ? loc.he : loc.en
}

function narrativeAsOfIsoFromJson(): string | undefined {
  const raw = typeof doc.asOfUtc === 'string' ? doc.asOfUtc.trim() : ''
  return raw || undefined
}

/** Hero paragraph for PollSummaryPanel: JSON first, then bundled editorial defaults. */
export function getLivePollSummaryBackground(locale: AppLocale): string {
  const primary = localeBlock(locale)
  const fallback = localeBlock('en')
  const fromJson = (primary?.background ?? '').trim() || (fallback?.background ?? '').trim()
  if (fromJson) return fromJson
  return generatePollSummaryBackground(locale)
}

/**
 * “Context as of …” line: latest poll date in the rolling window when present; otherwise
 * `asOfUtc` from narrative JSON (e.g. after sheet sync before polls load).
 */
export function resolvePollSummaryNarrativeAsOfDisplay(
  rows: RollingWindowRow[],
  locale: AppLocale,
): string | undefined {
  const iso = rollingWindowLatestPollDateIso(rows) ?? narrativeAsOfIsoFromJson()
  if (!iso) return undefined
  return formatNarrativeSheetDateDisplay(iso, locale)
}

/**
 * JSON pick for tooling / tests — same background resolution as `getLivePollSummaryBackground`.
 */
export function pickPollSummaryNarrative(locale: AppLocale): PollSummaryNarrativePick | null {
  const bg = getLivePollSummaryBackground(locale)
  if (!bg.trim()) return null
  return {
    background: bg,
    asOfUtc: narrativeAsOfIsoFromJson(),
  }
}
