import {
  PARTY_SEGMENT_BY_KEY,
  SEGMENT_COLORS,
  segmentRingColorForSummary,
} from '../config/mappings'
import type { Segment } from '../types/data'

type TrendBloc = 'Coalition' | 'Opposition' | 'Arabs'

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0'))
    .join('')}`
}

function mixHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t)
}

function trendBloc(segment: Segment, mergeArabsWithOpposition: boolean): TrendBloc {
  if (segment === 'Arabs') return mergeArabsWithOpposition ? 'Opposition' : 'Arabs'
  return segment
}

function shadesForBloc(bloc: TrendBloc, count: number): string[] {
  if (count <= 0) return []
  const base =
    bloc === 'Coalition'
      ? SEGMENT_COLORS.Coalition
      : bloc === 'Arabs'
        ? SEGMENT_COLORS.Arabs
        : SEGMENT_COLORS.Opposition
  if (count === 1) return [base]

  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1)
    if (bloc === 'Coalition') {
      if (t <= 0.5) return mixHex(base, '#002966', 0.38 * (1 - t * 2))
      return mixHex(base, '#FFFFFF', 0.42 * ((t - 0.5) * 2))
    }
    if (bloc === 'Opposition') {
      return mixHex(base, '#7A8FA8', t * 0.58)
    }
    if (t <= 0.5) return mixHex(base, '#434A52', 0.42 * (1 - t * 2))
    return mixHex(base, '#B0B7BF', 0.38 * ((t - 0.5) * 2))
  })
}

/**
 * When multiple selected parties share a bloc, assign distinct line colors:
 * darker/lighter blues (coalition), grey-white steps (opposition), grey steps (Arabs).
 */
export function blocTrendLineColors(
  parties: string[],
  segmentForParty: (party: string) => Segment,
  mergeArabsWithOpposition: boolean,
): Map<string, string> {
  const byBloc = new Map<TrendBloc, string[]>()
  for (const party of parties) {
    const bloc = trendBloc(segmentForParty(party), mergeArabsWithOpposition)
    if (!byBloc.has(bloc)) byBloc.set(bloc, [])
    byBloc.get(bloc)!.push(party)
  }

  const colors = new Map<string, string>()
  for (const [bloc, blocParties] of byBloc) {
    const sorted = [...blocParties].sort((a, b) => a.localeCompare(b))
    const shades = shadesForBloc(bloc, sorted.length)
    sorted.forEach((party, i) => {
      colors.set(party, shades[i]!)
    })
  }
  return colors
}

/** Base segment ring color for one party (no multi-party shading). */
export function basePartyTrendColor(
  party: string,
  segmentForParty: (party: string) => Segment,
  mergeArabsWithOpposition: boolean,
): string {
  return segmentRingColorForSummary(segmentForParty(party), mergeArabsWithOpposition)
}

export function segmentForPartyKey(
  party: string,
  segmentFromRow?: Segment,
): Segment {
  return segmentFromRow ?? PARTY_SEGMENT_BY_KEY[party] ?? 'Opposition'
}
