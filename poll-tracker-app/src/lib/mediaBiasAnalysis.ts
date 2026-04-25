/**
 * mediaBiasAnalysis.ts — pure statistical engine for the Media Bias Panel.
 *
 * No React, no side effects, no new dependencies.
 * All functions are referentially transparent given their inputs.
 *
 * Pipeline:
 *   harmonizeArabList → buildPartyBaselineSeries → computeResiduals
 *     → computeOutletAnomalies
 *     → computeHouseEffects → computeBlocTilt
 *   computeHistoricalAccuracy (isolated; reads only historicalPolls2022.ts)
 */

import type {
  UnpivotRow,
  PartyDimRow,
  Segment,
  ResidualRow,
  OutletAnomaly,
  HouseEffectCell,
  BlocTilt,
  HistoricalAccuracyResult,
} from '../types/data'
import { knesset2022FinalPolls, knesset2022Actual } from './historicalPolls2022'

// ─── Constants ───────────────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000

/** Source party keys that are collapsed into the synthetic combined party. */
const JOINT_ARAB = 'Joint Arab List'
const HADASH_TAAL = "Hadash Ta'al"
const RAAM = "Ra'am"
const BALAD = 'Balad'

/** Synthetic party key emitted after Arab-list harmonization. */
export const ARAB_COMBINED = 'Arab List (combined)'

const ARAB_SOURCE_PARTIES = new Set([JOINT_ARAB, HADASH_TAAL, RAAM, BALAD])

/**
 * The Israel electoral threshold is 3.25 %, granting 4 seats once crossed.
 * Moving from 4 → 0 or 0 → 4 is largely a discretization artifact; we
 * dampen those jumps by this divisor when computing statistical residuals.
 */
export const THRESHOLD_DAMPENER = 4

// ─── Threshold dampening ─────────────────────────────────────────────────────

/**
 * Returns the residual used for σ, μ, z-scores, t-tests, p, and pAdj.
 *
 * A (false death):        outletSeats === 0  AND 0 < baseline ≤ 6
 * B (false resurrection): 4 ≤ outletSeats ≤ 5  AND baseline < 2
 * If A or B: statResidual = (outletSeats − baseline) / THRESHOLD_DAMPENER
 * Else:      statResidual = outletSeats − baseline   (= rawResidual)
 */
export function dampenResidual(outletSeats: number, baseline: number): number {
  const A = outletSeats === 0 && baseline > 0 && baseline <= 6
  const B = outletSeats >= 4 && outletSeats <= 5 && baseline < 2
  const raw = outletSeats - baseline
  return A || B ? raw / THRESHOLD_DAMPENER : raw
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function parseDate(s: string): number {
  const m = String(s).trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return NaN
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

// ─── harmonizeArabList ────────────────────────────────────────────────────────

/**
 * Pre-processes UnpivotRow[] so that Joint Arab List / Hadash Ta'al / Ra'am /
 * Balad are replaced by a single synthetic party "Arab List (combined)" — one
 * row per (outlet, pollId).
 *
 * Selection rule:
 *   1. If jointArabList is finite AND > 0  →  use it (pre-split era or unified
 *      polls that already aggregate all Arab parties including Balad).
 *   2. Else if any of hadashTaal / raam / balad is finite  →  sum them
 *      (missing terms treated as 0; covers post-split polls where each runs
 *      separately).
 *   3. Else  →  drop (no row emitted; a true gap beats a silent zero).
 *
 * When combine=false the raw rows are returned unchanged (panel "Split Arab
 * parties" toggle).
 */
export function harmonizeArabList(
  rows: UnpivotRow[],
  { combine = true }: { combine?: boolean } = {},
): UnpivotRow[] {
  if (!combine) return rows

  // Partition: arab-source rows grouped by (outlet, pollId); all others pass through.
  const nonArabRows: UnpivotRow[] = []
  const arabGroups = new Map<string, UnpivotRow[]>()

  for (const row of rows) {
    if (!ARAB_SOURCE_PARTIES.has(row.party)) {
      nonArabRows.push(row)
      continue
    }
    const key = `${row.mediaOutlet}\x00${row.pollId}`
    let group = arabGroups.get(key)
    if (!group) {
      group = []
      arabGroups.set(key, group)
    }
    group.push(row)
  }

  const combinedRows: UnpivotRow[] = []

  for (const group of arabGroups.values()) {
    const ref = group[0]
    const jointRow = group.find(r => r.party === JOINT_ARAB)
    const hadashRow = group.find(r => r.party === HADASH_TAAL)
    const raamRow = group.find(r => r.party === RAAM)
    const baladRow = group.find(r => r.party === BALAD)

    const jointVal = jointRow && Number.isFinite(jointRow.votes) ? jointRow.votes : -Infinity
    const hadashFinite = hadashRow !== undefined && Number.isFinite(hadashRow.votes)
    const raamFinite = raamRow !== undefined && Number.isFinite(raamRow.votes)
    const baladFinite = baladRow !== undefined && Number.isFinite(baladRow.votes)

    let combinedSeats: number | null

    if (jointVal > 0) {
      // Rule 1: explicit joint-list number (already aggregates Balad)
      combinedSeats = jointVal
    } else if (hadashFinite || raamFinite || baladFinite) {
      // Rule 2: sum the split parties (missing terms treated as 0)
      const h = hadashFinite ? hadashRow!.votes : 0
      const r = raamFinite ? raamRow!.votes : 0
      const b = baladFinite ? baladRow!.votes : 0
      combinedSeats = h + r + b
    } else {
      // Rule 3: no usable data → drop; emitting 0 would depress the baseline
      combinedSeats = null
    }

    if (combinedSeats !== null) {
      combinedRows.push({
        ...ref,
        party: ARAB_COMBINED,
        votes: combinedSeats,
      })
    }
  }

  return [...nonArabRows, ...combinedRows]
}

// ─── buildPartyBaselineSeries ─────────────────────────────────────────────────

/**
 * Computes a 30-day rolling cross-outlet mean seat count for one party.
 *
 * For each date D that appears anywhere in `rows`, the baseline is the mean
 * of all rows for `party` whose date falls in [D − windowDays, D] (inclusive,
 * calendar days).  Non-finite votes are skipped.  If no party rows fall in the
 * window for a given date, that date is omitted from the returned Map (no NaN).
 *
 * The caller builds a Map<party, Map<date, baseline>> by calling this once per
 * party and passing the result to computeResiduals.
 */
export function buildPartyBaselineSeries(
  rows: UnpivotRow[],
  party: string,
  windowDays = 30,
): Map<string, number> {
  const windowMs = windowDays * MS_PER_DAY

  // Collect and sort party rows with parsed timestamps.
  const partyRows = rows
    .filter(r => r.party === party && Number.isFinite(r.votes))
    .map(r => ({ votes: r.votes, ts: parseDate(r.date) }))
    .filter(r => Number.isFinite(r.ts))
    .sort((a, b) => a.ts - b.ts)

  // Collect all unique dates across the full dataset, sorted.
  const allDates = [...new Set(rows.map(r => r.date))]
    .map(d => ({ date: d, ts: parseDate(d) }))
    .filter(d => Number.isFinite(d.ts))
    .sort((a, b) => a.ts - b.ts)

  const result = new Map<string, number>()

  // Sliding-window two-pointer: O(n + d).
  let left = 0
  let right = 0

  for (const { date, ts: dTs } of allDates) {
    // Advance left: drop rows older than the window start.
    while (left < partyRows.length && partyRows[left].ts < dTs - windowMs) {
      left++
    }
    // Advance right: include rows up to and including this date.
    while (right < partyRows.length && partyRows[right].ts <= dTs) {
      right++
    }

    const count = right - left
    if (count === 0) continue

    let sum = 0
    for (let i = left; i < right; i++) sum += partyRows[i].votes
    result.set(date, sum / count)
  }

  return result
}

// ─── computeResiduals ────────────────────────────────────────────────────────

/**
 * Enriches each row with `baseline`, `rawResidual`, and `statResidual` using
 * a **leave-one-out (LOO)** cross-outlet baseline.
 *
 * For every (outlet, party) pair the baseline is the rolling cross-outlet mean
 * computed from *all other outlets* — the focal outlet's own readings are
 * excluded.  This prevents a biased outlet from inflating (or suppressing) its
 * own baseline, which would mask its true house effect.
 *
 * Complexity: O(outlets × parties × (rows + dates)).  Typical Israeli poll
 * data (≤ 10 outlets, ≤ 25 parties, ≤ 6 000 rows) runs in < 30 ms.
 *
 * Rows whose LOO baseline is undefined for their date (the window contained
 * zero samples for that party from the other outlets) are dropped.
 */
export function computeResiduals(
  rows: UnpivotRow[],
  windowDays = 30,
): ResidualRow[] {
  const outlets = [...new Set(rows.map(r => r.mediaOutlet))]
  const parties = [...new Set(rows.filter(r => Number.isFinite(r.votes)).map(r => r.party))]

  // Build LOO baseline map: `${outlet}\x00${party}` → Map<dateStr, baseline>
  const looMap = new Map<string, Map<string, number>>()
  for (const outlet of outlets) {
    const otherRows = rows.filter(r => r.mediaOutlet !== outlet)
    for (const party of parties) {
      looMap.set(`${outlet}\x00${party}`, buildPartyBaselineSeries(otherRows, party, windowDays))
    }
  }

  const result: ResidualRow[] = []
  for (const row of rows) {
    if (!Number.isFinite(row.votes)) continue
    const dateMap = looMap.get(`${row.mediaOutlet}\x00${row.party}`)
    if (!dateMap) continue
    const baseline = dateMap.get(row.date)
    if (baseline === undefined) continue
    result.push({
      ...row,
      baseline,
      rawResidual: row.votes - baseline,
      statResidual: dampenResidual(row.votes, baseline),
    })
  }
  return result
}

// ─── computeOutletAnomalies ───────────────────────────────────────────────────

/**
 * Flags single polls whose `statResidual` is an outlier for their
 * (outlet, party) distribution.
 *
 * Outlet-level floor: before computing per-party μ/σ, the outlet's TOTAL
 * distinct poll count (across all parties) must be ≥ minN.  Outlets below this
 * floor are excluded entirely — none of their polls appear in the anomaly list.
 *
 * For each eligible (outlet, party) pair, we compute μ and σ of statResidual
 * over the full history.  Any row where |statResidual − μ| / σ ≥ zThreshold is
 * returned as an OutletAnomaly.  The anomaly carries both rawResidual (seats,
 * for display) and z (computed from statResidual, for ranking).
 *
 * `minN` and `zThreshold` are pure inputs — changing them from the panel header
 * re-calls this function cheaply (no baseline recomputation needed).
 */
export function computeOutletAnomalies(
  residualRows: ResidualRow[],
  { zThreshold = 2.5, minN = 6 }: { zThreshold?: number; minN?: number } = {},
): OutletAnomaly[] {
  // Count distinct (pollId, date, mediaOutlet) triples per outlet.
  const outletPollSets = new Map<string, Set<string>>()
  for (const row of residualRows) {
    let set = outletPollSets.get(row.mediaOutlet)
    if (!set) {
      set = new Set()
      outletPollSets.set(row.mediaOutlet, set)
    }
    set.add(`${row.pollId}\x00${row.date}\x00${row.mediaOutlet}`)
  }

  const eligibleOutlets = new Set<string>()
  for (const [outlet, polls] of outletPollSets) {
    if (polls.size >= minN) eligibleOutlets.add(outlet)
  }

  // Group eligible rows by (outlet, party).
  const groups = new Map<string, ResidualRow[]>()
  for (const row of residualRows) {
    if (!eligibleOutlets.has(row.mediaOutlet)) continue
    const key = `${row.mediaOutlet}\x00${row.party}`
    let g = groups.get(key)
    if (!g) {
      g = []
      groups.set(key, g)
    }
    g.push(row)
  }

  const anomalies: OutletAnomaly[] = []

  for (const rows of groups.values()) {
    const n = rows.length
    if (n < 2) continue

    const statResids = rows.map(r => r.statResidual)
    const mu = statResids.reduce((a, b) => a + b, 0) / n
    const variance = statResids.reduce((a, b) => a + (b - mu) ** 2, 0) / (n - 1)
    const sigma = Math.sqrt(variance)
    // Floor at 1.0 seat: prevents near-zero variance (common for threshold-border
    // parties after dampening) from inflating z-scores to meaningless magnitudes.
    const safeStd = Math.max(sigma, 1.0)

    for (const row of rows) {
      const z = (row.statResidual - mu) / safeStd
      if (Math.abs(z) >= zThreshold) {
        anomalies.push({
          outlet: row.mediaOutlet,
          party: row.party,
          pollId: row.pollId,
          date: row.date,
          seats: row.votes,
          baseline: row.baseline,
          rawResidual: row.rawResidual,
          statResidual: row.statResidual,
          z,
        })
      }
    }
  }

  return anomalies
}

// ─── Statistical helpers ──────────────────────────────────────────────────────

/**
 * Natural log of the gamma function via the Lanczos (g=7) approximation.
 * Accurate to ~15 significant figures for z > 0.
 */
function lgamma(z: number): number {
  // Reflection for z < 0.5
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z)

  z -= 1
  const C = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ]
  let x = C[0]
  for (let i = 1; i < 9; i++) x += C[i] / (z + i)
  const t = z + 7.5
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x)
}

/**
 * Regularized incomplete beta function I_x(a, b) via the Lentz continued-
 * fraction algorithm (Numerical Recipes §6.4).  Returns values in [0, 1].
 */
function ibeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  // Symmetry swap for better convergence when x > (a+1)/(a+b+2).
  if (x > (a + 1) / (a + b + 2)) return 1 - ibeta(1 - x, b, a)

  const lbeta = lgamma(a) + lgamma(b) - lgamma(a + b)
  const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lbeta) / a

  const EPS = 1e-10
  const fpmin = 1e-300
  const MAX_ITER = 200

  let c = 1
  let d = 1 - (a + b) * x / (a + 1)
  if (Math.abs(d) < fpmin) d = fpmin
  d = 1 / d
  let h = d

  for (let m = 1; m <= MAX_ITER; m++) {
    const m2 = 2 * m

    // Even step
    let aa = (m * (b - m) * x) / ((a - 1 + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < fpmin) d = fpmin
    c = 1 + aa / c
    if (Math.abs(c) < fpmin) c = fpmin
    d = 1 / d
    h *= d * c

    // Odd step
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + 1 + m2))
    d = 1 + aa * d
    if (Math.abs(d) < fpmin) d = fpmin
    c = 1 + aa / c
    if (Math.abs(c) < fpmin) c = fpmin
    d = 1 / d
    const del = d * c
    h *= del

    if (Math.abs(del - 1) < EPS) break
  }

  return front * h
}

/**
 * Two-sided p-value P(|T_df| ≥ |t|) for Student's t distribution.
 *
 * Uses the relationship  P = I_{df/(df+t²)}(df/2, 1/2)  where I is the
 * regularized incomplete beta (Hill 1970 / Abramowitz & Stegun §26.7).
 * Returns NaN for invalid inputs; 1 when t = 0.
 */
export function tCdf2Sided(t: number, df: number): number {
  if (!Number.isFinite(t) || !Number.isFinite(df) || df <= 0) return NaN
  if (t === 0) return 1
  const x = df / (df + t * t)
  return ibeta(x, df / 2, 0.5)
}

/**
 * Benjamini-Hochberg FDR correction.
 *
 * Accepts a plain array of p-values and returns the adjusted p-values in the
 * SAME ORDER as the input.  The adjustment is monotone-enforced (step-down).
 * All values are clamped to [0, 1].
 */
export function bhFdr(pvals: number[]): number[] {
  const m = pvals.length
  if (m === 0) return []

  // Tag each p-value with its original index, then sort ascending.
  const indexed = pvals.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p)

  const adjusted = new Array<number>(m)
  let runningMin = 1

  // Walk from largest rank downward; enforce monotonicity.
  for (let k = m - 1; k >= 0; k--) {
    const pAdj = Math.min(runningMin, (indexed[k].p * m) / (k + 1))
    adjusted[indexed[k].i] = Math.max(0, Math.min(1, pAdj))
    runningMin = adjusted[indexed[k].i]
  }

  return adjusted
}

// ─── computeHouseEffects ──────────────────────────────────────────────────────

/**
 * For each (outlet, party) pair in residualRows, computes:
 *   n, meanRawResid, meanStatResid, seStat, t, p
 * then runs BH-FDR only over cells with n ≥ minN.
 *
 * Cells with n < minN receive pAdj = null; the panel renders them greyed-out
 * without a significance border but still shows their raw color and tooltip.
 *
 * The `segment` field is resolved from partiesDim; "Arab List (combined)"
 * is not in Parties Dim so it falls back to 'Opposition' (per spec).
 */
export function computeHouseEffects(
  residualRows: ResidualRow[],
  partiesDim: PartyDimRow[],
  { minN = 10 }: { minN?: number } = {},
): HouseEffectCell[] {
  const segmentMap = new Map<string, Segment>()
  for (const p of partiesDim) segmentMap.set(p.party, p.segment)

  // Group by (outlet, party).
  const groups = new Map<string, ResidualRow[]>()
  for (const row of residualRows) {
    const key = `${row.mediaOutlet}\x00${row.party}`
    let g = groups.get(key)
    if (!g) {
      g = []
      groups.set(key, g)
    }
    g.push(row)
  }

  const cells: HouseEffectCell[] = []

  for (const [key, rows] of groups) {
    const sep = key.indexOf('\x00')
    const outlet = key.slice(0, sep)
    const party = key.slice(sep + 1)
    const n = rows.length

    const meanRawResid = rows.reduce((s, r) => s + r.rawResidual, 0) / n
    const meanStatResid = rows.reduce((s, r) => s + r.statResidual, 0) / n

    const variance =
      n > 1
        ? rows.reduce((s, r) => s + (r.statResidual - meanStatResid) ** 2, 0) / (n - 1)
        : 0
    const seStat = n > 1 ? Math.sqrt(variance / n) : 0
    const t = seStat > 0 ? meanStatResid / seStat : 0
    const p = seStat > 0 ? tCdf2Sided(t, n - 1) : 1

    // "Arab List (combined)" is not in partiesDim; spec says it inherits Opposition.
    const segment: Segment = segmentMap.get(party) ?? 'Opposition'

    cells.push({ outlet, party, n, meanRawResid, meanStatResid, seStat, t, p, pAdj: null, segment })
  }

  // Split into FDR-eligible and excluded; correct only the eligible pool.
  const eligible = cells.filter(c => c.n >= minN)
  const excluded = cells.filter(c => c.n < minN)

  const adjustedPs = bhFdr(eligible.map(c => c.p))
  eligible.forEach((c, i) => {
    c.pAdj = adjustedPs[i]
  })
  // excluded cells keep pAdj = null.

  // Return in original order (eligible first, then excluded).
  return [...eligible, ...excluded]
}

// ─── computeBlocTilt ──────────────────────────────────────────────────────────

/**
 * Aggregates house effects into a per-outlet Coalition / Opposition bloc tilt.
 *
 * tilt = Σ meanRawResid (Coalition parties) − Σ meanRawResid (Opposition parties)
 *
 * Positive tilt → outlet over-reports Coalition seats vs cross-outlet baseline.
 * Arabs-segment cells are excluded from both sums (they are neither bloc).
 *
 * Output is sorted descending by |tilt|.
 */
export function computeBlocTilt(houseEffects: HouseEffectCell[]): BlocTilt[] {
  const byOutlet = new Map<string, { coalitionSum: number; oppositionSum: number }>()

  for (const cell of houseEffects) {
    if (cell.segment !== 'Coalition' && cell.segment !== 'Opposition') continue
    let entry = byOutlet.get(cell.outlet)
    if (!entry) {
      entry = { coalitionSum: 0, oppositionSum: 0 }
      byOutlet.set(cell.outlet, entry)
    }
    if (cell.segment === 'Coalition') {
      entry.coalitionSum += cell.meanRawResid
    } else {
      entry.oppositionSum += cell.meanRawResid
    }
  }

  return [...byOutlet.entries()]
    .map(([outlet, { coalitionSum, oppositionSum }]) => ({
      outlet,
      coalitionSum,
      oppositionSum,
      tilt: coalitionSum - oppositionSum,
    }))
    .sort((a, b) => Math.abs(b.tilt) - Math.abs(a.tilt))
}

// ─── computeHistoricalAccuracy ────────────────────────────────────────────────

/**
 * Comparison-key definitions for the 2022 track-record badge.
 *
 * Each entry maps a human-readable key to:
 *   - getPredicted(poll): how to extract the predicted value from a final poll
 *   - actual: the official result for that comparison key
 *
 * Alliance/union keys use the normalization described in the spec
 * (§"Comparison key normalization").
 */
const COMPARISON_KEYS: ReadonlyArray<{
  key: string
  getPredicted: (poll: Record<string, number>) => number
  actual: number
}> = [
  {
    key: 'Likud',
    getPredicted: p => p['Likud'] ?? 0,
    actual: knesset2022Actual['Likud'] ?? 0,
  },
  {
    key: 'Yesh Atid',
    getPredicted: p => p['Yesh Atid'] ?? 0,
    actual: knesset2022Actual['Yesh Atid'] ?? 0,
  },
  {
    key: 'Blue & White',
    getPredicted: p => p['Blue & White'] ?? 0,
    actual: knesset2022Actual['Blue & White'] ?? 0,
  },
  {
    key: 'Shas',
    getPredicted: p => p['Shas'] ?? 0,
    actual: knesset2022Actual['Shas'] ?? 0,
  },
  {
    key: 'UTJ',
    getPredicted: p => p['UTJ'] ?? 0,
    actual: knesset2022Actual['UTJ'] ?? 0,
  },
  {
    key: 'Yisrael Beiteinu',
    getPredicted: p => p['Yisrael Beiteinu'] ?? 0,
    actual: knesset2022Actual['Yisrael Beiteinu'] ?? 0,
  },
  {
    key: "Ra'am",
    getPredicted: p => p["Ra'am"] ?? 0,
    actual: knesset2022Actual["Ra'am"] ?? 0,
  },
  {
    key: "Hadash Ta'al",
    getPredicted: p => p["Hadash Ta'al"] ?? 0,
    actual: knesset2022Actual["Hadash Ta'al"] ?? 0,
  },
  {
    key: 'Balad',
    getPredicted: p => p['Balad'] ?? 0,
    actual: knesset2022Actual['Balad'] ?? 0,
  },
  {
    // RZ ran as a joint list with Otzma Yehudit and Noam; actual = 14.
    key: 'Religious Zionism (alliance)',
    getPredicted: p => p['Religious Zionism'] ?? 0,
    actual: 14,
  },
  {
    // The Democrats = Labor 2022 (4 seats); Meretz = 0. Union actual = 4.
    key: 'Democrats + Meretz (union)',
    getPredicted: p => (p['The Democrats'] ?? 0) + (p['Meretz'] ?? 0),
    actual: 4,
  },
]

/**
 * Returns the 2022 track-record badge data for one outlet.
 *
 * Fully isolated from the rolling-baseline pipeline — reads only from
 * historicalPolls2022.ts.  Returns `{ hasData: false }` for outlets not
 * present in knesset2022FinalPolls.
 *
 * MAE is computed over the 11 comparison keys above (reported to 1 decimal).
 * Coalition Bloc Error = (Likud + Religious Zionism + Shas + UTJ) − 64.
 */
export function computeHistoricalAccuracy(outletName: string): HistoricalAccuracyResult {
  const poll = knesset2022FinalPolls[outletName]
  if (!poll) return { outlet: outletName, hasData: false }

  const mae =
    COMPARISON_KEYS.reduce((sum, { getPredicted, actual }) => {
      return sum + Math.abs(getPredicted(poll) - actual)
    }, 0) / COMPARISON_KEYS.length

  const coalitionPred =
    (poll['Likud'] ?? 0) +
    (poll['Religious Zionism'] ?? 0) +
    (poll['Shas'] ?? 0) +
    (poll['UTJ'] ?? 0)

  return {
    outlet: outletName,
    hasData: true,
    mae,
    coalitionBlocError: coalitionPred - 64,
    coalitionPred,
  }
}
