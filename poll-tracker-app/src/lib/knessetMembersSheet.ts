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
  /** רישיון/מקור תמונה — full credit line from v2 sheet (parentheses preserved). */
  photoCreditText: string | null
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
/** v2 column — parenthetical source notes must be preserved (not run through source tokenizer). */
export const HEADER_PHOTO_CREDIT_V2 = 'רישיון/מקור תמונה'
const HEADER_PHOTO_CREDIT = HEADER_PHOTO_CREDIT_V2

/**
 * Preserve full credit text including parenthetical notes.
 * Do not use canonicalizeSourceToken — it rejects parentheses and drops ~68/70 rows.
 */
export function parsePhotoCreditText(raw: string): string | null {
  const t = raw.trim()
  return t.length > 0 ? t : null
}

/** Known source host -> Hebrew display name (derived from actual sheet מקורות cells). */
const SOURCE_HOST_NAMES: Record<string, string> = {
  'wikipedia.org': 'ויקיפדיה',
  'wikidata.org': 'ויקינתונים',
  'knesset.gov.il': 'אתר הכנסת',
  'mivzaklive.co.il': 'מבזק-לייב',
  'inn.co.il': 'ערוץ 7',
  'ynet.co.il': 'ynet',
  'ice.co.il': 'אייס',
  'okn.co.il': 'עולם קטן',
  'i24news.tv': 'i24NEWS',
  'maariv.co.il': 'מעריב',
  'c14.co.il': 'ערוץ 14',
  'now14.co.il': 'ערוץ 14',
  'kipa.co.il': 'כיפה',
  'kikar.co.il': 'כיכר השבת',
  'srugim.co.il': 'סרוגים',
  'israelhayom.co.il': 'ישראל היום',
  'ch10.co.il': 'חרדים10',
  'knesset.tv': 'ערוץ הכנסת',
  'mako.co.il': 'mako',
  'babli.co.il': 'באבלי',
  'newz.click': 'ניוז קליק',
  'hamichlol.org.il': 'המכלול',
  'bokra.net': 'בוקרה',
  'ozma-yeudit.co.il': 'אתר עוצמה יהודית',
  'hakalkalit.org': 'המפלגה הכלכלית',
  'zehut.org.il': 'מפלגת זהות',
  'themiluimnikim.org.il': 'המילואיםניקים',
  'yasharwitheisenkot.com': 'ישר עם אייזנקוט',
  'zionutdatit.org.il': 'אתר מפלגת הציונות הדתית',
  'jdn.co.il': 'JDN',
  'kan.org.il': 'כאן',
  'linkedin.com': 'לינקדאין',
  'netanyanet.co.il': 'נתניהו-נט',
  'maki.org.il': 'אתר חד"ש/מק"י',
  'walla.co.il': 'וואלה',
  'tzav9.co.il': 'אתר ארגון צו 9',
  'bizmakebiz.co.il': 'BizMakeBiz',
  'beytenu.org.il': 'ביתנו',
  'yerushalayim.org.il': 'ירושלימים',
}

const KNOWN_SOURCE_NAMES = [...new Set(Object.values(SOURCE_HOST_NAMES))].sort(
  (a, b) => b.length - a.length,
)

/** URL or bare host(+path), scheme optional - the path must never tokenize into "sources". */
const HOST_OR_URL_RE =
  /(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,})(?:\/[^\s;,)"']*)?/gi

function hostDisplayName(host: string): string {
  const h = host.toLowerCase()
  for (const [key, name] of Object.entries(SOURCE_HOST_NAMES)) {
    if (h === key || h.endsWith('.' + key)) return name
  }
  return host
}

/** Value-only fragments that are data, not sources. */
const NON_SOURCE_TOKENS = new Set([
  'דתי', 'חילוני', 'מסורתי', 'חרדי', 'ערבי', 'דתי לאומי', 'חרד"ל', 'מזרחי', 'עולים',
  'שיוך מפלגתי', 'עמוד אישי', 'http', 'https', 'אין מידע',
  'לא רישיון חופשי', 'רישיון חופשי',
])

/** Evidence-level caveat carried inside a מקורות segment; shown next to its source. */
const SOURCE_CAVEAT_RE = /\(([^)]*(?:מקור יחיד|אגרגטור|רף ראיות|לא אמירה מפורשת)[^)]*)\)/

/** Sheet-derived column boilerplate — omit from tooltip sources. */
const SOURCES_SKIP_PREFIXES = ['עמודת קטגוריה לגרף']

const SOURCES_SKIP_VALUE_PATTERNS = [
  /ערך\s+מקורי\s+משולב/i,
  /שוחזר\s+מהטאב\s+הקודם/i,
  /שחזור\s+מהטאב\s+הקודם/i,
  /נרשמה\s+הקטגוריה\s+הראשונה/i,
]

export type MemberSourceGroup = { source: string; categories: string[]; note?: string }

function cleanSourceText(raw: string): string {
  let t = raw.trim()
  if (!t) return ''

  t = t.replace(HOST_OR_URL_RE, (_match, host: string) => hostDisplayName(host))

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
  t = t.replace(/כנסת\s+OData/gi, 'אתר הכנסת')
  t = t.replace(/\(ערך\s+אישי[^)]*\)/gi, '')
  t = t.replace(/\(אנגלית\)/g, '')
  t = t.replace(/\s*\(במקור הופיע הערך המשולב[^)]*\)/g, '')
  t = t.replace(/\s*\(במקור:\s*[^)]*\)/g, '')
  t = t.replace(/\s*\(שיוך יישוב למחוז\)/g, '')

  return t.replace(/\s+/g, ' ').replace(/^[,.\s]+|[,.\s]+$/g, '').trim()
}

function canonicalizeSourceToken(fragment: string): string | null {
  let t = cleanSourceText(fragment)
  t = t.replace(/\s+\d{1,2}\.\d{1,2}(?:\.\d{2,4})?$/, '').trim()
  if (!t) return null
  if (/^gemini$/i.test(t) || /^ai$/i.test(t)) return null
  if (NON_SOURCE_TOKENS.has(t)) return null
  if (t.includes('לשונית') || t.includes('בקובץ זה')) return null

  for (const name of KNOWN_SOURCE_NAMES) {
    if (t === name || t.startsWith(name) || (name.length >= 5 && t.includes(name))) return name
  }

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

  // "… - מקור: X, <extra>, <url>": the explicit source marker wins; extras only if known.
  if (cleaned.includes('מקור:')) {
    const after = cleaned.slice(cleaned.lastIndexOf('מקור:') + 'מקור:'.length)
    const first = canonicalizeSourceToken(after.split(/[,;]/)[0].replace(/\)+$/, '').trim())
    const tokens: string[] = first ? [first] : []
    for (const frag of after
      .split(/[/|+,]|(?:\s+ו\s+)/)
      .slice(1)
      .map((f) => f.trim())
      .filter(Boolean)) {
      const canonical = canonicalizeSourceToken(frag)
      if (canonical && KNOWN_SOURCE_NAMES.includes(canonical)) tokens.push(canonical)
    }
    return tokens
  }

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
  const bySourceNote = new Map<string, string>()

  for (const part of t.split(';')) {
    const segment = part.trim()
    if (!segment || shouldSkipSourceSegment(segment)) continue

    const colonIdx = segment.indexOf(':')
    if (colonIdx <= 0) continue

    const category = segment.slice(0, colonIdx).trim()
    let valuePart = segment.slice(colonIdx + 1).trim()
    if (!category || !valuePart || shouldSkipSourceSegment(valuePart)) continue

    // Evidence caveat (e.g. "מקור יחיד, אגרגטור - רף ראיות נמוך") rides along to the source.
    let caveat: string | undefined
    const caveatMatch = valuePart.match(SOURCE_CAVEAT_RE)
    if (caveatMatch) {
      caveat = caveatMatch[1].trim()
      valuePart = (valuePart.slice(0, caveatMatch.index) + valuePart.slice((caveatMatch.index ?? 0) + caveatMatch[0].length)).trim()
    }

    const sources = extractSourcesFromValue(valuePart)
    if (!sources.length) continue

    for (const source of sources) {
      if (!bySource.has(source)) {
        bySource.set(source, [])
        sourceOrder.push(source)
      }
      const categories = bySource.get(source)!
      if (!categories.includes(category)) categories.push(category)
      if (caveat && !bySourceNote.has(source)) bySourceNote.set(source, caveat)
    }
  }

  return sourceOrder.map((source) => ({
    source,
    categories: bySource.get(source) ?? [],
    note: bySourceNote.get(source),
  }))
}

export function memberSourcesPlainText(groups: readonly MemberSourceGroup[]): string {
  return groups.map((g) => `${g.source}: ${g.categories.join(', ')}`).join(' | ')
}

const MEMBER_SOURCE_NAME_EN: Record<string, string> = {
  'ויקיפדיה': 'Wikipedia',
  'ויקינתונים': 'Wikidata',
  'אתר הכנסת': 'Knesset website',
  'למ"ס': 'CBS',
}

/** Tooltip source token (canonical Hebrew sheet label → English when locale is en). */
export function memberSourceDisplayName(source: string, locale: 'en' | 'he'): string {
  if (locale === 'he') return source
  return MEMBER_SOURCE_NAME_EN[source] ?? source
}

/** Sheet provenance category (Hebrew column label → English field name). */
export function memberSourceCategoryLabel(
  category: string,
  locale: 'en' | 'he',
  labels: {
    age: string
    gender: string
    knessetYears: string
    professional: string
    education: string
    military: string
    sector: string
    city: string
    subIdentity: string
    preRole: string
    funFact: string
    periphery: string
  },
): string {
  if (locale === 'he') return category
  const map: Record<string, string> = {
    גיל: labels.age,
    מין: labels.gender,
    'ותק בכנסת': labels.knessetYears,
    'ניסיון מקצועי': labels.professional,
    השכלה: labels.education,
    'שירות צבאי/לאומי': labels.military,
    'שירות צבאי קטגוריה': labels.military,
    מגזר: labels.sector,
    עיר: labels.city,
    'תת-זהות': labels.subIdentity,
    'תפקיד קדם-כנסת 1 (קטגוריה)': labels.preRole,
    'תפקיד קדם-כנסת': labels.preRole,
    'עובדה מעניינת': labels.funFact,
    'ציון פריפריה': labels.periphery,
  }
  return map[category] ?? category
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
    const photoCreditText = parsePhotoCreditText(cell(cols, headers, HEADER_PHOTO_CREDIT, 7))

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
      photoCreditText,
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
