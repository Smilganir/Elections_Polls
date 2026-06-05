import dayjs from 'dayjs'
import type { AppLocale } from '../i18n/localeContext'
import type { RollingWindowRow } from './pollRollingWindow'

/**
 * Fallback hero text when `poll-summary-narrative.json` has no `background` for the locale.
 * Keep aligned with DEFAULT_BACKGROUND_* in scripts/build-poll-summary-narrative.mjs.
 */
export const EDITORIAL_BACKGROUND_EN =
  "With the Knesset's self-dissolution bill through its first reading and the vote set to be moved up from October 27 into a September 8–October 20 window, the campaign opens amid the Haredi parties' break with Netanyahu over the failed draft-exemption law and a still-raging Lebanon front where the latest U.S.-brokered ceasefire was just rejected by Hezbollah, while Bennett and Lapid run a united Yahad ticket led by Bennett that folds in Yesh Atid, with latest polls still showing the opposition and anti-Netanyahu camp ahead across most major outlets."

export const EDITORIAL_BACKGROUND_HE =
  'רקע: לאחר שהצעת החוק לפיזור הכנסת עברה בקריאה ראשונה ומועד הבחירות צפוי לעבור מ-27 באוקטובר לחלון שבין 8 בספטמבר ל-20 באוקטובר, מסע הבחירות נפתח על רקע הקרע בין המפלגות החרדיות לנתניהו סביב כישלון חוק הגיוס ולחימה נמשכת בלבנון שבה הפסקת האש האחרונה בתיווך אמריקני נדחתה זה עתה על ידי חיזבאללה, כשבנט ולפיד מתמודדים ברשימת יחד מאוחדת בראשות בנט שמכניסה את יש עתיד למסע נגד נתניהו, ובסקרים האחרונים נשמרת עדיפות האופוזיציה והגוש נגד נתניהו אצל רוב הסוקרים.'

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
