import type { Segment } from '../types/data'

export type RollingPollParty = { party: string; votes: number; segment: Segment; partyId: number }

export type RollingPoll = {
  pollId: number
  date: string
  mediaOutlet: string
  coalitionTotal: number
  oppositionTotal: number
  arabsTotal: number
  parties: RollingPollParty[]
}

function utcDayStart(d: Date) {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

function parseSheetDate(s: string): number | null {
  const m = String(s).trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

/** Calendar days from poll date (sheet) to today, UTC (matches summarize-latest-blocs). */
export function ageDaysPollToToday(pollDateStr: string, today = new Date()): number {
  const pollT = parseSheetDate(pollDateStr)
  if (pollT === null) return Infinity
  const diff = utcDayStart(today) - pollT
  return Math.floor(diff / 86400000)
}

const ARAB_DETAIL_PARTY_KEYS = ["Hadash Ta'al", "Ra'am", 'Balad'] as const
const JOINT_ARAB_LIST_KEY = 'Joint Arab List'

function partyVotes(poll: RollingPoll, partyKey: string): number {
  return poll.parties.find((p) => p.party === partyKey)?.votes ?? 0
}

/** Split-Arabs row: detail columns populated, Joint Arab List empty (matches run_polls.py). */
export function isSplitArabsPoll(poll: RollingPoll): boolean {
  const jal = partyVotes(poll, JOINT_ARAB_LIST_KEY)
  const detail = ARAB_DETAIL_PARTY_KEYS.reduce((s, k) => s + partyVotes(poll, k), 0)
  return jal === 0 && detail > 0
}

/**
 * Same-day duplicate rule (all outlets): prefer split-Arabs poll over lumped-Arabs.
 * When multiple polls share (Media Outlet, date), keep one pollId — mirrors ETL in run_polls.py.
 */
export function dedupePollsPreferSplitArabs<T extends RollingPoll>(polls: T[]): T[] {
  const byOutletDay = new Map<string, T[]>()
  for (const p of polls) {
    const day = String(p.date).trim().slice(0, 10)
    const key = `${p.mediaOutlet}\0${day}`
    if (!byOutletDay.has(key)) byOutletDay.set(key, [])
    byOutletDay.get(key)!.push(p)
  }

  const keepIds = new Set<number>()
  for (const grp of byOutletDay.values()) {
    if (grp.length === 1) {
      keepIds.add(grp[0]!.pollId)
      continue
    }
    const splitFlags = grp.map(isSplitArabsPoll)
    if (!splitFlags.some(Boolean) || splitFlags.every(Boolean)) {
      const best = [...grp].sort((a, b) => b.pollId - a.pollId)[0]!
      keepIds.add(best.pollId)
      continue
    }
    const splitPolls = grp.filter((_, i) => splitFlags[i])
    const best = [...splitPolls].sort((a, b) => b.pollId - a.pollId)[0]!
    keepIds.add(best.pollId)
  }

  return polls.filter((p) => keepIds.has(p.pollId))
}

export type ChangedParty = {
  party: string
  segment: Segment
  currentVotes: number
  previousVotes: number
  delta: number
  /** Outlets whose prior poll showed a seat change (cross-outlet hero chips only). */
  deltaOutletCount?: number
}

export type RollingWindowRow = {
  current: RollingPoll
  previous: RollingPoll | null
  changedParties: ChangedParty[]
}

export type RollingWindowSummary = {
  n: number
  avgCoalition: number
  avgOpposition: number
  avgArabs: number
  /** Mean (O+A) per outlet — for UI when Arabs merged into opposition. */
  avgOppositionPlusArabs: number
  nWithPrior: number
  prevAvgCoalition: number
  prevAvgOpposition: number
  prevAvgArabs: number
  prevAvgOppositionPlusArabs: number
  deltaCoalition: number
  deltaOpposition: number
  deltaArabs: number
  deltaOppositionPlusArabs: number
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

function votesByParty(poll: RollingPoll): Map<string, number> {
  const m = new Map<string, number>()
  for (const pr of poll.parties) m.set(pr.party, pr.votes)
  return m
}

function segmentForParty(poll: RollingPoll, party: string): Segment | undefined {
  return poll.parties.find((p) => p.party === party)?.segment
}

function changedPartiesBetween(current: RollingPoll, previous: RollingPoll | null): ChangedParty[] {
  if (!previous) return []
  const curM = votesByParty(current)
  const prevM = votesByParty(previous)
  const names = new Set<string>([...curM.keys(), ...prevM.keys()])
  const out: ChangedParty[] = []
  for (const party of names) {
    const c = curM.get(party) ?? 0
    const p = prevM.get(party) ?? 0
    if (c === p) continue
    out.push({
      party,
      segment: segmentForParty(current, party) ?? segmentForParty(previous, party) ?? 'Opposition',
      currentVotes: c,
      previousVotes: p,
      delta: c - p,
    })
  }
  out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.party.localeCompare(b.party))
  return out
}

/**
 * Cross-outlet mean seats per party for the hero chip strip (latest poll per outlet in window).
 * Deltas use the same mean-vs-prior rule as narrative trend bullets.
 */
export function buildCrossOutletAverageChipRow(
  rows: RollingWindowRow[],
): { current: RollingPoll; changedParties: ChangedParty[] } | null {
  if (rows.length === 0) return null

  const voteSum = new Map<string, number>()
  const voteCount = new Map<string, number>()
  const segmentByParty = new Map<string, Segment>()
  const partyIdByParty = new Map<string, number>()

  for (const { current } of rows) {
    for (const p of current.parties) {
      if (p.votes <= 0) continue
      voteSum.set(p.party, (voteSum.get(p.party) ?? 0) + p.votes)
      voteCount.set(p.party, (voteCount.get(p.party) ?? 0) + 1)
      if (!segmentByParty.has(p.party)) {
        segmentByParty.set(p.party, p.segment)
        partyIdByParty.set(p.party, p.partyId)
      }
    }
  }

  const parties: RollingPollParty[] = [...voteSum.entries()]
    .map(([party, sum]) => {
      const n = voteCount.get(party) ?? 1
      return {
        party,
        votes: round1(sum / n),
        segment: segmentByParty.get(party) ?? 'Opposition',
        partyId: partyIdByParty.get(party) ?? 0,
      }
    })
    .filter((p) => p.votes > 0)
    .sort((a, b) => b.votes - a.votes || a.party.localeCompare(b.party))

  if (parties.length === 0) return null

  const outletCountByParty = new Map<string, number>()
  for (const { changedParties } of rows) {
    for (const cp of changedParties) {
      outletCountByParty.set(cp.party, (outletCountByParty.get(cp.party) ?? 0) + 1)
    }
  }

  const avgDeltas = averagePartySeatDeltaAcrossOutlets(rows)
  const changedParties: ChangedParty[] = []
  for (const [party, avgDelta] of avgDeltas) {
    const rd = round1(avgDelta)
    if (rd === 0) continue
    const avgV = parties.find((p) => p.party === party)?.votes ?? 0
    changedParties.push({
      party,
      segment: segmentByParty.get(party) ?? 'Opposition',
      currentVotes: avgV,
      previousVotes: round1(avgV - rd),
      delta: rd,
      deltaOutletCount: outletCountByParty.get(party) ?? 0,
    })
  }
  changedParties.sort(
    (a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.party.localeCompare(b.party),
  )

  const maxDate = rows.reduce(
    (max, r) => (r.current.date.localeCompare(max) > 0 ? r.current.date : max),
    rows[0]!.current.date,
  )

  return {
    current: {
      pollId: -1,
      date: maxDate,
      mediaOutlet: '',
      coalitionTotal: 0,
      oppositionTotal: 0,
      arabsTotal: 0,
      parties,
    },
    changedParties,
  }
}

export function averagePartySeatDeltaAcrossOutlets(rows: RollingWindowRow[]): Map<string, number> {
  const sum = new Map<string, number>()
  const count = new Map<string, number>()
  for (const { changedParties } of rows) {
    for (const cp of changedParties) {
      sum.set(cp.party, (sum.get(cp.party) ?? 0) + cp.delta)
      count.set(cp.party, (count.get(cp.party) ?? 0) + 1)
    }
  }
  const out = new Map<string, number>()
  for (const [party, s] of sum) {
    const n = count.get(party) ?? 0
    if (n > 0) out.set(party, s / n)
  }
  return out
}

/** Non-Arab parties with chip deltas on visible outlet rows: avg seat Δ and outlet count. */
export function partyTrendStatsFromRows(
  rows: RollingWindowRow[],
): Map<string, { avg: number; outlets: number }> {
  const sum = new Map<string, number>()
  const count = new Map<string, number>()
  for (const { changedParties } of rows) {
    for (const cp of changedParties) {
      if (cp.segment === 'Arabs') continue
      sum.set(cp.party, (sum.get(cp.party) ?? 0) + cp.delta)
      count.set(cp.party, (count.get(cp.party) ?? 0) + 1)
    }
  }
  const out = new Map<string, { avg: number; outlets: number }>()
  for (const [party, s] of sum) {
    const n = count.get(party) ?? 0
    if (n > 0) out.set(party, { avg: s / n, outlets: n })
  }
  return out
}

/**
 * Latest poll per outlet whose date is within maxStaleDays; previous = next-older pollId for that outlet.
 */
export function buildRollingWindowReport(
  polls: RollingPoll[],
  maxStaleDays: number,
  today = new Date(),
): { rows: RollingWindowRow[]; summary: RollingWindowSummary } {
  const byOutlet = new Map<string, RollingPoll[]>()
  for (const p of polls) {
    if (!byOutlet.has(p.mediaOutlet)) byOutlet.set(p.mediaOutlet, [])
    byOutlet.get(p.mediaOutlet)!.push(p)
  }

  const rows: RollingWindowRow[] = []

  for (const [, outletPolls] of byOutlet) {
    const inWindow = outletPolls.filter((p) => ageDaysPollToToday(p.date, today) <= maxStaleDays)
    if (inWindow.length === 0) continue

    inWindow.sort((a, b) => {
      const dc = b.date.localeCompare(a.date)
      if (dc !== 0) return dc
      return b.pollId - a.pollId
    })
    const current = inWindow[0]!

    const byIdDesc = [...outletPolls].sort((a, b) => b.pollId - a.pollId)
    const idx = byIdDesc.findIndex((p) => p.pollId === current.pollId)
    const previous = idx >= 0 && idx + 1 < byIdDesc.length ? byIdDesc[idx + 1]! : null

    rows.push({
      current,
      previous,
      changedParties: changedPartiesBetween(current, previous),
    })
  }

  rows.sort((a, b) => {
    const dc = b.current.date.localeCompare(a.current.date)
    if (dc !== 0) return dc
    return b.current.pollId - a.current.pollId
  })

  return { rows, summary: summaryFromRollingRows(rows) }
}

/** Cross-outlet averages + deltas for an arbitrary row set (e.g. after outlet filter). */
export function summaryFromRollingRows(rows: RollingWindowRow[]): RollingWindowSummary {
  const n = Math.max(1, rows.length)
  const avgCoalition = rows.reduce((s, r) => s + r.current.coalitionTotal, 0) / n
  const avgOpposition = rows.reduce((s, r) => s + r.current.oppositionTotal, 0) / n
  const avgArabs = rows.reduce((s, r) => s + r.current.arabsTotal, 0) / n
  const avgOppositionPlusArabs =
    rows.reduce((s, r) => s + r.current.oppositionTotal + r.current.arabsTotal, 0) / n

  const withPrior = rows.filter((r) => r.previous !== null)
  const nv = withPrior.length
  const prevAvgCoalition =
    nv === 0 ? 0 : withPrior.reduce((s, r) => s + r.previous!.coalitionTotal, 0) / nv
  const prevAvgOpposition =
    nv === 0 ? 0 : withPrior.reduce((s, r) => s + r.previous!.oppositionTotal, 0) / nv
  const prevAvgArabs =
    nv === 0 ? 0 : withPrior.reduce((s, r) => s + r.previous!.arabsTotal, 0) / nv
  const prevAvgOppositionPlusArabs =
    nv === 0
      ? 0
      : withPrior.reduce(
          (s, r) => s + r.previous!.oppositionTotal + r.previous!.arabsTotal,
          0,
        ) / nv

  return {
    n: rows.length,
    avgCoalition: round1(avgCoalition),
    avgOpposition: round1(avgOpposition),
    avgArabs: round1(avgArabs),
    avgOppositionPlusArabs: round1(avgOppositionPlusArabs),
    nWithPrior: nv,
    prevAvgCoalition: round1(prevAvgCoalition),
    prevAvgOpposition: round1(prevAvgOpposition),
    prevAvgArabs: round1(prevAvgArabs),
    prevAvgOppositionPlusArabs: round1(prevAvgOppositionPlusArabs),
    deltaCoalition: nv ? round1(avgCoalition - prevAvgCoalition) : 0,
    deltaOpposition: nv ? round1(avgOpposition - prevAvgOpposition) : 0,
    deltaArabs: nv ? round1(avgArabs - prevAvgArabs) : 0,
    deltaOppositionPlusArabs: nv
      ? round1(avgOppositionPlusArabs - prevAvgOppositionPlusArabs)
      : 0,
  }
}
