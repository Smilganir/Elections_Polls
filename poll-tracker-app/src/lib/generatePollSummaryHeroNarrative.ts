import dayjs from 'dayjs'
import type { AppLocale } from '../i18n/localeContext'
import type { RollingWindowRow } from './pollRollingWindow'

/**
 * Editorial frame — keep aligned with DEFAULT_BACKGROUND_* in scripts/build-poll-summary-narrative.mjs
 * and locales in poll-summary-narrative.json (sheet sync / drafts).
 */
export const EDITORIAL_BACKGROUND_EN =
  'The run-up to the October vote still dominates—budget passed, Knesset on recess until May—alongside steady security news and the Haredi draft debate, all of which can help explain why Likud and the far right look a little softer in some polls.'

export const EDITORIAL_BACKGROUND_HE =
  'רקע: המרוץ לבחירות באוקטובר, תקציב שאושר, כנסת בפגרה עד מאי, וחדשות הביטחון יחד עם הדיון גיוס חרדים—כולם עשויים להסביר ריכוך קל בליכוד ובימין בחלק מהסקרים.'

function maxIsoDateInRollingRows(rows: RollingWindowRow[]): string | null {
  if (rows.length === 0) return null
  let max = rows[0].current.date
  for (let i = 1; i < rows.length; i++) {
    const d = rows[i].current.date
    if (d.localeCompare(max) > 0) max = d
  }
  return max
}

export function formatNarrativeSheetDateDisplay(iso: string, locale: AppLocale): string {
  return dayjs(iso).format(locale === 'he' ? 'DD/MM/YYYY' : 'M/D/YYYY')
}

/** Hero background under the aggregate bar: editorial frame only (locale). Sheet/window context stays in subtitle + as-of line. */
export function generatePollSummaryBackground(locale: AppLocale): string {
  return locale === 'he' ? EDITORIAL_BACKGROUND_HE : EDITORIAL_BACKGROUND_EN
}

/** Latest poll date in the rolling window, for the small-caps “Context as of …” line. */
export function rollingWindowLatestDateDisplay(
  rows: RollingWindowRow[],
  locale: AppLocale,
): string | undefined {
  const iso = maxIsoDateInRollingRows(rows)
  if (!iso) return undefined
  return formatNarrativeSheetDateDisplay(iso, locale)
}
