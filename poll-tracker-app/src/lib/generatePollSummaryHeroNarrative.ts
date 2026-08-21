import dayjs from 'dayjs'
import type { AppLocale } from '../i18n/localeContext'
import type { RollingWindowRow } from './pollRollingWindow'

/**
 * Fallback hero text when `poll-summary-narrative.json` has no `background` for the locale.
 * Keep aligned with DEFAULT_BACKGROUND_* in scripts/build-poll-summary-narrative.mjs.
 */
export const EDITORIAL_BACKGROUND_EN =
  "After the July 17 dissolution set October 27 elections, Netanyahu frames the race on security and stalled Haredi draft legislation while Eisenkot's surging Yashar and Bennett–Lapid's Yahad battle for the opposition lead—yet most pollsters still show an anti-Netanyahu bloc ahead without a 61-seat majority unless Arab parties join."

export const EDITORIAL_BACKGROUND_HE =
  'רקע: עם פיזור הכנסת ב-17 ביולי וספירה לאחור לבחירות ב-27 באוקטובר, נתניהו מציב ביטחון וחקיקת פטור חרדים מגיוס במרכז המערכה, בעוד ישר! בראשות אייזנקוט ויחד של בנט ולפיד מתחרות על ראשות האופוזיציה—וברוב הסוקרים נשמרת עדיפות גוש אנטי נתניהו ללא רוב של 61 מנדטים ללא מפלגות ערביות.'

function maxIsoDateInRollingRows(rows: RollingWindowRow[]): string | null {
  if (rows.length === 0) return null
  let max = rows[0].current.date
  for (let i = 1; i < rows.length; i++) {
    const d = rows[i].current.date
    if (d.localeCompare(max) > 0) max = d
  }
  return max
}

/** Latest poll date (ISO `YYYY-MM-DD`…) inside the rolling window; used with JSON `asOfUtc` fallback. */
export function rollingWindowLatestPollDateIso(rows: RollingWindowRow[]): string | null {
  return maxIsoDateInRollingRows(rows)
}

export function formatNarrativeSheetDateDisplay(iso: string, locale: AppLocale): string {
  return dayjs(iso).format(locale === 'he' ? 'DD/MM/YYYY' : 'M/D/YYYY')
}

/** Fallback hero background when JSON `locales.*.background` is empty (bundled defaults). */
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
