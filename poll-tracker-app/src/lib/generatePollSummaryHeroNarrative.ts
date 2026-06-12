import dayjs from 'dayjs'
import type { AppLocale } from '../i18n/localeContext'
import type { RollingWindowRow } from './pollRollingWindow'

/**
 * Fallback hero text when `poll-summary-narrative.json` has no `background` for the locale.
 * Keep aligned with DEFAULT_BACKGROUND_* in scripts/build-poll-summary-narrative.mjs.
 */
export const EDITORIAL_BACKGROUND_EN =
  "With the Knesset dissolution bill through its unanimous first reading but coalition factions still fighting over an election window of September 8–October 20, the race opens amid the Haredi parties' break with Netanyahu over failed draft-exemption legislation and an emerging deal to advance Basic Law: Torah Study, while Lebanon remains on the boil after Hezbollah rejected the latest U.S.-brokered conditional ceasefire, as Bennett and Lapid's united Yahad ticket competes with Eisenkot's Yashar in a crowded field where latest polls still show the opposition and anti-Netanyahu camp ahead at most major outlets."

export const EDITORIAL_BACKGROUND_HE =
  'רקע: לאחר שהצעת פיזור הכנסת עברה בקריאה ראשונה ללא התנגדות והמחלוקת נמשכת על מועד הבחירות בין 8 בספטמבר ל-20 באוקטובר, מסע הבחירות נפתח על רקע הקרע בין המפלגות החרדיות לנתניהו סביב כישלון חוק הפטור מגיוס ומגע לאישור חוק יסוד: לימוד תורה, תוך לחימה מתמשכת בלבנון לאחר שחיזבאללה דחה את הפסקת האש המותנית האחרונה בתיווך אמריקני, כשבנט ולפיד מתמודדים ברשימת יחד מאוחדת מול ישר! בראשות אייזנקוט, ובסקרים האחרונים נשמרת עדיפות האופוזיציה והגוש נגד נתניהו אצל רוב הסוקרים.'

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
