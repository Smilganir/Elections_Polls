import dayjs from 'dayjs'
import type { AppLocale } from '../i18n/localeContext'
import type { RollingWindowRow } from './pollRollingWindow'

/**
 * Fallback hero text when `poll-summary-narrative.json` has no `background` for the locale.
 * Keep aligned with DEFAULT_BACKGROUND_* in scripts/build-poll-summary-narrative.mjs.
 */
export const EDITORIAL_BACKGROUND_EN =
  "With Haredi leaders' agreement with Netanyahu to target October 20 elections and advance Basic Law: Torah Study and protections against arresting draft evaders before the Knesset is expected to dissolve by July 17—while backing an Oct. 7 political commission and the attorney-general split—the race unfolds amid fragile U.S.-brokered Lebanon ceasefire talks after Hezbollah rejected the latest conditional truce, as Bennett and Lapid's united Yahad ticket competes with Eisenkot's Yashar in a crowded field where the anti-Netanyahu camp still leads at most major pollsters."

export const EDITORIAL_BACKGROUND_HE =
  'רקע: לאחר הסכמה בין המנהיגים החרדיים לנתניהו על בחירות ב-20 באוקטובר וקידום חוק יסוד: לימוד תורה והגנה מפני מעצרי סרבני גיוס עד פיזור הכנסת הצפוי ב-17 ביולי—תוך תמיכה בוועדת חקירה מדינית ל-7 באוקטובר ובפיצול תפקיד היועמ"ש—מסע הבחירות מתנהל על רקע מגעים שבריריים לפסקת אש בלבנון בתיווך אמריקני לאחר שחיזבאללה דחה את העסקה המותנית האחרונה, כשיחד של בנט ולפיד מתמודדת מול ישר! בראשות אייזנקוט, וברוב הסוקרים נשמרת עדיפות גוש אנטי נתניהו.'

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
