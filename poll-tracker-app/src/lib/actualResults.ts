import type { RollingPoll } from './pollRollingWindow'
import { ELECTION_DAY_ISO } from './pollRollingWindow'

export type LastPollForParty = {
  /** ISO date `YYYY-MM-DD` of the party's most recent poll on or before election day. */
  date: string
  /** Seats: average across the polls published on that date (one decimal when needed). */
  seats: number
  pollsCount: number
  outlets: string[]
}

/**
 * Most recent poll per party on or before election day (27.10.2026).
 * A poll counts for a party only when it reports seats > 0 for it (a 0 row means the
 * poll did not list it, e.g. Joint Arab List vs split Arab parties).
 */
export function lastPollByParty(
  polls: readonly RollingPoll[],
  partyKeys: readonly string[],
): Map<string, LastPollForParty> {
  const out = new Map<string, LastPollForParty>()
  for (const key of partyKeys) {
    let bestDate = ''
    for (const poll of polls) {
      const d = String(poll.date).slice(0, 10)
      if (d > ELECTION_DAY_ISO) continue
      const v = poll.parties.find((p) => p.party === key)?.votes ?? 0
      if (v > 0 && d > bestDate) bestDate = d
    }
    if (!bestDate) continue
    const sameDay = polls.filter(
      (p) =>
        String(p.date).slice(0, 10) === bestDate &&
        (p.parties.find((x) => x.party === key)?.votes ?? 0) > 0,
    )
    const sum = sameDay.reduce(
      (s, p) => s + (p.parties.find((x) => x.party === key)?.votes ?? 0),
      0,
    )
    const avg = sum / sameDay.length
    out.set(key, {
      date: bestDate,
      seats: Math.round(avg * 10) / 10,
      pollsCount: sameDay.length,
      outlets: [...new Set(sameDay.map((p) => p.mediaOutlet))],
    })
  }
  return out
}
