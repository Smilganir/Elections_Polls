import type { Segment } from '../types/data'

/** Public CSV export for Knesset 26 closed candidate lists. */
export const KNESSET26_CANDIDATES_SPREADSHEET_ID =
  '1oHaO9UKuLn1MR6iAQ2URu8XC62AkfoTN7zYAXxcV9SQ'

const CANDIDATES_SHEET_GID = '921987901'
const CANDIDATES_CSV_URL = `https://docs.google.com/spreadsheets/d/${KNESSET26_CANDIDATES_SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${CANDIDATES_SHEET_GID}`

export type KnessetMemberSeniority = 'veteran' | 'new' | 'unknown'

export type KnessetMemberRow = {
  partyHeb: string
  partyKey: string | null
  listRank: number
  name: string
  imageUrl: string
  background: string
  seniority: KnessetMemberSeniority
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
/** Column D — Wikipedia stills; used only when Q is empty. */
const HEADER_WIKI_IMAGE = 'קישור לתמונה (וויקיפדיה)'
const HEADER_BACKGROUND = 'רקע קצר'
const HEADER_SENIORITY = 'ותק'

function headerIndex(headers: readonly string[], name: string): number {
  return headers.findIndex((h) => h.trim() === name)
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
  const transparent = cell(cols, headers, HEADER_TRANSPARENT_IMAGE, 16)
  if (transparent) return transparent
  return cell(cols, headers, HEADER_WIKI_IMAGE, 3)
}

export function parseKnessetMembersCsv(csv: string): KnessetMemberRow[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []

  const headers = parseCsvLine(lines[0]!)

  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line)
    const partyHeb = cell(cols, headers, HEADER_PARTY, 0)
    const listRank = Number.parseInt(cell(cols, headers, HEADER_RANK, 1), 10) || 0
    const name = cell(cols, headers, HEADER_NAME, 2)
    const imageUrl = pickMemberImageUrl(cols, headers)
    const background = cell(cols, headers, HEADER_BACKGROUND, 5)
    const seniority = parseSeniority(cell(cols, headers, HEADER_SENIORITY, 6))

    return {
      partyHeb,
      partyKey: partyKeyFromHebrewList(partyHeb),
      listRank,
      name,
      imageUrl,
      background,
      seniority,
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
