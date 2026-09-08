import type { RollingPoll, RollingPollParty } from './pollRollingWindow'
import type { Segment } from '../types/data'
import { KNESSET_SEAT_SLOTS, type KnessetSeatSlot } from './knessetSeatLayout'
import type { KnessetMemberRow } from './knessetMembersSheet'
import { ringColorForParty } from './knessetPartyRingColors'

const KNESSET_TOTAL = 120
const AISLE_X = 50
/** Podium / hollow — inner first row hugs this. */
const HOLLOW_CENTER = { x: 50, y: 56.5 } as const
/** Bin concentric rings so 1–4 fill one inner row before the next ring. */
const RING_PITCH = 5.5

/**
 * Angular wedges from the aisle down each wing (sketch order).
 * Arabs sit at the opposition floor; Haredim at the coalition floor.
 */
const OPPOSITION_WEDGE_ORDER: readonly string[] = [
  'Yashar!',
  "Bennett's Party",
  'Yisrael Beiteinu',
  'The Democrats',
  'The Reservists',
  'Bayit Yehudi–The Reservists',
  'Yesh Atid',
  'Blue & White',
  "Ra'am",
  'Joint Arab List',
  "Hadash Ta'al",
  'Balad',
]

const COALITION_WEDGE_ORDER: readonly string[] = [
  'Likud',
  'Otzma Yehudit',
  "Ofer Winter's Party",
  'Religious Zionism',
  'Shas',
  'UTJ',
]

export type KnessetFilledSeat =
  | {
      kind: 'member'
      slot: KnessetSeatSlot
      partyKey: string
      segment: Segment
      ringColor: string
      member: KnessetMemberRow
      listRank: number
      partySeatTotal: number
    }
  | {
      kind: 'placeholder'
      slot: KnessetSeatSlot
      partyKey: string
      segment: Segment
      ringColor: string
      listRank: number
      partySeatTotal: number
    }

function roundSeatsTo120(parties: RollingPollParty[]): Map<string, number> {
  const positive = parties.filter((p) => p.votes > 0)
  const raw = positive.map((p) => ({
    party: p.party,
    exact: p.votes,
    floor: Math.floor(p.votes),
    remainder: p.votes - Math.floor(p.votes),
  }))

  let assigned = raw.reduce((s, r) => s + r.floor, 0)
  const seats = new Map<string, number>()
  for (const r of raw) seats.set(r.party, r.floor)

  const byRemainder = [...raw].sort((a, b) => b.remainder - a.remainder || b.exact - a.exact)
  let i = 0
  while (assigned < KNESSET_TOTAL && byRemainder.length > 0) {
    const pick = byRemainder[i % byRemainder.length]!
    seats.set(pick.party, (seats.get(pick.party) ?? 0) + 1)
    assigned++
    i++
  }

  while (assigned > KNESSET_TOTAL) {
    const shrink = [...seats.entries()]
      .filter(([, n]) => n > 0)
      .sort((a, b) => a[1] - b[1])[0]
    if (!shrink) break
    seats.set(shrink[0], shrink[1] - 1)
    assigned--
  }

  return seats
}

type PartyAssignment = {
  partyKey: string
  segment: Segment
  count: number
}

type SlotAssignment = {
  partyKey: string
  segment: Segment
  listRank: number
}

function memberAtListRank(
  roster: readonly KnessetMemberRow[],
  listRank: number,
): KnessetMemberRow | undefined {
  return roster.find((m) => m.listRank === listRank)
}

function buildPartyAssignments(
  parties: RollingPollParty[],
  seatCounts: Map<string, number>,
): PartyAssignment[] {
  return [...parties]
    .filter((p) => (seatCounts.get(p.party) ?? 0) > 0)
    .sort((a, b) => b.votes - a.votes || a.party.localeCompare(b.party))
    .map((p) => ({
      partyKey: p.party,
      segment: p.segment,
      count: seatCounts.get(p.party) ?? 0,
    }))
}

function isOppositionSide(segment: Segment): boolean {
  return segment === 'Opposition' || segment === 'Arabs'
}

function orderPartiesOnSide(
  parties: readonly PartyAssignment[],
  order: readonly string[],
): PartyAssignment[] {
  const rank = new Map(order.map((key, i) => [key, i]))
  return [...parties].sort((a, b) => {
    const ia = rank.get(a.partyKey)
    const ib = rank.get(b.partyKey)
    if (ia != null && ib != null) return ia - ib
    if (ia != null) return -1
    if (ib != null) return 1
    return b.count - a.count || a.partyKey.localeCompare(b.partyKey)
  })
}

function distToHollow(slot: KnessetSeatSlot): number {
  const dx = slot.x - HOLLOW_CENTER.x
  const dy = slot.y - HOLLOW_CENTER.y
  return Math.hypot(dx, dy)
}

/** 0 = toward the arch from the hollow; negative = left, positive = right. */
function polarAngle(slot: KnessetSeatSlot): number {
  return Math.atan2(slot.x - HOLLOW_CENTER.x, HOLLOW_CENTER.y - slot.y)
}

function absAngle(slot: KnessetSeatSlot): number {
  return Math.abs(polarAngle(slot))
}

function ringIndex(slot: KnessetSeatSlot): number {
  return Math.round(distToHollow(slot) / RING_PITCH)
}

/** Consecutive seats from the aisle down the wing → one connected pie slice per party. */
function sortSlotsAlongHemicycle(slots: readonly KnessetSeatSlot[]): KnessetSeatSlot[] {
  return [...slots].sort(
    (a, b) => absAngle(a) - absAngle(b) || distToHollow(a) - distToHollow(b) || a.id - b.id,
  )
}

/**
 * Rank 1 = inner ring, closest to the aisle (right bloc: leftmost of that row).
 * Then 2,3,4 along that ring; next ring outward is 5,6,7,8.
 */
function orderSlotsForListRanks(slots: readonly KnessetSeatSlot[]): KnessetSeatSlot[] {
  return [...slots].sort(
    (a, b) =>
      ringIndex(a) - ringIndex(b) || absAngle(a) - absAngle(b) || distToHollow(a) - distToHollow(b) || a.id - b.id,
  )
}

function totalCount(parties: readonly PartyAssignment[]): number {
  return parties.reduce((s, p) => s + p.count, 0)
}

/**
 * Opposition needs more than the native left half: rotate the split clockwise
 * (take the innermost coalition seats) so the left-wing floor stays opposition.
 * Joint List then sits below Ra’am on the left, not on the right-wing floor.
 */
function rebalanceSides(
  left: KnessetSeatSlot[],
  right: KnessetSeatSlot[],
  leftNeed: number,
  rightNeed: number,
): { left: KnessetSeatSlot[]; right: KnessetSeatSlot[] } {
  let L = sortSlotsAlongHemicycle(left)
  let R = sortSlotsAlongHemicycle(right)

  const stealToLeft = Math.max(0, leftNeed - L.length)
  if (stealToLeft > 0) {
    const take = R.slice(0, stealToLeft)
    R = R.slice(stealToLeft)
    L = sortSlotsAlongHemicycle([...L, ...take])
  }

  const stealToRight = Math.max(0, rightNeed - R.length)
  if (stealToRight > 0) {
    const take = L.slice(0, stealToRight)
    L = L.slice(stealToRight)
    R = sortSlotsAlongHemicycle([...R, ...take])
  }

  return { left: L, right: R }
}

function assignContiguousWedges(
  parties: readonly PartyAssignment[],
  orderedSlots: readonly KnessetSeatSlot[],
): Map<number, SlotAssignment> {
  const assigned = new Map<number, SlotAssignment>()
  let offset = 0

  for (const party of parties) {
    const slice = orderedSlots.slice(offset, offset + party.count)
    offset += party.count
    const ranked = orderSlotsForListRanks(slice)
    ranked.forEach((slot, i) => {
      assigned.set(slot.id, {
        partyKey: party.partyKey,
        segment: party.segment,
        listRank: i + 1,
      })
    })
  }

  return assigned
}

function fillRemainingSlots(
  assigned: Map<number, SlotAssignment>,
  leftover: SlotAssignment[],
): void {
  if (leftover.length === 0) return
  const empty = KNESSET_SEAT_SLOTS.filter((s) => !assigned.has(s.id)).sort(
    (a, b) => absAngle(a) - absAngle(b) || a.id - b.id,
  )
  leftover.forEach((entry, i) => {
    const slot = empty[i]
    if (slot) assigned.set(slot.id, entry)
  })
}

export function buildKnessetFilledSeats(
  poll: RollingPoll,
  membersByParty: Map<string, KnessetMemberRow[]>,
): KnessetFilledSeat[] {
  const seatCounts = roundSeatsTo120(poll.parties)
  const assignments = buildPartyAssignments(poll.parties, seatCounts)

  const opposition = orderPartiesOnSide(
    assignments.filter((p) => isOppositionSide(p.segment)),
    OPPOSITION_WEDGE_ORDER,
  )
  const coalition = orderPartiesOnSide(
    assignments.filter((p) => !isOppositionSide(p.segment)),
    COALITION_WEDGE_ORDER,
  )

  const { left, right } = rebalanceSides(
    KNESSET_SEAT_SLOTS.filter((s) => s.x < AISLE_X),
    KNESSET_SEAT_SLOTS.filter((s) => s.x >= AISLE_X),
    totalCount(opposition),
    totalCount(coalition),
  )

  const assigned = new Map<number, SlotAssignment>()
  for (const [id, entry] of assignContiguousWedges(opposition, left)) assigned.set(id, entry)
  for (const [id, entry] of assignContiguousWedges(coalition, right)) assigned.set(id, entry)

  const leftover: SlotAssignment[] = []
  const placed = new Map<string, number>()
  for (const entry of assigned.values()) {
    placed.set(entry.partyKey, (placed.get(entry.partyKey) ?? 0) + 1)
  }
  for (const party of [...opposition, ...coalition]) {
    const have = placed.get(party.partyKey) ?? 0
    for (let rank = have + 1; rank <= party.count; rank++) {
      leftover.push({ partyKey: party.partyKey, segment: party.segment, listRank: rank })
    }
  }
  fillRemainingSlots(assigned, leftover)

  const filled: KnessetFilledSeat[] = []
  for (const slot of KNESSET_SEAT_SLOTS) {
    const party = assigned.get(slot.id)
    if (!party) continue

    const partySeatTotal = seatCounts.get(party.partyKey) ?? 0
    const listRank = party.listRank
    const ringColor = ringColorForParty(party.partyKey, listRank - 1)
    const roster = membersByParty.get(party.partyKey) ?? []
    const member = memberAtListRank(roster, listRank)

    if (member) {
      filled.push({
        kind: 'member',
        slot,
        partyKey: party.partyKey,
        segment: party.segment,
        ringColor,
        member,
        listRank,
        partySeatTotal,
      })
    } else {
      filled.push({
        kind: 'placeholder',
        slot,
        partyKey: party.partyKey,
        segment: party.segment,
        ringColor,
        listRank,
        partySeatTotal,
      })
    }
  }

  return filled.sort((a, b) => a.slot.id - b.slot.id)
}

export function seatCountsByParty(poll: RollingPoll): Map<string, number> {
  return roundSeatsTo120(poll.parties)
}
