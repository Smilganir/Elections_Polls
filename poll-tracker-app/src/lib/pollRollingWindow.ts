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

export type ChangedParty = {
  party: string
  segment: Segment
  currentVotes: number
  previousVotes: number
  delta: number
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

  const summary: RollingWindowSummary = {
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

  return { rows, summary }
}
