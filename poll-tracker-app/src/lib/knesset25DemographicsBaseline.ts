/**
 * Knesset 25 (elected Nov 2022, sworn in Nov 2022) **full-roster** demographic baselines
 * for hero-chart “vs K25” badges. Compared only when no map filters are active —
 * per-party K25 slices are not yet modeled. Percentage donuts use percentage-point (pp)
 * deltas; averages use relative % change.
 *
 * Sources:
 * - Women (29/120): IDI preview — https://www.idi.org.il/articles/46426
 * - New MKs (23/120 at inauguration): IDI — https://www.idi.org.il/articles/46426
 * - Avg age (50.5): IDI EN — https://en.idi.org.il/articles/46412
 * - Avg Knesset tenure (~7.3y): Knesset Research Center gender brief (weighted
 *   male 7y7m, female 6y4m over 91M/29F) — https://main.knesset.gov.il/EN/activity/mmm/Years%20of%20Parliamentary%20Service%20Worldwide%20and%20in%20the%20Knesset%20A%20Gender%20Perspective%20(Abstract).pdf
 * - Military / national service served share (92/120): ICE/i24 analysis of the
 *   37th-government MK roster, incl. national service — https://www.ice.co.il/research/news/article/960385
 */
export const KNESSET_25_DEMOGRAPHICS_BASELINE = {
  femalePct: 29 / 120,
  newPct: 23 / 120,
  servedPct: 92 / 120,
  avgAge: 50.5,
  avgKnessetYears: 7.3,
} as const

/** Percentage-point delta for share metrics (current & baseline are 0–1 portions). */
export function knessetSharePpDelta(
  current: number | null | undefined,
  baseline: number,
): number | null {
  if (current == null || !Number.isFinite(current)) return null
  return (current - baseline) * 100
}

/** Relative % change for scalar averages (age, tenure years). */
export function knessetScalarPctDelta(
  current: number | null | undefined,
  baseline: number,
): number | null {
  if (current == null || !Number.isFinite(current) || baseline === 0) return null
  return ((current - baseline) / baseline) * 100
}

export function formatKnessetPpDelta(deltaPp: number): string {
  const rounded = Math.round(deltaPp * 10) / 10
  const sign = rounded > 0 ? '+' : ''
  return `${sign}${rounded}pp`
}

export function formatKnessetScalarPctDelta(deltaPct: number): string {
  const rounded = Math.round(deltaPct * 10) / 10
  const sign = rounded > 0 ? '+' : ''
  return `${sign}${rounded}%`
}
