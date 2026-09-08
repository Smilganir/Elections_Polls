/**
 * Per-party portrait ring colors — aligned with isr-socio-elections Knesset 25 palette,
 * with Knesset 26 list mappings per product spec.
 */

/** Canonical poll party key → ring stroke color. */
export const KNESSET_PARTY_RING_COLORS: Record<string, string> = {
  Likud: '#00B1FF',
  'Religious Zionism': '#1B6FD1',
  Shas: '#9BA8C4',
  UTJ: '#4A5568',
  'Otzma Yehudit': '#003D82',
  "Ofer Winter's Party": '#002966',
  'Yashar!': '#f7787c',
  "Bennett's Party": '#F06EAA',
  'Yesh Atid': '#F06EAA',
  'Blue & White': '#E88B7A',
  'The Democrats': '#E30613',
  'Yisrael Beiteinu': '#8B3FB2',
  'The Reservists': '#6B8FAD',
  'Joint Arab List': '#E8933A',
  "Hadash Ta'al": '#E8933A',
  "Ra'am": '#C4B845',
  Balad: '#B8956A',
}

const JOINT_ARAB_CYCLE = ["Hadash Ta'al", "Ra'am", 'Balad'] as const

export function ringColorForParty(partyKey: string, seatIndexInParty = 0): string {
  if (partyKey === 'Joint Arab List') {
    const cycleKey = JOINT_ARAB_CYCLE[seatIndexInParty % JOINT_ARAB_CYCLE.length]!
    return KNESSET_PARTY_RING_COLORS[cycleKey] ?? '#E8933A'
  }
  return KNESSET_PARTY_RING_COLORS[partyKey] ?? '#9CA3AF'
}
