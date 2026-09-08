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

/** Physical zones each party may occupy, in inner→outer fill order. */
function zonesForParty(party: PartyAssignment): readonly KnessetSeatZone[] {
  if (party.segment === 'Arabs') {
    return ['arabs-center', 'opposition-arch', 'haredi-center']
  }
  if (HAREDI_PARTIES.has(party.partyKey)) {
    return ['haredi-center', 'coalition-arch', 'coalition-wing']
  }
  if (party.segment === 'Coalition') {
    return ['coalition-wing', 'coalition-arch']
  }
  return ['opposition-wing', 'opposition-arch']
}

function sortSlotsInZone(zone: KnessetSeatZone, slots: KnessetSeatSlot[]): KnessetSeatSlot[] {
  if (zone === 'opposition-wing' || zone === 'coalition-wing') {
    const rowKey = (s: KnessetSeatSlot) => Math.round(s.y * 10)
    const rows = new Map<number, KnessetSeatSlot[]>()
    for (const slot of slots) {
      const key = rowKey(slot)
      const list = rows.get(key) ?? []
      list.push(slot)
      rows.set(key, list)
    }
    const rowOrder = [...rows.keys()].sort((a, b) => {
      const ya = rows.get(a)![0]!.y
      const yb = rows.get(b)![0]!.y
      return Math.abs(ya - HOLLOW_CENTER.y) - Math.abs(yb - HOLLOW_CENTER.y)
    })
    const ordered: KnessetSeatSlot[] = []
    for (const key of rowOrder) {
      const row = rows.get(key)!
      row.sort((a, b) => (zone === 'opposition-wing' ? b.x - a.x : a.x - b.x))
      ordered.push(...row)
    }
    return ordered
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

function buildPartySlotPath(
  party: PartyAssignment,
  usedSlotIds: ReadonlySet<number>,
): KnessetSeatSlot[] {
  const path: KnessetSeatSlot[] = []
  for (const zone of zonesForParty(party)) {
    const zoneSlots = KNESSET_SEAT_SLOTS.filter((s) => s.zone === zone && !usedSlotIds.has(s.id))
    path.push(...sortSlotsInZone(zone, zoneSlots))
  }
  return path
}

function assignPartyBlock(
  party: PartyAssignment,
  path: KnessetSeatSlot[],
  assigned: Map<number, SlotAssignment>,
  usedSlotIds: Set<number>,
): SlotAssignment[] {
  const remaining: SlotAssignment[] = []
  const take = Math.min(party.count, path.length)

  for (let rank = 1; rank <= party.count; rank++) {
    const entry: SlotAssignment = {
      partyKey: party.partyKey,
      segment: party.segment,
      listRank: rank,
    }
    if (rank > take) {
      remaining.push(entry)
      continue
    }
    const slot = path[rank - 1]!
    assigned.set(slot.id, entry)
    usedSlotIds.add(slot.id)
  }

  return remaining
}

function assignByPartyBlocks(parties: PartyAssignment[]): {
  assigned: Map<number, SlotAssignment>
  remaining: SlotAssignment[]
} {
  const assigned = new Map<number, SlotAssignment>()
  const usedSlotIds = new Set<number>()
  const remaining: SlotAssignment[] = []

  for (const party of parties) {
    const path = buildPartySlotPath(party, usedSlotIds)
    remaining.push(...assignPartyBlock(party, path, assigned, usedSlotIds))
  }

  return { assigned, remaining }
}

function assignRemainingByParty(
  parties: PartyAssignment[],
  remainingByParty: Map<string, SlotAssignment[]>,
  assigned: Map<number, SlotAssignment>,
  usedSlotIds: Set<number>,
): void {
  for (const party of parties) {
    const entries = remainingByParty.get(party.partyKey)
    if (!entries?.length) continue

    const path = buildPartySlotPath(party, usedSlotIds)
    for (let i = 0; i < entries.length; i++) {
      const slot = path[i]
      if (!slot) break
      assigned.set(slot.id, entries[i]!)
      usedSlotIds.add(slot.id)
    }
  }
}

export function buildKnessetFilledSeats(
  poll: RollingPoll,
  membersByParty: Map<string, KnessetMemberRow[]>,
): KnessetFilledSeat[] {
  const seatCounts = roundSeatsTo120(poll.parties)
  const assignments = buildPartyAssignments(poll.parties, seatCounts)

  const { assigned, remaining } = assignByPartyBlocks(assignments)

  const remainingByParty = new Map<string, SlotAssignment[]>()
  for (const entry of remaining) {
    const list = remainingByParty.get(entry.partyKey) ?? []
    list.push(entry)
    remainingByParty.set(entry.partyKey, list)
  }
  for (const list of remainingByParty.values()) {
    list.sort((a, b) => a.listRank - b.listRank)
  }

  const usedSlotIds = new Set(assigned.keys())
  assignRemainingByParty(assignments, remainingByParty, assigned, usedSlotIds)

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
