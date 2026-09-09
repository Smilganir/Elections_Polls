import type { KnessetMemberRow } from './knessetMembersSheet'
import type { KnessetFilledSeat } from './knessetSeatAllocation'

export type KnessetMapFocus =
  | { kind: 'party'; partyKey: string }
  | { kind: 'segment'; segment: 'Coalition' | 'Opposition' }
  | { kind: 'seniority'; value: 'new' | 'veteran' }
  | { kind: 'gender'; value: 'female' | 'male' }
  | { kind: 'military'; value: 'served' | 'not_served' }
  | { kind: 'age'; value: AgeBinId }
  | { kind: 'knessetYears'; value: KnessetYearsBinId }
  | { kind: 'education'; value: EducationBucket }
  | null

export type KnessetMapFocusItem = Exclude<KnessetMapFocus, null>
export type KnessetMapFilters = readonly KnessetMapFocusItem[]

export function mapFocusEquals(a: KnessetMapFocus, b: KnessetMapFocus): boolean {
  if (a === b) return true
  if (!a || !b) return false
  if (a.kind !== b.kind) return false
  if (a.kind === 'party' && b.kind === 'party') return a.partyKey === b.partyKey
  if (a.kind === 'segment' && b.kind === 'segment') return a.segment === b.segment
  if (a.kind === 'seniority' && b.kind === 'seniority') return a.value === b.value
  if (a.kind === 'gender' && b.kind === 'gender') return a.value === b.value
  if (a.kind === 'military' && b.kind === 'military') return a.value === b.value
  if (a.kind === 'age' && b.kind === 'age') return a.value === b.value
  if (a.kind === 'knessetYears' && b.kind === 'knessetYears') return a.value === b.value
  if (a.kind === 'education' && b.kind === 'education') return a.value === b.value
  return false
}

export function isDemographicFocus(focus: KnessetMapFocus): boolean {
  if (!focus) return false
  return (
    focus.kind === 'seniority' ||
    focus.kind === 'gender' ||
    focus.kind === 'military' ||
    focus.kind === 'age' ||
    focus.kind === 'knessetYears' ||
    focus.kind === 'education'
  )
}

export function filtersInclude(
  filters: KnessetMapFilters,
  item: KnessetMapFocusItem,
): boolean {
  return filters.some((f) => mapFocusEquals(f, item))
}

/** Chart stats: apply all filters except the chart's own demographic kind (avoids 100% self-selection). */
export function chartStatsExcludingKind(
  filters: KnessetMapFilters,
  excludeKind: KnessetMapFocusItem['kind'],
): KnessetMapFilters {
  return filters.filter((f) => f.kind !== excludeKind)
}

/** Toggle one filter; same-kind picks replace; different kinds stack (AND). */
export function toggleMapFilter(
  filters: KnessetMapFilters,
  item: KnessetMapFocusItem,
): KnessetMapFocusItem[] {
  const idx = filters.findIndex((f) => mapFocusEquals(f, item))
  if (idx >= 0) return filters.filter((_, i) => i !== idx)
  const sameKindIdx = filters.findIndex((f) => f.kind === item.kind)
  if (sameKindIdx >= 0) {
    return filters.map((f, i) => (i === sameKindIdx ? item : f))
  }
  return [...filters, item]
}

function memberMatchesDemographic(
  member: KnessetMemberRow,
  focus: Exclude<KnessetMapFocus, null>,
): boolean {
  if (focus.kind === 'seniority') {
    return focus.value === 'new' ? member.seniority === 'new' : member.seniority === 'veteran'
  }
  if (focus.kind === 'gender') {
    return focus.value === 'female' ? member.gender.trim() === 'נקבה' : member.gender.trim() === 'זכר'
  }
  if (focus.kind === 'military') {
    const mil = classifyMilitary(member.militaryService)
    if (!mil) return false
    return focus.value === 'served' ? mil === 'served' : mil === 'not_served'
  }
  if (focus.kind === 'age') {
    const age = parseMemberAge(member.age)
    if (age == null) return false
    const bin = AGE_BIN_DEFS.find((d) => age >= d.min && age < d.max)
    return bin?.id === focus.value
  }
  if (focus.kind === 'knessetYears') {
    const years = parseMemberKnessetYears(member.knessetYears)
    if (years == null) return false
    const bin = KNESSET_YEARS_BIN_DEFS.find((d) => years >= d.min && years < d.max)
    return bin?.id === focus.value
  }
  if (focus.kind === 'education') {
    return classifyEducation(member.education) === focus.value
  }
  return false
}

export function seatMatchesFocus(
  seat: KnessetFilledSeat,
  focus: KnessetMapFocus,
  mergeArabsWithOpposition: boolean,
): boolean {
  if (!focus) return true
  if (focus.kind === 'party') return seat.partyKey === focus.partyKey
  if (focus.kind === 'segment') {
    if (focus.segment === 'Coalition') return seat.segment === 'Coalition'
    if (mergeArabsWithOpposition) {
      return seat.segment === 'Opposition' || seat.segment === 'Arabs'
    }
    return seat.segment === 'Opposition'
  }
  if (seat.kind !== 'member') return false
  return memberMatchesDemographic(seat.member, focus)
}

export function seatMatchesFilters(
  seat: KnessetFilledSeat,
  filters: KnessetMapFilters,
  mergeArabsWithOpposition: boolean,
): boolean {
  if (!filters.length) return true
  return filters.every((f) => seatMatchesFocus(seat, f, mergeArabsWithOpposition))
}

export function filterSeatsByFocus(
  seats: readonly KnessetFilledSeat[],
  focus: KnessetMapFocus,
  mergeArabsWithOpposition: boolean,
): KnessetFilledSeat[] {
  if (!focus) return [...seats]
  return seats.filter((seat) => seatMatchesFocus(seat, focus, mergeArabsWithOpposition))
}

export function filterSeatsByFilters(
  seats: readonly KnessetFilledSeat[],
  filters: KnessetMapFilters,
  mergeArabsWithOpposition: boolean,
): KnessetFilledSeat[] {
  if (!filters.length) return [...seats]
  return seats.filter((seat) => seatMatchesFilters(seat, filters, mergeArabsWithOpposition))
}

export function partyKeysMatchingFilters(
  seats: readonly KnessetFilledSeat[],
  filters: KnessetMapFilters,
  mergeArabsWithOpposition: boolean,
): Set<string> {
  const keys = new Set<string>()
  if (!filters.length) return keys
  for (const seat of seats) {
    if (seatMatchesFilters(seat, filters, mergeArabsWithOpposition)) {
      keys.add(seat.partyKey)
    }
  }
  return keys
}

export const EDUCATION_BUCKETS = ['torah', 'highschool', 'ba', 'ma', 'phd'] as const
export type EducationBucket = (typeof EDUCATION_BUCKETS)[number]

export const AGE_BIN_DEFS = [
  { id: '20', min: 20, max: 30, optional: false },
  { id: '30', min: 30, max: 40, optional: false },
  { id: '40', min: 40, max: 50, optional: false },
  { id: '50', min: 50, max: 60, optional: false },
  { id: '60', min: 60, max: 70, optional: false },
  { id: '70', min: 70, max: 80, optional: false },
  { id: '80', min: 80, max: Number.POSITIVE_INFINITY, optional: true },
] as const

export type AgeBinId = (typeof AGE_BIN_DEFS)[number]['id']

/** Column L — ותק בכנסת (שנים); 5-year bins (30+ optional when empty). */
export const KNESSET_YEARS_BIN_DEFS = [
  { id: '0', min: 0, max: 5, optional: false },
  { id: '5', min: 5, max: 10, optional: false },
  { id: '10', min: 10, max: 15, optional: false },
  { id: '15', min: 15, max: 20, optional: false },
  { id: '20', min: 20, max: 25, optional: true },
  { id: '25', min: 25, max: 30, optional: true },
  { id: '30', min: 30, max: Number.POSITIVE_INFINITY, optional: true },
] as const

export type KnessetYearsBinId = (typeof KNESSET_YEARS_BIN_DEFS)[number]['id']

export type KnessetAgeBin = {
  id: AgeBinId
  count: number
}

export type KnessetYearsBin = {
  id: KnessetYearsBinId
  count: number
}

export type KnessetEducationShare = {
  bucket: EducationBucket
  count: number
  share: number
}

export type KnessetDemographics = {
  memberCount: number
  newPct: number | null
  femalePct: number | null
  servedPct: number | null
  ageBins: KnessetAgeBin[]
  knessetYearsBins: KnessetYearsBin[]
  education: KnessetEducationShare[]
}

const UNKNOWN_EDU = /^(אין מידע|\-|,|\s)*$/

export function classifyEducation(raw: string): EducationBucket | null {
  const t = raw.trim()
  if (!t || UNKNOWN_EDU.test(t) || t.startsWith('אין מידע')) return null
  if (/דוקטור|Ph\.?D/i.test(t)) return 'phd'
  if (t.includes('תואר שני')) return 'ma'
  if (t.includes('תואר ראשון')) return 'ba'
  if (t.includes('תיכונית')) return 'highschool'
  if (t.includes('תורנית')) return 'torah'
  return null
}

export function classifyMilitary(raw: string): 'served' | 'not_served' | null {
  const t = raw.trim()
  if (!t || t === 'אין מידע' || t.startsWith('אין מידע')) return null
  if (t.startsWith('לא שירתו')) {
    return t.includes('שירות לאומי') ? 'served' : 'not_served'
  }
  return 'served'
}

export function parseMemberAge(raw: string): number | null {
  const n = Number.parseInt(raw.trim(), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function parseMemberKnessetYears(raw: string): number | null {
  const t = raw.trim()
  if (!t || t === 'אין מידע' || t.startsWith('אין מידע')) return null
  const n = Number.parseInt(t, 10)
  return Number.isFinite(n) && n >= 0 ? n : null
}

export function knessetYearsBinLabel(id: string): string {
  if (id === '30') return '30+'
  const start = Number(id)
  return `${start}–${start + 5}`
}

export function projectedMembers(seats: readonly KnessetFilledSeat[]): KnessetMemberRow[] {
  const out: KnessetMemberRow[] = []
  for (const seat of seats) {
    if (seat.kind === 'member') out.push(seat.member)
  }
  return out
}

function ratio(part: number, whole: number): number | null {
  if (whole <= 0) return null
  return part / whole
}

export function summarizeProjectedKnesset(
  seats: readonly KnessetFilledSeat[],
): KnessetDemographics {
  const members = projectedMembers(seats)

  let newCount = 0
  let seniorityKnown = 0
  let femaleCount = 0
  let genderKnown = 0
  let servedCount = 0
  let militaryKnown = 0
  const ageCounts = new Map<AgeBinId, number>()
  for (const def of AGE_BIN_DEFS) ageCounts.set(def.id, 0)
  const knessetYearsCounts = new Map<KnessetYearsBinId, number>()
  for (const def of KNESSET_YEARS_BIN_DEFS) knessetYearsCounts.set(def.id, 0)
  const eduCounts = new Map<EducationBucket, number>()
  for (const b of EDUCATION_BUCKETS) eduCounts.set(b, 0)

  for (const m of members) {
    if (m.seniority === 'new' || m.seniority === 'veteran') {
      seniorityKnown++
      if (m.seniority === 'new') newCount++
    }

    const g = m.gender.trim()
    if (g === 'נקבה' || g === 'זכר') {
      genderKnown++
      if (g === 'נקבה') femaleCount++
    }

    const mil = classifyMilitary(m.militaryService)
    if (mil) {
      militaryKnown++
      if (mil === 'served') servedCount++
    }

    const age = parseMemberAge(m.age)
    if (age != null) {
      const bin = AGE_BIN_DEFS.find((d) => age >= d.min && age < d.max)
      if (bin) ageCounts.set(bin.id, (ageCounts.get(bin.id) ?? 0) + 1)
    }

    const knessetYears = parseMemberKnessetYears(m.knessetYears)
    if (knessetYears != null) {
      const bin = KNESSET_YEARS_BIN_DEFS.find((d) => knessetYears >= d.min && knessetYears < d.max)
      if (bin) knessetYearsCounts.set(bin.id, (knessetYearsCounts.get(bin.id) ?? 0) + 1)
    }

    const edu = classifyEducation(m.education)
    if (edu) eduCounts.set(edu, (eduCounts.get(edu) ?? 0) + 1)
  }

  const eduTotal = EDUCATION_BUCKETS.reduce((s, b) => s + (eduCounts.get(b) ?? 0), 0)

  const ageBins: KnessetAgeBin[] = AGE_BIN_DEFS.filter((def) => {
    const count = ageCounts.get(def.id) ?? 0
    return !def.optional || count > 0
  }).map((def) => ({ id: def.id, count: ageCounts.get(def.id) ?? 0 }))

  const knessetYearsBins: KnessetYearsBin[] = KNESSET_YEARS_BIN_DEFS.filter((def) => {
    const count = knessetYearsCounts.get(def.id) ?? 0
    return !def.optional || count > 0
  }).map((def) => ({ id: def.id, count: knessetYearsCounts.get(def.id) ?? 0 }))

  return {
    memberCount: members.length,
    newPct: ratio(newCount, seniorityKnown),
    femalePct: ratio(femaleCount, genderKnown),
    servedPct: ratio(servedCount, militaryKnown),
    ageBins,
    knessetYearsBins,
    education: EDUCATION_BUCKETS.map((bucket) => {
      const count = eduCounts.get(bucket) ?? 0
      return { bucket, count, share: eduTotal > 0 ? count / eduTotal : 0 }
    }),
  }
}

export function formatPctLabel(portion: number): string {
  return `${Math.round(portion * 100)}%`
}
