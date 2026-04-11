import type { AppLocale } from '../i18n/localeContext'
import doc from './poll-summary-narrative.json'

/**
 * Draft / tooling: reads `poll-summary-narrative.json` for sync scripts and parity checks.
 * The live hero paragraph uses `generatePollSummaryBackground(locale)` only; sheet date is the separate as-of line.
 * Trend bullets are always in-app (`generatePollSummaryTrendBullets`).
 */
export type PollSummaryNarrativePick = {
  background: string
  asOfUtc?: string
}

function localeBlock(locale: AppLocale) {
  const loc = doc.locales as Record<string, { background?: string; trendBullets?: string[] }>
  return locale === 'he' ? loc.he : loc.en
}

/**
 * JSON pick for scripts or future tooling — not wired into PollSummaryPanel in production.
 * When refreshing the editorial frame, update `EDITORIAL_BACKGROUND_*` in
 * `generatePollSummaryHeroNarrative.ts` and mirror in `build-poll-summary-narrative.mjs` DEFAULT_BACKGROUND_*.
 */
export function pickPollSummaryNarrative(locale: AppLocale): PollSummaryNarrativePick | null {
  const primary = localeBlock(locale)
  const fallback = localeBlock('en')
  const background =
    (primary?.background ?? '').trim() || (fallback?.background ?? '').trim()
  if (!background) return null
  const asOf = typeof doc.asOfUtc === 'string' ? doc.asOfUtc.trim() : ''
  return {
    background,
    asOfUtc: asOf || undefined,
  }
}
