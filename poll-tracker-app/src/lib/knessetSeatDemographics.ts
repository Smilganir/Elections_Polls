import type { KnessetMemberRow } from './knessetMembersSheet'
import type { KnessetFilledSeat } from './knessetSeatAllocation'

export type KnessetMapFocus =
  | { kind: 'party'; partyKey: string }
  | { kind: 'segment'; segment: 'Coalition' | 'Opposition' }
  | { kind: 'seniority'; value: 'new' | 'veteran' }
  | { kind: 'gender'; value: 'female' | 'male' }
  | { kind: 'military'; value: MilitaryFocusValue }
  | { kind: 'age'; value: AgeBinId }
  | { kind: 'knessetYears'; value: KnessetYearsBinId }
  | { kind: 'education'; value: EducationBucket }
  | { kind: 'sector'; value: SectorBucket }
  | { kind: 'preRole'; value: string }
  | { kind: 'periphery'; value: PeripheryBinId }
  | null

export type KnessetMapFocusItem = Exclude<KnessetMapFocus, null>
export type KnessetMapFilters = readonly KnessetMapFocusItem[]

/** True when any map filter narrows the projected roster (party, bloc, or demographic). */
export function knessetMapFiltersActive(filters: KnessetMapFilters): boolean {
  return filters.length > 0
}

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
  if (a.kind === 'sector' && b.kind === 'sector') return a.value === b.value
  if (a.kind === 'preRole' && b.kind === 'preRole') return a.value === b.value
  if (a.kind === 'periphery' && b.kind === 'periphery') return a.value === b.value
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
    focus.kind === 'education' ||
    focus.kind === 'sector' ||
    focus.kind === 'preRole' ||
    focus.kind === 'periphery'
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
    const bucket = classifyMilitaryService(member.militaryService)
    if (focus.value === 'served') {
      return isMilitaryServiceServed(bucket)
    }
    return bucket === focus.value
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
  if (focus.kind === 'sector') {
    return classifySector(member.sector) === focus.value
  }
  if (focus.kind === 'preRole') {
    return normalizePreKnessetRole(member.preKnessetRole) === focus.value
  }
  if (focus.kind === 'periphery') {
    const grade = parseMemberPeripheryGrade(member.peripheryGrade)
    if (grade == null) return false
    const bin = PERIPHERY_BIN_DEFS.find((d) => grade >= d.min && grade < d.max)
    return bin?.id === focus.value
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

/** Column W — מגזר (sheet taxonomy). */
export const SECTOR_BUCKETS = [
  'secular',
  'traditional',
  'religious',
  'haredi',
  'arab',
  'druze',
] as const
export type SectorBucket = (typeof SECTOR_BUCKETS)[number]

const SECTOR_HEBREW: Record<SectorBucket, string> = {
  secular: 'חילוני',
  traditional: 'מסורתי',
  religious: 'דתי',
  haredi: 'חרדי',
  arab: 'ערבי',
  druze: 'דרוזי',
}

/** Column N — שירות צבאי/לאומי breakdown (sheet taxonomy). */
export const MILITARY_SERVICE_BUCKETS = [
  'regular',
  'officer',
  'national_service',
  'not_served',
  'unknown',
] as const
export type MilitaryServiceBucket = (typeof MILITARY_SERVICE_BUCKETS)[number]

/** Donut aggregate filter: any served bucket (regular, officer, national). */
export type MilitaryFocusValue = MilitaryServiceBucket | 'served'

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

/** Column V — ציון פריפריה (1-10); integer score bins. */
export const PERIPHERY_BIN_DEFS = [
  { id: '0', min: 0, max: 1, optional: true },
  { id: '1', min: 1, max: 2, optional: false },
  { id: '2', min: 2, max: 3, optional: true },
  { id: '3', min: 3, max: 4, optional: false },
  { id: '4', min: 4, max: 5, optional: false },
  { id: '5', min: 5, max: 6, optional: false },
  { id: '6', min: 6, max: 7, optional: false },
  { id: '7', min: 7, max: 8, optional: false },
  { id: '8', min: 8, max: 9, optional: false },
  { id: '9', min: 9, max: 10, optional: false },
  { id: '10', min: 10, max: 11, optional: false },
] as const

export type PeripheryBinId = (typeof PERIPHERY_BIN_DEFS)[number]['id']

export type KnessetAgeBin = {
  id: AgeBinId
  count: number
}

export type KnessetYearsBin = {
  id: KnessetYearsBinId
  count: number
}

export type KnessetPeripheryBin = {
  id: PeripheryBinId
  count: number
}

export type KnessetEducationShare = {
  bucket: EducationBucket
  count: number
  share: number
}

export type KnessetMilitaryServiceShare = {
  bucket: MilitaryServiceBucket
  count: number
  share: number
}

export type KnessetSectorShare = {
  bucket: SectorBucket
  count: number
  share: number
}

export type KnessetPreRoleShare = {
  key: string
  count: number
  share: number
}

export type KnessetDemographics = {
  memberCount: number
  newPct: number | null
  femalePct: number | null
  servedPct: number | null
  /** Mean age (years) among members with a known age. */
  avgAge: number | null
  /** Mean Knesset tenure (years), including explicit 0. */
  avgKnessetYears: number | null
  ageBins: KnessetAgeBin[]
  knessetYearsBins: KnessetYearsBin[]
  peripheryBins: KnessetPeripheryBin[]
  /** Mean periphery grade (0–10) among members with a known score. */
  avgPeripheryGrade: number | null
  education: KnessetEducationShare[]
  militaryService: KnessetMilitaryServiceShare[]
  sector: KnessetSectorShare[]
  preRole: KnessetPreRoleShare[]
}

const UNKNOWN_FIELD = /^(אין מידע|\-|,|\s)*$/

const UNKNOWN_EDU = UNKNOWN_FIELD

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

export function classifySector(raw: string): SectorBucket | null {
  const t = raw.trim()
  if (!t || UNKNOWN_FIELD.test(t) || t.startsWith('אין מידע')) return null
  const entry = (Object.entries(SECTOR_HEBREW) as [SectorBucket, string][]).find(
    ([, label]) => label === t,
  )
  return entry?.[0] ?? null
}

export function sectorHebrewLabel(bucket: SectorBucket): string {
  return SECTOR_HEBREW[bucket]
}

const SECTOR_ENGLISH: Record<SectorBucket, string> = {
  secular: 'Secular',
  traditional: 'Traditional',
  religious: 'Religious',
  haredi: 'Haredi',
  arab: 'Arab',
  druze: 'Druze',
}

const PRE_ROLE_ENGLISH: Record<string, string> = {
  'חברה אזרחית': 'Civil society',
  'ניסיון בשלטון המקומי': 'Local government',
  'עובדי מדינה': 'Civil servants',
  'צמחו במנגנון הפוליטי': 'Political machine',
  'עסקו בחינוך': 'Education',
  'אנשי ביטחון': 'Security',
  'ניסיון עסקי': 'Business',
  'הוסמכו כעורכי דין': 'Legal',
  'עסקו בתקשורת': 'Media',
  דת: 'Religion',
  'וועדי עובדים': 'Labor unions',
  בריאות: 'Health',
  אחר: 'Other',
  אקדמאי: 'Academic',
}

export function sectorChartLabel(bucket: SectorBucket, locale: 'en' | 'he'): string {
  return locale === 'he' ? sectorHebrewLabel(bucket) : SECTOR_ENGLISH[bucket]
}

export function preKnessetRoleChartLabel(key: string, locale: 'en' | 'he'): string {
  if (locale === 'he') return key
  return PRE_ROLE_ENGLISH[key] ?? key
}

export function normalizePreKnessetRole(raw: string): string | null {
  const t = raw.trim()
  if (!t || UNKNOWN_FIELD.test(t) || t.startsWith('אין מידע')) return null
  return t
}

const UNKNOWN_MILITARY = UNKNOWN_FIELD

const MILITARY_NATIONAL = /שירות\s*לאומי/

/** Negated national-service clause — strip before national-service detection. */
const MILITARY_NATIONAL_NEGATED = /לא\s+שירת[\u0590-\u05FF]*\s+ב?שירות\s*לאומי/gi

const MILITARY_NOT_SERVED = /^לא\s*שירת/

/** Commissioned officer — סגן and above (incl. סג"מ), plus explicit קצין / command roles. */
const MILITARY_OFFICER =
  /קצינ(?:ה|ים|ת)?(?:\s|$|[,\/"'])|קצון(?:ה|ים)\s*בקבע|קצין\s*בקבע|קצין\s*ב(?:צה"ל|צה״ל|דימוס)|בדימוס\s*בדרגת|(?:^|[\s,./;]|")(?:רב-?אלוף|תת-?אלוף|אלוף|אל"מ|אל״מ|סא"ל|סא״ל|רס"ן|רס״ן|רב-?סרן|סרן|סג"מ|סג״מ|סגן(?:\s*משנה)?)(?:[\s,."']|$|במיל)|(?:^|[\s,./;]|")סגן(?:[\s,."']|$|-)|(?:^|[\s,])(?:מג"ד|מג״ד|סמג"ד|סמג״ד)(?:[\s,]|$)|ראש\s*אגף|מפקד\s*(?:גדוד|חטיב|טייסת|גיס|יחיד)/

const MILITARY_REGULAR = /(?:^|[,\s])סדיר(?:[,\s]|$)/

const MILITARY_SHORTENED = /שירות\s*מקוצר|שלב\s*ב['׳']/

/** Career service without an explicit rank token (e.g. "קבע, מגלן"). */
const MILITARY_CAREER_BARE = /(?:^|[,\s/])קבע(?:[,\s/]|$)/

const MILITARY_SERVED_HINT =
  /צה"ל|צה״ל|מילואים|שירת|גדוד|חטיב|טייס|שייטת|דובדן|יחידת|לוחם|קרב|נח"ל|גולני|גבעתי|סמל|פרמדיק|חי"ר|צנחנ|עורף|מודיעין|חיל/

function preprocessMilitaryServiceText(raw: string): string {
  return raw.trim().replace(MILITARY_NATIONAL_NEGATED, '').trim()
}

export function isMilitaryServiceServed(bucket: MilitaryServiceBucket): boolean {
  return bucket === 'regular' || bucket === 'officer'
}

export function classifyMilitaryService(raw: string): MilitaryServiceBucket {
  const t = preprocessMilitaryServiceText(raw)
  if (!t || UNKNOWN_MILITARY.test(t) || t.startsWith('אין מידע')) return 'unknown'
  if (MILITARY_NOT_SERVED.test(t)) {
    return MILITARY_NATIONAL.test(t) ? 'national_service' : 'not_served'
  }
  if (MILITARY_NATIONAL.test(t)) return 'national_service'
  if (MILITARY_OFFICER.test(t)) return 'officer'
  if (MILITARY_REGULAR.test(t)) return 'regular'
  if (MILITARY_SHORTENED.test(t)) return 'regular'
  if (MILITARY_CAREER_BARE.test(t)) return 'regular'
  if (MILITARY_SERVED_HINT.test(t)) return 'regular'
  return 'unknown'
}

export function classifyMilitary(raw: string): 'served' | 'not_served' | null {
  const bucket = classifyMilitaryService(raw)
  if (bucket === 'unknown') return null
  if (isMilitaryServiceServed(bucket)) return 'served'
  return 'not_served'
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

export function parseMemberPeripheryGrade(raw: string): number | null {
  const t = raw.trim()
  if (!t || UNKNOWN_FIELD.test(t) || t.startsWith('אין מידע')) return null
  const n = Number.parseFloat(t)
  if (!Number.isFinite(n) || n < 0 || n > 10) return null
  return n
}

export function peripheryBinLabel(id: string): string {
  return id
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

/**
 * Military served (regular/officer only) as a share of projected MKs with known service info.
 * National service counts in the denominator but not the numerator (matches hero donut).
 */
export function militaryServedPctOfAll(seats: readonly KnessetFilledSeat[]): number | null {
  const members = projectedMembers(seats)
  let served = 0
  let known = 0
  for (const m of members) {
    const bucket = classifyMilitaryService(m.militaryService)
    if (bucket === 'unknown') continue
    known++
    if (isMilitaryServiceServed(bucket)) served++
  }
  return known > 0 ? served / known : null
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
  const peripheryCounts = new Map<PeripheryBinId, number>()
  for (const def of PERIPHERY_BIN_DEFS) peripheryCounts.set(def.id, 0)
  const eduCounts = new Map<EducationBucket, number>()
  for (const b of EDUCATION_BUCKETS) eduCounts.set(b, 0)
  const sectorCounts = new Map<SectorBucket, number>()
  for (const b of SECTOR_BUCKETS) sectorCounts.set(b, 0)
  const preRoleCounts = new Map<string, number>()
  const militaryCounts = new Map<MilitaryServiceBucket, number>()
  for (const b of MILITARY_SERVICE_BUCKETS) militaryCounts.set(b, 0)
  let ageSum = 0
  let ageCount = 0
  let knessetYearsSum = 0
  let knessetYearsCount = 0
  let peripherySum = 0
  let peripheryCount = 0

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

    const milBucket = classifyMilitaryService(m.militaryService)
    militaryCounts.set(milBucket, (militaryCounts.get(milBucket) ?? 0) + 1)
    if (milBucket !== 'unknown') {
      militaryKnown++
      if (isMilitaryServiceServed(milBucket)) servedCount++
    }

    const age = parseMemberAge(m.age)
    if (age != null) {
      ageSum += age
      ageCount++
      const bin = AGE_BIN_DEFS.find((d) => age >= d.min && age < d.max)
      if (bin) ageCounts.set(bin.id, (ageCounts.get(bin.id) ?? 0) + 1)
    }

    const knessetYears = parseMemberKnessetYears(m.knessetYears)
    if (knessetYears != null) {
      knessetYearsSum += knessetYears
      knessetYearsCount++
      const bin = KNESSET_YEARS_BIN_DEFS.find((d) => knessetYears >= d.min && knessetYears < d.max)
      if (bin) knessetYearsCounts.set(bin.id, (knessetYearsCounts.get(bin.id) ?? 0) + 1)
    }

    const peripheryGrade = parseMemberPeripheryGrade(m.peripheryGrade)
    if (peripheryGrade != null) {
      peripherySum += peripheryGrade
      peripheryCount++
      const bin = PERIPHERY_BIN_DEFS.find((d) => peripheryGrade >= d.min && peripheryGrade < d.max)
      if (bin) peripheryCounts.set(bin.id, (peripheryCounts.get(bin.id) ?? 0) + 1)
    }

    const edu = classifyEducation(m.education)
    if (edu) eduCounts.set(edu, (eduCounts.get(edu) ?? 0) + 1)

    const sector = classifySector(m.sector)
    if (sector) sectorCounts.set(sector, (sectorCounts.get(sector) ?? 0) + 1)

    const preRole = normalizePreKnessetRole(m.preKnessetRole)
    if (preRole) preRoleCounts.set(preRole, (preRoleCounts.get(preRole) ?? 0) + 1)
  }

  const eduTotal = EDUCATION_BUCKETS.reduce((s, b) => s + (eduCounts.get(b) ?? 0), 0)
  const sectorTotal = SECTOR_BUCKETS.reduce((s, b) => s + (sectorCounts.get(b) ?? 0), 0)
  const preRoleTotal = [...preRoleCounts.values()].reduce((s, n) => s + n, 0)

  const ageBins: KnessetAgeBin[] = AGE_BIN_DEFS.filter((def) => {
    const count = ageCounts.get(def.id) ?? 0
    return !def.optional || count > 0
  }).map((def) => ({ id: def.id, count: ageCounts.get(def.id) ?? 0 }))

  const knessetYearsBins: KnessetYearsBin[] = KNESSET_YEARS_BIN_DEFS.filter((def) => {
    const count = knessetYearsCounts.get(def.id) ?? 0
    return !def.optional || count > 0
  }).map((def) => ({ id: def.id, count: knessetYearsCounts.get(def.id) ?? 0 }))

  const peripheryBins: KnessetPeripheryBin[] = PERIPHERY_BIN_DEFS.filter((def) => {
    const count = peripheryCounts.get(def.id) ?? 0
    return !def.optional || count > 0
  }).map((def) => ({ id: def.id, count: peripheryCounts.get(def.id) ?? 0 }))

  return {
    memberCount: members.length,
    newPct: ratio(newCount, seniorityKnown),
    femalePct: ratio(femaleCount, genderKnown),
    servedPct: ratio(servedCount, militaryKnown),
    avgAge: ageCount > 0 ? ageSum / ageCount : null,
    avgKnessetYears: knessetYearsCount > 0 ? knessetYearsSum / knessetYearsCount : null,
    ageBins,
    knessetYearsBins,
    peripheryBins,
    avgPeripheryGrade: peripheryCount > 0 ? peripherySum / peripheryCount : null,
    education: EDUCATION_BUCKETS.map((bucket) => {
      const count = eduCounts.get(bucket) ?? 0
      return { bucket, count, share: eduTotal > 0 ? count / eduTotal : 0 }
    }),
    militaryService: MILITARY_SERVICE_BUCKETS.map((bucket) => {
      const count = militaryCounts.get(bucket) ?? 0
      return {
        bucket,
        count,
        share: members.length > 0 ? count / members.length : 0,
      }
    }),
    sector: SECTOR_BUCKETS.map((bucket) => {
      const count = sectorCounts.get(bucket) ?? 0
      return { bucket, count, share: sectorTotal > 0 ? count / sectorTotal : 0 }
    }),
    preRole: [...preRoleCounts.entries()]
      .map(([key, count]) => ({
        key,
        count,
        share: preRoleTotal > 0 ? count / preRoleTotal : 0,
      }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, 'he')),
  }
}

export function formatPctLabel(portion: number): string {
  return `${Math.round(portion * 100)}%`
}

export function formatDemographicMean(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}
