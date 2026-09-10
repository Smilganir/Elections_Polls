import type { Segment } from '../types/data'
import type { KnessetMemberRow } from './knessetMembersSheet'
import { ringColorForParty } from './knessetPartyRingColors'
import type { KnessetFilledSeat } from './knessetSeatAllocation'

const SWING_COUNT = 2

export type PartySwingSeats = {
  partyKey: string
  segment: Segment
  partySeatTotal: number
  /** Highest list ranks still projected in — most at risk of dropping out. */
  atRiskIn: readonly KnessetFilledSeat[]
  /** Lowest list ranks above the cutoff — next to enter if the party gains. */
  nextOut: readonly KnessetFilledSeat[]
  side: 'left' | 'right'
}

function swingMemberSeat(
  member: KnessetMemberRow,
  partyKey: string,
  segment: Segment,
  partySeatTotal: number,
): KnessetFilledSeat {
  return {
    kind: 'member',
    slot: { id: -(10_000 + member.listRank), x: 0, y: 0, zone: 'opposition-wing' },
    partyKey,
    segment,
    ringColor: ringColorForParty(partyKey, member.listRank - 1),
    member,
    listRank: member.listRank,
    partySeatTotal,
  }
}

/** Swing candidates for a single party focus — up to 2 in / 2 out list heads. */
export function computePartySwingSeats(
  partyKey: string,
  seats: readonly KnessetFilledSeat[],
  membersByParty: Map<string, KnessetMemberRow[]>,
): PartySwingSeats | null {
  const partySeats = seats.filter((s) => s.partyKey === partyKey)
  if (partySeats.length === 0) return null

  const partySeatTotal = partySeats[0]!.partySeatTotal
  const segment = partySeats[0]!.segment

  const atRiskIn = [...partySeats]
    .sort((a, b) => b.listRank - a.listRank)
    .slice(0, SWING_COUNT)
    .reverse()

  const roster = membersByParty.get(partyKey) ?? []
  const nextOut = roster
    .filter((m) => m.listRank > partySeatTotal)
    .sort((a, b) => a.listRank - b.listRank || a.name.localeCompare(b.name))
    .slice(0, SWING_COUNT)
    .map((member) => swingMemberSeat(member, partyKey, segment, partySeatTotal))

  if (atRiskIn.length === 0 && nextOut.length === 0) return null

  const side: 'left' | 'right' = segment === 'Coalition' ? 'right' : 'left'

  return {
    partyKey,
    segment,
    partySeatTotal,
    atRiskIn,
    nextOut,
    side,
  }
}
