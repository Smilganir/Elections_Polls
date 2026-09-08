import type { Segment } from '../types/data'

/** Public CSV export for Knesset 26 closed candidate lists. */
export const KNESSET26_CANDIDATES_SPREADSHEET_ID =
  '1oHaO9UKuLn1MR6iAQ2URu8XC62AkfoTN7zYAXxcV9SQ'

const CANDIDATES_CSV_URL = `https://docs.google.com/spreadsheets/d/${KNESSET26_CANDIDATES_SPREADSHEET_ID}/gviz/tq?tqx=out:csv`

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
  'הליכוד': 'Likud',
  'ישר! עם איזנקוט': 'Yashar!',
  'ישראל ביתנו': 'Yisrael Beiteinu',
  'הדמוקרטים': 'The Democrats',
  'עוצמה יהודית': 'Otzma Yehudit',
  'יהדות התורה': 'UTJ',
  'ש"ס': 'Shas',
  'רע"ם': "Ra'am",
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

export function parseKnessetMembersCsv(csv: string): KnessetMemberRow[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []

  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line)
    const partyHeb = cols[0]?.trim() ?? ''
    const listRank = Number.parseInt(cols[1]?.trim() ?? '', 10) || 0
    const name = cols[2]?.trim() ?? ''
    const imageUrl = cols[3]?.trim() ?? ''
    const background = cols[5]?.trim() ?? ''
    const seniority = parseSeniority(cols[6]?.trim() ?? '')

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

export async function fetchKnessetMembers(): Promise<KnessetMemberRow[]> {
  if (cachedMembers) return cachedMembers
  if (!cachePromise) {
    cachePromise = fetch(CANDIDATES_CSV_URL, { cache: 'no-store' })
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
  for (const list of m.values()) {
    list.sort((a, b) => a.listRank - b.listRank)
  }
  return m
}

export function segmentLabel(
  segment: Segment,
  t: { knessetMapCoalition: string; knessetMapOpposition: string; knessetMapArabs: string },
): string {
  if (segment === 'Coalition') return t.knessetMapCoalition
  if (segment === 'Arabs') return t.knessetMapArabs
  return t.knessetMapOpposition
}
