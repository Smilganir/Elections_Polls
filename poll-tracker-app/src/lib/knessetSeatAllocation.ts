import type { RollingPoll, RollingPollParty } from './pollRollingWindow'
import type { Segment } from '../types/data'
import {
  KNESSET_SEAT_SLOTS,
  type KnessetSeatSlot,
  type KnessetSeatZone,
} from './knessetSeatLayout'
import type { KnessetMemberRow } from './knessetMembersSheet'
import { ringColorForParty } from './knessetPartyRingColors'

const HAREDI_PARTIES = new Set(['Shas', 'UTJ'])
const KNESSET_TOTAL = 120

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

/** Center of the hemicycle hollow (% of stage) — inner seats hug this point. */
const HOLLOW_CENTER = { x: 50, y: 56.5 } as const

/** Lower score = closer to hollow center (list rank 1 sits here). */
function innerness(slot: KnessetSeatSlot): number {
  const dx = slot.x - HOLLOW_CENTER.x
  const dy = slot.y - HOLLOW_CENTER.y
  return dx * dx + dy * dy
}

function memberAtListRank(
  roster: readonly KnessetMemberRow[],
  listRank: number,
): KnessetMemberRow | undefined {
  return roster.find((m) => m.listRank === listRank)
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

function sortSlotsInZone(zone: KnessetSeatZone, slots: KnessetSeatSlot[]): KnessetSeatSlot[] {
  if (zone === 'opposition-wing' || zone === 'coalition-wing') {
    return [...slots].sort(
      (a, b) =>
        innerness(a) - innerness(b) ||
        (zone === 'opposition-wing' ? b.x - a.x : a.x - b.x) ||
        a.id - b.id,
    )
  }

  return [...slots].sort((a, b) => {
    const innerDiff = innerness(a) - innerness(b)
    if (innerDiff !== 0) return innerDiff
    if (zone === 'arabs-center' || zone === 'haredi-center') {
      return b.y - a.y || a.x - b.x
    }
    if (zone === 'opposition-arch') {
      return a.y - b.y || b.x - a.x
    }
    return a.y - b.y || a.x - b.x
  })
}

function slotsInZones(
  zones: readonly KnessetSeatZone[],
  usedSlotIds: ReadonlySet<number>,
): KnessetSeatSlot[] {
  const out: KnessetSeatSlot[] = []
  for (const zone of zones) {
    const zoneSlots = KNESSET_SEAT_SLOTS.filter((s) => s.zone === zone && !usedSlotIds.has(s.id))
    out.push(...sortSlotsInZone(zone, zoneSlots))
  }
  return out
}

/** Split inner-zone capacity across parties (largest remainder), capped at each party size. */
function distributeInnerShares(
  parties: readonly PartyAssignment[],
  innerCapacity: number,
): Map<string, number> {
  const shares = new Map<string, number>()
  if (innerCapacity <= 0 || parties.length === 0) return shares

  const total = parties.reduce((s, p) => s + p.count, 0)
  if (total <= 0) return shares

  const raw = parties.map((p) => {
    const exact = (p.count / total) * innerCapacity
    const floor = Math.min(p.count, Math.floor(exact))
    return { partyKey: p.partyKey, floor, remainder: exact - Math.floor(exact), count: p.count }
  })

  for (const r of raw) shares.set(r.partyKey, r.floor)

  let assigned = raw.reduce((s, r) => s + r.floor, 0)
  const byRemainder = [...raw].sort((a, b) => b.remainder - a.remainder || b.count - a.count)
  let i = 0
  while (assigned < innerCapacity && assigned < total) {
    const pick = byRemainder[i % byRemainder.length]!
    const cur = shares.get(pick.partyKey) ?? 0
    if (cur < pick.count) {
      shares.set(pick.partyKey, cur + 1)
      assigned++
    }
    i++
    if (i > 500) break
  }

  return shares
}

/**
 * Assign contiguous party blocks: each party gets a proportional share of inner (arch/center)
 * seats so rank 1 sits in the inner arc, then spills to outer wings.
 */
function assignBlocWithInnerShare(
  parties: PartyAssignment[],
  innerZones: readonly KnessetSeatZone[],
  outerZones: readonly KnessetSeatZone[],
  usedSlotIds: Set<number>,
): { assigned: Map<number, SlotAssignment>; overflow: SlotAssignment[] } {
  const assigned = new Map<number, SlotAssignment>()
  const overflow: SlotAssignment[] = []

  const innerStream = slotsInZones(innerZones, usedSlotIds)
  const outerStream = slotsInZones(outerZones, usedSlotIds)
  const innerShares = distributeInnerShares(parties, innerStream.length)

  let innerIdx = 0
  let outerIdx = 0

  for (const party of parties) {
    const innerCount = innerShares.get(party.partyKey) ?? 0
    for (let rank = 1; rank <= party.count; rank++) {
      const entry: SlotAssignment = {
        partyKey: party.partyKey,
        segment: party.segment,
        listRank: rank,
      }
      let slot: KnessetSeatSlot | undefined
      if (rank <= innerCount && innerIdx < innerStream.length) {
        slot = innerStream[innerIdx++]
      } else if (outerIdx < outerStream.length) {
        slot = outerStream[outerIdx++]
      }
      if (!slot) {
        overflow.push(entry)
        continue
      }
      assigned.set(slot.id, entry)
      usedSlotIds.add(slot.id)
    }
  }

  return { assigned, overflow }
}

function preferredZonesForOverflow(entry: SlotAssignment): ReadonlySet<KnessetSeatZone> {
  if (entry.segment === 'Arabs') {
    return new Set(['arabs-center', 'opposition-arch', 'coalition-arch'])
  }
  if (HAREDI_PARTIES.has(entry.partyKey)) {
    return new Set(['haredi-center', 'coalition-arch', 'coalition-wing'])
  }
  if (entry.segment === 'Coalition') {
    return new Set(['coalition-arch', 'coalition-wing'])
  }
  return new Set(['opposition-arch', 'opposition-wing'])
}

function assignOverflowSeats(
  overflow: SlotAssignment[],
  assigned: Map<number, SlotAssignment>,
): void {
  if (overflow.length === 0) return

  let emptySlots = KNESSET_SEAT_SLOTS.filter((s) => !assigned.has(s.id)).sort(
    (a, b) => innerness(a) - innerness(b) || a.id - b.id,
  )

  const queue = [...overflow].sort(
    (a, b) =>
      a.partyKey.localeCompare(b.partyKey) || a.listRank - b.listRank,
  )

  for (const entry of queue) {
    if (emptySlots.length === 0) break
    const preferred = preferredZonesForOverflow(entry)
    const prefSlots = emptySlots.filter((s) => preferred.has(s.zone))
    const pick = (prefSlots.length > 0 ? prefSlots : emptySlots)[0]!
    assigned.set(pick.id, entry)
    emptySlots = emptySlots.filter((s) => s.id !== pick.id)
  }
}

export function buildKnessetFilledSeats(
  poll: RollingPoll,
  membersByParty: Map<string, KnessetMemberRow[]>,
): KnessetFilledSeat[] {
  const seatCounts = roundSeatsTo120(poll.parties)
  const assignments = buildPartyAssignments(poll.parties, seatCounts)

  const opposition = assignments.filter((p) => p.segment === 'Opposition')
  const arabs = assignments.filter((p) => p.segment === 'Arabs')
  const coalition = assignments.filter(
    (p) => p.segment === 'Coalition' && !HAREDI_PARTIES.has(p.partyKey),
  )
  const haredi = assignments.filter((p) => HAREDI_PARTIES.has(p.partyKey))

  const usedSlotIds = new Set<number>()
  const assigned = new Map<number, SlotAssignment>()
  const overflow: SlotAssignment[] = []

  const opp = assignBlocWithInnerShare(
    opposition,
    ['opposition-arch'],
    ['opposition-wing'],
    usedSlotIds,
  )
  for (const [id, entry] of opp.assigned) assigned.set(id, entry)
  overflow.push(...opp.overflow)

  const arab = assignBlocWithInnerShare(arabs, ['arabs-center'], [], usedSlotIds)
  for (const [id, entry] of arab.assigned) assigned.set(id, entry)
  overflow.push(...arab.overflow)

  const harediBlock = assignBlocWithInnerShare(
    haredi,
    ['haredi-center'],
    ['coalition-arch', 'coalition-wing'],
    usedSlotIds,
  )
  for (const [id, entry] of harediBlock.assigned) assigned.set(id, entry)
  overflow.push(...harediBlock.overflow)

  const coal = assignBlocWithInnerShare(
    coalition,
    ['coalition-arch'],
    ['coalition-wing'],
    usedSlotIds,
  )
  for (const [id, entry] of coal.assigned) assigned.set(id, entry)
  overflow.push(...coal.overflow)

  assignOverflowSeats(overflow, assigned)

  const filled: KnessetFilledSeat[] = []
  for (const slot of KNESSET_SEAT_SLOTS) {
    const party = assigned.get(slot.id)
    if (!party) continue

    const partySeatTotal = seatCounts.get(party.partyKey) ?? 0
    const listRank = party.listRank
    const seatIdx = listRank - 1
    const ringColor = ringColorForParty(party.partyKey, seatIdx)
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
