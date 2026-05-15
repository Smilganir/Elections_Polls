import dayjs from 'dayjs'
import type { AppLocale } from '../i18n/localeContext'
import type { RollingWindowRow } from './pollRollingWindow'

/**
 * Fallback hero text when `poll-summary-narrative.json` has no `background` for the locale.
 * Keep aligned with DEFAULT_BACKGROUND_* in scripts/build-poll-summary-narrative.mjs.
 */
export const EDITORIAL_BACKGROUND_EN =
  'The October 2026 election countdown unfolds as the U.S.–Iran ceasefire framework frays and talks turn bitter over terms, alongside renewed escalation in Gaza and friction in Washington, while Bennett and Lapid unite Yahad as a Bennett-led ticket that folds Yesh Atid into the anti-Netanyahu front, with latest polls still showing the opposition and anti-bloc camp ahead across most major outlets.'

export const EDITORIAL_BACKGROUND_HE =
  'רקע: ספירה לאחור לבחירות אוקטובר 2026 על רקע פסקת אש אמריקנית–איראנית רעועה ומו״מ סוער סביב התנאים, לצד הסלמה בעזה ומתיחות בוושינגטון, כשבנט ולפיד מאחדים את יחד בראשות בנט ומכניסים את יש עתיד למסע נגד נתניהו, ובסקרים האחרונים נשמרת עדיפות האופוזיציה וגוש השותפים נגד הבלוק אצל רוב הסוקרים.'

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
