import dayjs from 'dayjs'
import type { AppLocale } from '../i18n/localeContext'
import type { RollingWindowRow } from './pollRollingWindow'

/**
 * Fallback hero text when `poll-summary-narrative.json` has no `background` for the locale.
 * Keep aligned with DEFAULT_BACKGROUND_* in scripts/build-poll-summary-narrative.mjs.
 */
export const EDITORIAL_BACKGROUND_EN =
  "With Basic Law: Torah Study cleared for a first Knesset reading and Haredi parties holding off early dissolution for the July 17 timetable, Netanyahu's coalition races to pass draft shields, kosher supervision and an Oct. 7 political commission before October elections—while Bennett and Lapid's Yahad ticket faces Eisenkot's Yashar in a field where most major pollsters still show an anti-Netanyahu bloc lead."

export const EDITORIAL_BACKGROUND_HE =
  'רקע: עם אישור קריאה ראשונה לחוק יסוד: לימוד תורה והסכמת המפלגות החרדיות לדחות פיזור מוקדם ל-17 ביולי, הקואליציה מקדמת הגנה על סרבני גיוס, פיקוח כשרות וועדת חקירה מדינית ל-7 באוקטובר לקראת בחירות באוקטובר—בעוד יחד של בנט ולפיד מתמודדת מול ישר! בראשות אייזנקוט, וברוב הסוקרים נשמרת עדיפות גוש אנטי נתניהו.'

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
