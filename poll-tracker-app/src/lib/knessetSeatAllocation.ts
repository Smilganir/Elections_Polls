import type { RollingPoll, RollingPollParty } from './pollRollingWindow'
import type { Segment } from '../types/data'
import {
  KNESSET_SEAT_SLOTS,
  KNESSET_SEAT_ZONE_FILL_ORDER,
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
      seatIndexInParty: number
    }
  | {
      kind: 'empty'
      slot: KnessetSeatSlot
      partyKey: string
      segment: Segment
      ringColor: string
      seatIndexInParty: number
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

type PartyBucket = {
  partyKey: string
  segment: Segment
  count: number
}

function partitionParties(
  parties: RollingPollParty[],
  seatCounts: Map<string, number>,
): {
  opposition: PartyBucket[]
  arabs: PartyBucket[]
  haredi: PartyBucket[]
  coalition: PartyBucket[]
} {
  const opposition: PartyBucket[] = []
  const arabs: PartyBucket[] = []
  const haredi: PartyBucket[] = []
  const coalition: PartyBucket[] = []

  const sorted = [...parties].sort((a, b) => b.votes - a.votes || a.party.localeCompare(b.party))

  for (const p of sorted) {
    const count = seatCounts.get(p.party) ?? 0
    if (count <= 0) continue
    const bucket: PartyBucket = { partyKey: p.party, segment: p.segment, count }

    if (p.segment === 'Arabs') {
      arabs.push(bucket)
    } else if (p.segment === 'Coalition' && HAREDI_PARTIES.has(p.party)) {
      haredi.push(bucket)
    } else if (p.segment === 'Coalition') {
      coalition.push(bucket)
    } else {
      opposition.push(bucket)
    }
  }

  return { opposition, arabs, haredi, coalition }
}

function expandBuckets(buckets: PartyBucket[]): { partyKey: string; segment: Segment }[] {
  const out: { partyKey: string; segment: Segment }[] = []
  for (const b of buckets) {
    for (let i = 0; i < b.count; i++) {
      out.push({ partyKey: b.partyKey, segment: b.segment })
    }
  }
  return out
}

const ZONE_PARTY_GROUPS: Record<KnessetSeatZone, keyof ReturnType<typeof partitionParties>> = {
  'opposition-wing': 'opposition',
  'opposition-arch': 'opposition',
  'arabs-center': 'arabs',
  'haredi-center': 'haredi',
  'coalition-arch': 'coalition',
  'coalition-wing': 'coalition',
}

export function buildKnessetFilledSeats(
  poll: RollingPoll,
  membersByParty: Map<string, KnessetMemberRow[]>,
): KnessetFilledSeat[] {
  const seatCounts = roundSeatsTo120(poll.parties)
  const groups = partitionParties(poll.parties, seatCounts)

  const queueByGroup = {
    opposition: expandBuckets(groups.opposition),
    arabs: expandBuckets(groups.arabs),
    haredi: expandBuckets(groups.haredi),
    coalition: expandBuckets(groups.coalition),
  }

  const partySeatCounter = new Map<string, number>()
  const filled: KnessetFilledSeat[] = []

  for (const zone of KNESSET_SEAT_ZONE_FILL_ORDER) {
    const groupKey = ZONE_PARTY_GROUPS[zone]
    const queue = queueByGroup[groupKey]
    const zoneSlots = KNESSET_SEAT_SLOTS.filter((s) => s.zone === zone)

    for (const slot of zoneSlots) {
      const next = queue.shift()
      if (!next) {
        filled.push({
          kind: 'empty',
          slot,
          partyKey: '',
          segment: 'Opposition',
          ringColor: '#5a6470',
          seatIndexInParty: 0,
        })
        continue
      }

      const seatIdx = partySeatCounter.get(next.partyKey) ?? 0
      partySeatCounter.set(next.partyKey, seatIdx + 1)
      const ringColor = ringColorForParty(next.partyKey, seatIdx)
      const roster = membersByParty.get(next.partyKey)
      const member = roster?.[seatIdx]

      if (!member) {
        filled.push({
          kind: 'empty',
          slot,
          partyKey: next.partyKey,
          segment: next.segment,
          ringColor,
          seatIndexInParty: seatIdx,
        })
        continue
      }

      filled.push({
        kind: 'member',
        slot,
        partyKey: next.partyKey,
        segment: next.segment,
        ringColor,
        member,
        seatIndexInParty: seatIdx,
      })
    }
  }

  return filled
}
