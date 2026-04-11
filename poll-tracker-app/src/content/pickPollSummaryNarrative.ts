import type { AppLocale } from '../i18n/localeContext'
import doc from './poll-summary-narrative.json'

export type PollSummaryNarrativePick = {
  background: string
  trendBullets: string[]
  asOfUtc?: string
}

function localeBlock(locale: AppLocale) {
  const loc = doc.locales as Record<
    string,
    { background?: string; trendBullets?: string[] }
  >
  return locale === 'he' ? loc.he : loc.en
}

/**
 * Editorial copy for the poll summary panel.
 * When refreshing for new polls/events, follow `.cursor/skills/israel-poll-rolling-narrative/SKILL.md`.
 */
export function pickPollSummaryNarrative(locale: AppLocale): PollSummaryNarrativePick | null {
  const primary = localeBlock(locale)
  const fallback = localeBlock('en')
  const background =
    (primary?.background ?? '').trim() || (fallback?.background ?? '').trim()
  const primaryBullets = Array.isArray(primary?.trendBullets) ? primary!.trendBullets : []
  const fallbackBullets = Array.isArray(fallback?.trendBullets) ? fallback!.trendBullets : []
  const trendBullets = (primaryBullets.length > 0 ? primaryBullets : fallbackBullets)
    .map((s) => s.trim())
    .filter(Boolean)
  if (!background && trendBullets.length === 0) return null
  const asOf = typeof doc.asOfUtc === 'string' ? doc.asOfUtc.trim() : ''
  return {
    background,
    trendBullets,
    asOfUtc: asOf || undefined,
  }
}
