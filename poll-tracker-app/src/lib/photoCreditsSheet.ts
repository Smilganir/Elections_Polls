import {
  KNESSET26_CANDIDATES_SPREADSHEET_ID,
  parsePhotoCreditText,
  partyKeyFromHebrewList,
  type KnessetMemberRow,
} from './knessetMembersSheet'

const PHOTO_CREDITS_SHEET_GID = '1260512030'
const PHOTO_CREDITS_CSV_URL = `https://docs.google.com/spreadsheets/d/${KNESSET26_CANDIDATES_SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${PHOTO_CREDITS_SHEET_GID}`

export type PhotoCreditRecord = {
  candidateName: string
  partyHeb: string
  partyKey: string | null
  listRank: number
  sourcePageUrl: string
  imageUrl: string
  credit: string
  license: string
  licenseUrl: string
}

const HEADER_CANDIDATE = 'מועמד/ת'
const HEADER_PARTY = 'מפלגה'
const HEADER_RANK = 'מקום ברשימה'
const HEADER_SOURCE_PAGE = 'עמוד מקור'
const HEADER_IMAGE = 'קישור תמונה'
const HEADER_CREDIT = 'קרדיט'
const HEADER_LICENSE = 'רישיון'
const HEADER_LICENSE_URL = 'קישור רישיון'

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

export type PhotoCreditDisplayMode = 'full' | 'neutral' | 'none'

export function photoCreditLookupKey(partyHeb: string, listRank: number): string {
  return `${partyHeb.trim()}\0${listRank}`
}

/** Stable anchor id for credits-page deep links from under-photo neutral mode. */
export function photoCreditEntryId(record: PhotoCreditRecord): string {
  const partyPart = record.partyHeb.trim().replace(/\s+/g, '-')
  return `photo-credit-${partyPart}-${record.listRank}`
}

/**
 * Under-photo display rule:
 * - full: license field set, or party-site credit (starts with "אתר")
 * - neutral: credited news/other sources without a license field
 * - none: no credit text
 */
export function photoCreditDisplayMode(record: PhotoCreditRecord | null): PhotoCreditDisplayMode {
  if (!record) return 'none'
  const credit = record.credit.trim()
  if (!credit) return 'none'
  if (record.license.trim().length > 0 || credit.startsWith('אתר')) return 'full'
  return 'neutral'
}

const WIKIMEDIA_COMMONS_LABEL = 'ויקימדיה קומונס'

/** Plain suffix for full credit lines sourced from Wikimedia Commons (not a link). */
export function photoCreditCommonsSuffix(
  sourcePageUrl: string,
  credit: string,
): string | null {
  if (credit.includes(WIKIMEDIA_COMMONS_LABEL)) return null
  try {
    const hostname = new URL(sourcePageUrl.trim()).hostname
    if (hostname.includes('commons.wikimedia.org')) {
      return ` · ${WIKIMEDIA_COMMONS_LABEL}`
    }
  } catch {
    /* ignore malformed URLs */
  }
  return null
}

function normalizeImageUrl(url: string): string {
  try {
    const u = new URL(url.trim())
    u.search = ''
    u.hash = ''
    return u.toString()
  } catch {
    return url.trim()
  }
}

export function parsePhotoCreditsCsv(csv: string): PhotoCreditRecord[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []

  const headers = parseCsvLine(lines[0]!)

  return lines.slice(1).flatMap((line) => {
    const cols = parseCsvLine(line)
    const partyHeb = cell(cols, headers, HEADER_PARTY, 1)
    const listRank = Number.parseInt(cell(cols, headers, HEADER_RANK, 2), 10) || 0
    const credit = parsePhotoCreditText(cell(cols, headers, HEADER_CREDIT, 5))
    if (!credit) return []

    return [
      {
        candidateName: cell(cols, headers, HEADER_CANDIDATE, 0),
        partyHeb,
        partyKey: partyKeyFromHebrewList(partyHeb),
        listRank,
        sourcePageUrl: cell(cols, headers, HEADER_SOURCE_PAGE, 3),
        imageUrl: cell(cols, headers, HEADER_IMAGE, 4),
        credit,
        license: cell(cols, headers, HEADER_LICENSE, 6),
        licenseUrl: cell(cols, headers, HEADER_LICENSE_URL, 7),
      },
    ]
  })
}

export function buildPhotoCreditIndex(
  records: readonly PhotoCreditRecord[],
): Map<string, PhotoCreditRecord> {
  const byPartyRank = new Map<string, PhotoCreditRecord>()
  const byImageUrl = new Map<string, PhotoCreditRecord>()

  for (const record of records) {
    if (record.partyHeb && record.listRank > 0) {
      byPartyRank.set(photoCreditLookupKey(record.partyHeb, record.listRank), record)
    }
    if (record.imageUrl) {
      byImageUrl.set(normalizeImageUrl(record.imageUrl), record)
    }
  }

  return new Map([...byPartyRank, ...byImageUrl])
}

export function photoCreditForMember(
  member: KnessetMemberRow,
  index: ReadonlyMap<string, PhotoCreditRecord>,
  v2CreditText?: string | null,
): PhotoCreditRecord | null {
  const byRank = index.get(photoCreditLookupKey(member.partyHeb, member.listRank))
  if (byRank) return byRank

  for (const url of [member.portraitImageUrl, member.imageUrl]) {
    if (!url) continue
    const byImage = index.get(normalizeImageUrl(url))
    if (byImage) return byImage
  }

  const fallbackCredit = v2CreditText ?? member.photoCreditText
  if (!fallbackCredit) return null

  return {
    candidateName: member.name,
    partyHeb: member.partyHeb,
    partyKey: member.partyKey,
    listRank: member.listRank,
    sourcePageUrl: member.portraitImageUrl || member.imageUrl || '',
    imageUrl: member.imageUrl || member.portraitImageUrl,
    credit: fallbackCredit,
    license: '',
    licenseUrl: '',
  }
}

export function photoCreditsGroupedByParty(
  records: readonly PhotoCreditRecord[],
): { partyHeb: string; partyKey: string | null; rows: PhotoCreditRecord[] }[] {
  const groups = new Map<string, PhotoCreditRecord[]>()
  const order: string[] = []

  for (const record of records) {
    const key = record.partyHeb.trim()
    if (!groups.has(key)) {
      groups.set(key, [])
      order.push(key)
    }
    groups.get(key)!.push(record)
  }

  return order.map((partyHeb) => {
    const rows = [...(groups.get(partyHeb) ?? [])].sort(
      (a, b) => a.listRank - b.listRank || a.candidateName.localeCompare(b.candidateName, 'he'),
    )
    return {
      partyHeb,
      partyKey: rows[0]?.partyKey ?? partyKeyFromHebrewList(partyHeb),
      rows,
    }
  })
}

let cachedCredits: PhotoCreditRecord[] | null = null
let cachePromise: Promise<PhotoCreditRecord[]> | null = null
let cacheStamp = 0

export function clearPhotoCreditsCache(): void {
  cachedCredits = null
  cachePromise = null
  cacheStamp = Date.now()
}

export async function fetchPhotoCredits(): Promise<PhotoCreditRecord[]> {
  if (cachedCredits) return cachedCredits
  if (!cachePromise) {
    const url = `${PHOTO_CREDITS_CSV_URL}&_=${cacheStamp || Date.now()}`
    cachePromise = fetch(url, { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`Photo credits sheet: ${r.status}`)
        return r.text()
      })
      .then((csv) => {
        cachedCredits = parsePhotoCreditsCsv(csv)
        return cachedCredits
      })
      .catch((err) => {
        cachePromise = null
        throw err
      })
  }
  return cachePromise
}
