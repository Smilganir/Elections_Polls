import type { Segment } from '../types/data'

export const PARTY_ICON_MAP: Record<string, string> = {
  Balad: '/parties/Parties-Heads-Cropped_00013_Layer-6.png',
  "Bennett's Party": '/parties/Parties-Heads-Cropped_0000_Layer-14.png',
  'Blue & White': '/parties/Parties-Heads-Cropped_0010_Layer-2.png',
  "Hadash Ta'al": '/parties/Parties-Heads-Cropped_0008_Layer-4.png',
  Likud: '/parties/Parties-Heads-Cropped_0012_Layer-1.png',
  'Otzma Yehudit': '/parties/Parties-Heads-Cropped_0011_Layer-9.png',
  "Ra'am": '/parties/Parties-Heads-Cropped_0009_Layer-3.png',
  'Religious Zionism': '/parties/Parties-Heads-Cropped_0007_Layer-5.png',
  Shas: '/parties/Parties-Heads-Cropped_0006_Layer-6.png',
  'The Democrats': '/parties/Parties-Heads-Cropped_0001_Layer-13.png',
  'The Reservists': '/parties/Parties-Heads-Cropped_0014_Layer-1.png',
  UTJ: '/parties/Parties-Heads-Cropped_0004_Layer-8.png',
  'Yashar!': '/parties/Parties-Heads-Cropped_0005_Layer-7.png',
  'Yesh Atid': '/parties/Parties-Heads-Cropped_0003_Layer-10.png',
  'Yisrael Beiteinu': '/parties/Parties-Heads-Cropped_0002_Layer-11.png',
}

/** Inclusive first poll date for sparklines: drop earlier sheet rows (often 0) before the party was polled. */
export const SPARKLINE_PARTY_DEBUT_DATE: Partial<Record<string, string>> = {
  "Bennett's Party": '2025-02-07',
  'Yashar!': '2025-08-08',
  'Otzma Yehudit': '2023-12-15',
  'The Reservists': '2025-08-15',
}

export const MEDIA_ICON_MAP: Record<string, string> = {
  'i24 news': '/media/_0006_Layer-6.png',
  וואלה: '/media/_0005_Layer-8.png',
  'זמן ישראל': '/media/_0007_Layer-5.png',
  'חדשות 12': '/media/_0010_Layer-2.png',
  'חדשות 13': '/media/_0009_Layer-16.png',
  'ישראל היום': '/media/_0004_Layer-10.png',
  'כאן חדשות': '/media/_0003_Layer-15.png',
  'מכונת האמת': '/media/_0002_Layer-12.png',
  מעריב: '/media/_0011_Layer-1.png',
  'ערוץ 7': '/media/_0000_Layer-14.png',
  'ערוץ 14': '/media/_0008_Layer-4.png',
}

export const SEGMENT_COLORS: Record<Segment, string> = {
  Coalition: '#0166DF',
  Opposition: '#F7F7F7',
  Arabs: '#717982',
}

export const SEGMENT_BG_COLORS: Record<Segment, string> = {
  Coalition: 'rgba(1, 102, 223, 0.15)',
  Opposition: 'rgba(247, 247, 247, 0.12)',
  Arabs: 'rgba(113, 121, 130, 0.15)',
}

export const PARTY_COLOR_MAP: Record<string, string> = {
  Likud: '#0166DF',
  UTJ: '#0166DF',
  Shas: '#0166DF',
  'Religious Zionism': '#0166DF',
  'Otzma Yehudit': '#0166DF',
  "Bennett's Party": '#F7F7F7',
  'Yashar!': '#F7F7F7',
  'The Democrats': '#F7F7F7',
  'Yesh Atid': '#F7F7F7',
  'Yisrael Beiteinu': '#F7F7F7',
  'Blue & White': '#F7F7F7',
  'The Reservists': '#F7F7F7',
  "Hadash Ta'al": '#717982',
  "Ra'am": '#717982',
  Balad: '#717982',
  'Joint Arab List': '#717982',
}

/** Matches Major Events Dim “category” labels; colors aligned to dashboard legend. */
export const EVENT_CATEGORY_COLORS: Record<string, string> = {
  'Domestic Politics': '#E1DAE1',
  'Gaza War': '#8DA5C3',
  'Geopolitical Security': '#BF8D76',
  'Geopolitical War': '#BF8D76',
  'Security Crisis': '#913B51',
  'Security Operation': '#5E53A8',
}

/**
 * English timeline labels (canonical sheet “Event Name” → compact UI text).
 * Lookup is exact on trimmed string, then case-insensitive fallback.
 */
export const ENGLISH_EVENT_DISPLAY_SHORT: Record<string, string> = {
  'Judicial Overhaul Plan Announced': 'Judicial Overhaul',
  'Oct 7 Attacks': 'Oct 7 Attacks',
  'First Temporary Ceasefire (Hostage Release)': 'Gaza 1st Ceasefire',
  "Iran's First Direct Attack on Israel": 'Iran 1st attack',
  'Bippers, Nasrallah & Sinwar killed': 'Bippers, Nasrallah',
  'Killing of Yahya Sinwar': 'Killing Sinwar',
  'Gaza Ceasefire Deal Approved': 'Gaza 2nd Ceasefire',
  'Iran-Israel War (12-Day War)': '12 day war',
  'Shas Leaves the Government': 'Shas leaves govmt',
  'Galant Night': 'Galant Night',
  '3rd Ceasefire Deal': 'Gaza 3rd Ceasefire',
  'Yashar Launched': 'Yashar Launched',
  'Bennett 2026': 'Bennett 2026',
  'Operation Mighty Roar': 'Mighty Roar Op',
}

const ENGLISH_EVENT_SHORT_LOOKUP_LOWER = new Map<string, string>()
for (const [k, v] of Object.entries(ENGLISH_EVENT_DISPLAY_SHORT)) {
  ENGLISH_EVENT_SHORT_LOOKUP_LOWER.set(k.trim().toLowerCase(), v)
}

function resolveEnglishEventShortLabel(raw: string): string | undefined {
  const t = raw.trim()
  return ENGLISH_EVENT_DISPLAY_SHORT[t] ?? ENGLISH_EVENT_SHORT_LOOKUP_LOWER.get(t.toLowerCase())
}

/** Higher = kept first when the layout limits how many event labels are shown. */
export const EVENT_CATEGORY_DISPLAY_PRIORITY: Record<string, number> = {
  'Gaza War': 100,
  'Geopolitical War': 95,
  'Geopolitical Security': 70,
  'Security Crisis': 55,
  'Security Operation': 40,
  'Domestic Politics': 10,
}

/**
 * Keep only letters, numbers, and spaces — no punctuation, dashes, or other marks.
 * Hyphens between words become spaces so names stay readable.
 */
function keepLettersNumbersSpacesOnly(s: string): string {
  let t = s.normalize('NFKC')
  t = t.replace(/\p{Pd}+/gu, ' ')
  t = t.replace(/[^\p{L}\p{N}\s]/gu, '')
  return t.replace(/\s+/g, ' ').trim()
}

export type EventLabelFormatMode = 'default' | 'en-event-name'

/**
 * Display label: letters / digits / spaces only; max maxLen (no ellipsis punctuation).
 * Use mode `en-event-name` for English canonical event names to apply ENGLISH_EVENT_DISPLAY_SHORT first.
 */
export function formatEventLabelForDisplay(
  raw: string,
  maxLen = 20,
  mode: EventLabelFormatMode = 'default',
): string {
  if (mode === 'en-event-name') {
    const mapped = resolveEnglishEventShortLabel(raw)
    if (mapped !== undefined) {
      const m = mapped.trim()
      if (m.length <= maxLen) return m
      if (maxLen <= 1) return m.slice(0, maxLen)
      return m.slice(0, maxLen)
    }
  }
  let s = keepLettersNumbersSpacesOnly(raw)
  if (s.length <= maxLen) return s
  if (maxLen <= 1) return s.slice(0, maxLen)
  return s.slice(0, maxLen)
}

/** Exclude specific events from timelines (match on name from Events / Major Events Dim). */
export function isMajorEventExcludedFromDisplay(eventName: string): boolean {
  const n = eventName.toLowerCase()
  return n.includes('judicial') && n.includes('overhaul')
}

/** Always show in the timeline when present (even when viewport caps other events). */
export function isAlwaysIncludedMajorEvent(eventName: string): boolean {
  const n = eventName.toLowerCase()
  return n.includes('oct 7') && n.includes('attack')
}

export function maxEventLabelsForViewportWidth(width: number): number {
  if (width <= 480) return 4
  if (width <= 768) return 6
  if (width <= 1100) return 10
  return 999
}

export function selectEventsForViewportDisplay<T extends { date: string; category: string; name: string }>(
  events: T[],
  maxCount: number,
): T[] {
  if (events.length <= maxCount) {
    return [...events].sort((a, b) => a.date.localeCompare(b.date))
  }
  const priority = (c: string) => EVENT_CATEGORY_DISPLAY_PRIORITY[c] ?? 5
  const mandatory = events.filter((e) => isAlwaysIncludedMajorEvent(e.name))
  const rest = events.filter((e) => !mandatory.includes(e))
  const slotsForRest = Math.max(0, maxCount - mandatory.length)
  const sortedRest = [...rest].sort((a, b) => {
    const d = priority(b.category) - priority(a.category)
    if (d !== 0) return d
    return a.date.localeCompare(b.date)
  })
  const pickedRest = sortedRest.slice(0, slotsForRest)
  return [...mandatory, ...pickedRest].sort((a, b) => a.date.localeCompare(b.date))
}

export const DEFAULT_SERIES_COLORS = [
  '#0166DF',
  '#F7F7F7',
  '#8b3fb2',
  '#10856c',
  '#b87022',
  '#346ab8',
  '#45556f',
  '#d93f59',
  '#5e87be',
  '#4d8c94',
]

export const ENGLISH_MEDIA_NAMES: Record<string, string> = {
  מעריב: 'Maariv',
  'ערוץ 14': 'Channel 14',
  'חדשות 12': 'Channel 12',
  'זמן ישראל': 'Zman Yisrael',
  'חדשות 13': 'Channel 13',
  'ישראל היום': 'Israel Hayom',
  'כאן חדשות': 'Kan News',
  'מכונת האמת': 'Truth Machine',
  וואלה: 'Walla',
  'ערוץ 7': 'Channel 7',
  'i24 news': 'i24 News',
}
