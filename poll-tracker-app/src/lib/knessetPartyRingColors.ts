/**
 * Per-party portrait ring colors — aligned with isr-socio-elections Knesset 25 palette,
 * with Knesset 26 list mappings per product spec.
 */

/** Canonical poll party key → ring stroke color. */
export const KNESSET_PARTY_RING_COLORS: Record<string, string> = {
  Likud: '#00C4FF',
  'Religious Zionism': '#4598EB',
  Shas: '#ADB9CE',
  UTJ: '#8096AB',
  'Otzma Yehudit': '#4E93D4',
  "Ofer Winter's Party": '#3778BE',
  'Yashar!': '#FA6469',
  "Bennett's Party": '#F06EAA',
  'Yesh Atid': '#D4DCE8',
  'Blue & White': '#E88B7A',
  'The Democrats': '#E30613',
  'Yisrael Beiteinu': '#8B3FB2',
  'The Reservists': '#6B8FAD',
  'Bayit Yehudi–The Reservists': '#6B8FAD',
  'Joint Arab List': '#E8933A',
  "Hadash Ta'al": '#E8933A',
  "Ra'am": '#C4B845',
  Balad: '#B8956A',
}

export function ringColorForParty(partyKey: string, _seatIndexInParty = 0): string {
  return KNESSET_PARTY_RING_COLORS[partyKey] ?? '#9CA3AF'
}
