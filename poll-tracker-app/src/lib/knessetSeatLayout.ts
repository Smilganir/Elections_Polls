/**
 * Fixed 120-seat hemicycle layout digitized from the horseshoe template.
 * Coordinates are percentages of the map viewBox (0–100).
 *
 * Party wedges (see knessetSeatAllocation): opposition+Arabs on the left,
 * coalition on the right; rank 1 at each party's front-inner corner.
 */

import { KNESSET_SEAT_COORDS } from './knessetSeatCoords.data'

export type KnessetSeatZone =
  | 'opposition-wing'
  | 'opposition-arch'
  | 'arabs-center'
  | 'haredi-center'
  | 'coalition-arch'
  | 'coalition-wing'

export type KnessetSeatSlot = {
  id: number
  x: number
  y: number
  zone: KnessetSeatZone
}

/** Zone order used when assigning rounded poll seats to physical slots. */
export const KNESSET_SEAT_ZONE_FILL_ORDER: readonly KnessetSeatZone[] = [
  'opposition-wing',
  'opposition-arch',
  'arabs-center',
  'haredi-center',
  'coalition-arch',
  'coalition-wing',
]

export const KNESSET_SEAT_SLOTS: readonly KnessetSeatSlot[] = KNESSET_SEAT_COORDS

export function slotsByZone(zone: KnessetSeatZone): KnessetSeatSlot[] {
  return KNESSET_SEAT_SLOTS.filter((s) => s.zone === zone)
}

export function zoneSeatCapacity(): Map<KnessetSeatZone, number> {
  const m = new Map<KnessetSeatZone, number>()
  for (const zone of KNESSET_SEAT_ZONE_FILL_ORDER) {
    m.set(zone, slotsByZone(zone).length)
  }
  return m
}
