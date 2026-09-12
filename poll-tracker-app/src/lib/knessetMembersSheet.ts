import type { Segment } from '../types/data'

/** Public CSV export for Knesset 26 closed candidate lists. */
export const KNESSET26_CANDIDATES_SPREADSHEET_ID =
  '1oHaO9UKuLn1MR6iAQ2URu8XC62AkfoTN7zYAXxcV9SQ'

const CANDIDATES_SHEET_GID = '2119255863'
const CANDIDATES_CSV_URL = `https://docs.google.com/spreadsheets/d/${KNESSET26_CANDIDATES_SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${CANDIDATES_SHEET_GID}`

export type KnessetMemberSeniority = 'veteran' | 'new' | 'unknown'

export type KnessetMemberRow = {
  partyHeb: string
  partyKey: string | null
  listRank: number
  name: string
  /** תמונה שקופה (URL) — transparent cutout for hemicycle seats. */
  imageUrl: string
  /** קישור לתמונה (וויקיפדיה) — fuller portrait for tooltips. */
  portraitImageUrl: string
  seniority: KnessetMemberSeniority
  /** מין */
  gender: string
  /** גיל */
  age: string
  /** ניסיון מקצועי */
  professionalExperience: string
  /** ותק בכנסת (שנים) */
  knessetYears: string
  /** השכלה — free-text detail for tooltips */
  education: string
  /** השכלה קטגוריה — normalized bucket for demographic charts */
  educationCategory: string
  /** שירות צבאי/לאומי — free-text detail for tooltips */
  militaryService: string
  /** שירות צבאי קטגוריה — normalized bucket for demographic charts */
  militaryServiceCategory: string
  /** ציון פריפריה (1-10) */
  peripheryGrade: string
  /** עיר */
  city: string
  /** מגזר */
  sector: string
  /** תת-זהות (optional; absent on v2 sheet) */
  subIdentity: string
  /** עובדה מעניינת */
  funFact: string
  /** תפקיד קדם-כנסת 1 (קטגוריה) */
  preKnessetRole: string
  /** מקורות — provenance line for tooltips */
  sources: string
}

/** Hebrew sheet list name → canonical unpivot party key. */
export const HEBREW_LIST_TO_PARTY_KEY: Record<string, string> = {
  'ביחד': "Bennett's Party",
  'יחד': "Bennett's Party",
  'הליכוד': 'Likud',
  'ישר! עם איזנקוט': 'Yashar!',
  'ישראל ביתנו': 'Yisrael Beiteinu',
  'הדמוקרטים': 'The Democrats',
  'עוצמה יהודית': 'Otzma Yehudit',
  'יהדות התורה': 'UTJ',
  'ש"ס': 'Shas',
  'רע"ם': "Ra'am",
  'עמך ישראל': "Ofer Winter's Party",
  /** Knesset 26 merged list (sheet rows ~246–265). */
  'המילואימניקים - הכלכלית': 'Bayit Yehudi–The Reservists',
  'המילואימניקים': 'Bayit Yehudi–The Reservists',
  'הבית הציוני': 'Bayit Yehudi–The Reservists',
  'בית ציוני-המילואימניקים': 'Bayit Yehudi–The Reservists',
  'הרשימה המשותפת': 'Joint Arab List',
  'הציונות הדתית + זהות': 'Religious Zionism',
  'כחול לבן': 'Blue & White',
  נעם: 'Noam',
  'נעם לישראל': 'Noam',
}

export function partyKeyFromHebrewList(partyHeb: string): string | null {
  const t = partyHeb.trim()
  return HEBREW_LIST_TO_PARTY_KEY[t] ?? null
}

function parseSeniority(raw: string): KnessetMemberSeniority {
  const t = raw.trim()
  if (t === 'ותיק') return 'veteran'
  if (t === 'חדש') return 'new'
  return 'unknown'
}

/** Parse one CSV line respecting quoted fields. */
function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

const HEADER_PARTY = 'מפלגה'
const HEADER_RANK = 'מקום ברשימה'
const HEADER_NAME = 'שם המועמד/ת'
/** Column Q — Cloudinary/Drive cutouts used on the hemicycle. */
const HEADER_TRANSPARENT_IMAGE = 'תמונה שקופה (URL)'
/** Column D — Wikipedia / source stills (tooltip portrait). */
const HEADER_WIKI_IMAGE = 'קישור לתמונה (וויקיפדיה)'
/** Column E — תמונה */
const HEADER_PHOTO = 'תמונה'
const HEADER_SENIORITY = 'ותק'
const HEADER_GENDER = 'מין'
const HEADER_AGE = 'גיל'
const HEADER_PROFESSIONAL = 'ניסיון מקצועי'
const HEADER_KNESSET_YEARS = 'ותק בכנסת (שנים)'
const HEADER_EDUCATION = 'השכלה'
const HEADER_EDUCATION_CATEGORY = 'השכלה קטגוריה'
const HEADER_MILITARY = 'שירות צבאי/לאומי'
const HEADER_MILITARY_CATEGORY = 'שירות צבאי קטגוריה'
const HEADER_PERIPHERY_GRADE = 'ציון פריפריה (1-10)'
const HEADER_CITY = 'עיר'
const HEADER_SECTOR = 'מגזר'
const HEADER_SUB_IDENTITY = 'תת-זהות'
const HEADER_FUN_FACT = 'עובדה מעניינת'
const HEADER_PRE_KNESSET_ROLE = 'תפקיד קדם-כנסת 1 (קטגוריה)'
const HEADER_SOURCES = 'מקורות'

const URL_IN_TEXT = /https?:\/\/[^\s;,)]+/gi

/** Sheet-derived column boilerplate — omit from tooltip sources. */
const SOURCES_SKIP_PREFIXES = ['עמודת קטגוריה לגרף']

const SOURCES_SKIP_VALUE_PATTERNS = [
  /ערך\s+מקורי\s+משולב/i,
  /שוחזר\s+מהטאב\s+הקודם/i,
  /שחזור\s+מהטאב\s+הקודם/i,
  /נרשמה\s+הקטגוריה\s+הראשונה/i,
]

export type MemberSourceGroup = { source: string; categories: string[] }

function cleanSourceText(raw: string): string {
  let t = raw.trim()
  if (!t) return ''

  t = t.replace(URL_IN_TEXT, (url) => {
    if (/wikipedia\.org/i.test(url)) return 'ויקיפדיה'
    try {
      const host = new URL(url).hostname.replace(/^www\./i, '')
      if (/ynet/i.test(host)) return 'ynet'
      return host
    } catch {
      return ''
    }
  })

  t = t.replace(/\bKnesset\s+OData\b/gi, 'אתר הכנסת')
  t = t.replace(/\bכנסת\s+OData\b/gi, 'אתר הכנסת')

  t = t.replace(/גיליון\s+Gemini\s*\(AI\)/gi, '')
  t = t.replace(/גיליון\s+Gemini/gi, '')
  t = t.replace(/\bGemini\b/gi, '')
  t = t.replace(/,?\s*מקור\s+מצוטט\s*:\s*/gi, ' ')
  t = t.replace(/\bAI\b/g, '')
  t = t.replace(/\s*\(AI\)/g, '')

  t = t.replace(/\s*ב[-\s]?v2\b/gi, '')
  t = t.replace(/\b[Vv]2\b/g, '')

  t = t.replace(/נגזר\s+מ[^\s;,(]+(?:\s+ב[^\s;,(]+)?/gi, '')
  t = t.replace(/\(מקור:\s*([^)]+)\)/gi, '$1')
  t = t.replace(/\(דרך\s+טבלת[^)]*\)/gi, '')
  t = t.replace(/\(ערך\s+אישי\)/gi, '')
  t = t.replace(/\s*\+\s*שיוך\s+מפלגתי/gi, '')
  t = t.replace(/he\.wikipedia\.org/gi, 'ויקיפדיה')

  return t.replace(/\s+/g, ' ').replace(/^[,.\s]+|[,.\s]+$/g, '').trim()
}

function canonicalizeSourceToken(fragment: string): string | null {
  const t = cleanSourceText(fragment)
  if (!t) return null
  if (/^gemini$/i.test(t) || /^ai$/i.test(t)) return null

  if (/wikipedia|ויקיפדיה/i.test(t)) return 'ויקיפדיה'
  if (/ויקינתונים|wikidata/i.test(t)) return 'ויקינתונים'
  if (/אתר\s*הכנסת/i.test(t)) return 'אתר הכנסת'
  if (/למ["״']ס/.test(t)) return 'למ"ס'

  const withoutYear = t.replace(/\b20\d{2}\b/g, '').trim()
  if (/למ["״']ס/.test(withoutYear) || (!withoutYear && /למ["״']ס/.test(t))) return 'למ"ס'
  if (!withoutYear || withoutYear.length < 2) return null

  if (/^[\u0590-\u05FFa-zA-Z0-9."'\-\s]{2,48}$/.test(withoutYear)) return withoutYear
  return null
}

function extractSourcesFromValue(value: string): string[] {
  const cleaned = cleanSourceText(value)
  if (!cleaned) return []

  const fragments = cleaned
    .split(/[/|+,]|(?:\s+ו\s+)/)
    .map((f) => f.trim())
    .filter(Boolean)

  const tokens: string[] = []
  for (const frag of fragments.length > 0 ? fragments : [cleaned]) {
    const canonical = canonicalizeSourceToken(frag)
    if (canonical) tokens.push(canonical)
  }
  return tokens
}

function shouldSkipSourceSegment(segment: string): boolean {
  if (SOURCES_SKIP_PREFIXES.some((prefix) => segment.startsWith(prefix))) return true
  return SOURCES_SKIP_VALUE_PATTERNS.some((pattern) => pattern.test(segment))
}

/** Group by source — `source: category, category, …` for tooltip display. */
export function consolidateMemberSources(raw: string): MemberSourceGroup[] {
  const t = raw.trim()
  if (!t) return []

  const bySource = new Map<string, string[]>()
  const sourceOrder: string[] = []

  for (const part of t.split(';')) {
    const segment = part.trim()
    if (!segment || shouldSkipSourceSegment(segment)) continue

    const colonIdx = segment.indexOf(':')
    if (colonIdx <= 0) continue

    const category = segment.slice(0, colonIdx).trim()
    const valuePart = segment.slice(colonIdx + 1).trim()
    if (!category || !valuePart || shouldSkipSourceSegment(valuePart)) continue

    const sources = extractSourcesFromValue(valuePart)
    if (!sources.length) continue

    for (const source of sources) {
      if (!bySource.has(source)) {
        bySource.set(source, [])
        sourceOrder.push(source)
      }
      const categories = bySource.get(source)!
      if (!categories.includes(category)) categories.push(category)
    }
  }

  return sourceOrder.map((source) => ({
    source,
    categories: bySource.get(source) ?? [],
  }))
}

export function memberSourcesPlainText(groups: readonly MemberSourceGroup[]): string {
  return groups.map((g) => `${g.source}: ${g.categories.join(', ')}`).join(' | ')
}

function headerIndex(headers: readonly string[], name: string): number {
  return headers.findIndex((h) => h.trim() === name)
}

const URL_LIKE = /^https?:\/\//i
const HEBREW_NAME = /^[\u0590-\u05FF][\u0590-\u05FF\s"'-]{2,48}$/

function isUrlLike(value: string): boolean {
  return URL_LIKE.test(value.trim())
}

/** When the name column holds an image URL, recover a Hebrew name from the row. */
function recoverHebrewName(cols: readonly string[]): string {
  for (const c of cols) {
    const t = c.trim()
    if (!t || isUrlLike(t)) continue
    if (!HEBREW_NAME.test(t)) continue
    if (
      t.includes('מפלגה') ||
      t.includes('תואר') ||
      t.includes('שירות') ||
      t.includes('ותיק') ||
      t.includes('חדש')
    ) {
      continue
    }
    return t
  }
  return ''
}

function cell(
  cols: readonly string[],
  headers: readonly string[],
  name: string,
  fallbackIndex: number,
): string {
  const i = headerIndex(headers, name)
  return (cols[i >= 0 ? i : fallbackIndex] ?? '').trim()
}

/** Prefer sheet column Q (transparent PNG); fall back to Wikipedia column D. */
export function pickMemberImageUrl(cols: readonly string[], headers: readonly string[]): string {
  const transparent = cell(cols, headers, HEADER_TRANSPARENT_IMAGE, 14)
  if (transparent) return transparent
  return cell(cols, headers, HEADER_WIKI_IMAGE, 13)
}

/** Fuller head-and-shoulders source for tooltip (D → E → seat cutout). */
export function pickMemberPortraitUrl(cols: readonly string[], headers: readonly string[]): string {
  const wiki = cell(cols, headers, HEADER_WIKI_IMAGE, 13)
  if (wiki) return wiki
  const photo = cell(cols, headers, HEADER_PHOTO, -1)
  if (photo) return photo
  return pickMemberImageUrl(cols, headers)
}

/** Hemicycle / swing seat face — transparent cutout when available, else wiki portrait. */
export function memberSeatImageUrl(member: KnessetMemberRow): string {
  return member.imageUrl || member.portraitImageUrl
}

export function parseKnessetMembersCsv(csv: string): KnessetMemberRow[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []

  const headers = parseCsvLine(lines[0]!)

  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line)
    const partyHeb = cell(cols, headers, HEADER_PARTY, 0)
    const listRank = Number.parseInt(cell(cols, headers, HEADER_RANK, 1), 10) || 0
    let name = cell(cols, headers, HEADER_NAME, 2).trim()
    if (isUrlLike(name)) name = recoverHebrewName(cols)
    const imageUrl = pickMemberImageUrl(cols, headers)
    const portraitImageUrl = pickMemberPortraitUrl(cols, headers)
    const seniority = parseSeniority(cell(cols, headers, HEADER_SENIORITY, 20))
    const gender = cell(cols, headers, HEADER_GENDER, 4)
    const age = cell(cols, headers, HEADER_AGE, 3)
    const professionalExperience = cell(cols, headers, HEADER_PROFESSIONAL, 8)
    const knessetYears = cell(cols, headers, HEADER_KNESSET_YEARS, 10)
    const education = cell(cols, headers, HEADER_EDUCATION, 18)
    const educationCategory = cell(cols, headers, HEADER_EDUCATION_CATEGORY, 21)
    const militaryService = cell(cols, headers, HEADER_MILITARY, 9)
    const militaryServiceCategory = cell(cols, headers, HEADER_MILITARY_CATEGORY, 15)
    const peripheryGrade = cell(cols, headers, HEADER_PERIPHERY_GRADE, 17)
    const city = cell(cols, headers, HEADER_CITY, 6)
    const sector = cell(cols, headers, HEADER_SECTOR, 5)
    const subIdentity = cell(cols, headers, HEADER_SUB_IDENTITY, -1)
    const funFact = cell(cols, headers, HEADER_FUN_FACT, 12)
    const preKnessetRole = cell(cols, headers, HEADER_PRE_KNESSET_ROLE, 19)
    const sources = cell(cols, headers, HEADER_SOURCES, 11)

    return {
      partyHeb,
      partyKey: partyKeyFromHebrewList(partyHeb),
      listRank,
      name,
      imageUrl,
      portraitImageUrl,
      seniority,
      gender,
      age,
      professionalExperience,
      knessetYears,
      education,
      educationCategory,
      militaryService,
      militaryServiceCategory,
      peripheryGrade,
      city,
      sector,
      subIdentity,
      funFact,
      preKnessetRole,
      sources,
    }
  })
}

let cachedMembers: KnessetMemberRow[] | null = null
let cachePromise: Promise<KnessetMemberRow[]> | null = null
let cacheStamp = 0

/** Bust in-memory roster cache (e.g. after sheet column renames). */
export function clearKnessetMembersCache(): void {
  cachedMembers = null
  cachePromise = null
  cacheStamp = Date.now()
}

export async function fetchKnessetMembers(): Promise<KnessetMemberRow[]> {
  if (cachedMembers) return cachedMembers
  if (!cachePromise) {
    const url = `${CANDIDATES_CSV_URL}&_=${cacheStamp || Date.now()}`
    cachePromise = fetch(url, { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`Knesset candidates sheet: ${r.status}`)
        return r.text()
      })
      .then((csv) => {
        cachedMembers = parseKnessetMembersCsv(csv)
        return cachedMembers
      })
      .catch((err) => {
        cachePromise = null
        throw err
      })
  }
  return cachePromise
}

export function membersByPartyKey(
  members: readonly KnessetMemberRow[],
): Map<string, KnessetMemberRow[]> {
  const m = new Map<string, KnessetMemberRow[]>()
  for (const row of members) {
    if (!row.partyKey) continue
    if (!m.has(row.partyKey)) m.set(row.partyKey, [])
    m.get(row.partyKey)!.push(row)
  }
  for (const [key, list] of m) {
    m.set(key, dedupePartyRoster(list))
  }
  const bayitReservists = m.get('Bayit Yehudi–The Reservists')
  if (bayitReservists?.length && !m.has('The Reservists')) {
    m.set('The Reservists', bayitReservists)
  }
  return m
}

/** One row per list rank / name — source sheet may contain duplicate candidates. */
function dedupePartyRoster(rows: readonly KnessetMemberRow[]): KnessetMemberRow[] {
  const byRank = new Map<number, KnessetMemberRow>()
  const byName = new Map<string, KnessetMemberRow>()
  const sorted = [...rows].sort((a, b) => a.listRank - b.listRank || a.name.localeCompare(b.name))

  for (const row of sorted) {
    const nameKey = row.name.trim()
    if (nameKey && byName.has(nameKey)) continue
    if (row.listRank > 0 && byRank.has(row.listRank)) continue
    if (row.listRank > 0) byRank.set(row.listRank, row)
    if (nameKey) byName.set(nameKey, row)
  }

  return [...byRank.values()].sort((a, b) => a.listRank - b.listRank)
}

export function segmentLabel(
  segment: Segment,
  t: { knessetMapCoalition: string; knessetMapOpposition: string; knessetMapArabs: string },
): string {
  if (segment === 'Coalition') return t.knessetMapCoalition
  if (segment === 'Arabs') return t.knessetMapArabs
  return t.knessetMapOpposition
}
