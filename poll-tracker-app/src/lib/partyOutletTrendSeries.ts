import dayjs from 'dayjs'
import { SPARKLINE_PARTY_DEBUT_DATE } from '../config/mappings'

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
