import dayjs from 'dayjs'
import { SPARKLINE_PARTY_DEBUT_DATE } from '../config/mappings'
import { ageDaysPollToToday } from './pollRollingWindow'

export type PartyTrendPoint = { date: string; votes: number; pollId: number }

export type PollHistoryRow = {
  pollId: number
  date: string
  mediaOutlet: string
  parties: { party: string; votes: number }[]
}

/** Chronological seat series for one party at one outlet (all deduped polls). */
export function buildPartyOutletTrendSeries(
  polls: PollHistoryRow[],
  mediaOutlet: string,
  party: string,
): PartyTrendPoint[] {
  const debutStr = SPARKLINE_PARTY_DEBUT_DATE[party]
  const debut = debutStr ? dayjs(debutStr) : null

  const points = polls
    .filter((p) => p.mediaOutlet === mediaOutlet)
    .map((p) => ({
      date: p.date,
      votes: p.parties.find((x) => x.party === party)?.votes ?? 0,
      pollId: p.pollId,
    }))
    .filter((pt) => !debut || !dayjs(pt.date).isBefore(debut, 'day'))
    .sort((a, b) => a.date.localeCompare(b.date) || a.pollId - b.pollId)

  return points
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * Cross-outlet mean seat series for one party: after each poll in the rolling window,
 * average that party's seats across the latest poll per outlet (matches hero chip averages).
 */
export function buildPartyCrossOutletAverageTrendSeries(
  polls: PollHistoryRow[],
  party: string,
  maxStaleDays: number,
  allowedOutlets?: ReadonlySet<string>,
  today = new Date(),
): PartyTrendPoint[] {
  const debutStr = SPARKLINE_PARTY_DEBUT_DATE[party]
  const debut = debutStr ? dayjs(debutStr) : null

  const inWindow = polls.filter((p) => {
    if (allowedOutlets && !allowedOutlets.has(p.mediaOutlet)) return false
    if (ageDaysPollToToday(p.date, today) > maxStaleDays) return false
    if (debut && dayjs(p.date).isBefore(debut, 'day')) return false
    return true
  })

  const sorted = [...inWindow].sort(
    (a, b) => a.date.localeCompare(b.date) || a.pollId - b.pollId,
  )

  const latestByOutlet = new Map<string, PollHistoryRow>()
  const rawPoints: PartyTrendPoint[] = []

  for (const poll of sorted) {
    const prev = latestByOutlet.get(poll.mediaOutlet)
    if (
      !prev ||
      poll.date > prev.date ||
      (poll.date === prev.date && poll.pollId > prev.pollId)
    ) {
      latestByOutlet.set(poll.mediaOutlet, poll)
    }

    let sum = 0
    let count = 0
    for (const snap of latestByOutlet.values()) {
      sum += snap.parties.find((x) => x.party === party)?.votes ?? 0
      count++
    }
    if (count === 0) continue
    rawPoints.push({
      date: poll.date,
      votes: round1(sum / count),
      pollId: poll.pollId,
    })
  }

  const byDate = new Map<string, PartyTrendPoint>()
  for (const pt of rawPoints) {
    const day = pt.date.slice(0, 10)
    const existing = byDate.get(day)
    if (!existing || pt.pollId >= existing.pollId) {
      byDate.set(day, pt)
    }
  }
  return [...byDate.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || a.pollId - b.pollId,
  )
}
