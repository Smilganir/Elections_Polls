import type { AppLocale } from '../i18n/localeContext'
import type { KnessetMemberRow } from './knessetMembersSheet'

const NO_INFO = /^(אין מידע|\-|,|\s)*$/
const URL_LIKE = /^https?:\/\//i
const HEBREW = /[\u0590-\u05FF]/

export type MemberEnTooltipProfile = {
  name: string
  professional: string
  military: string
  education: string
}

const nameCache = new Map<string, string>()
const translationCache = new Map<string, string>()
const profileCache = new Map<string, MemberEnTooltipProfile>()
const profileInflight = new Map<string, Promise<MemberEnTooltipProfile>>()

function isUrlLike(value: string): boolean {
  return URL_LIKE.test(value.trim())
}

function hasHebrew(text: string): boolean {
  return HEBREW.test(text)
}

/** Hebrew display name from sheet — never returns a URL. */
export function memberHebrewName(member: KnessetMemberRow): string {
  const name = member.name.trim()
  if (!name || isUrlLike(name)) return ''
  return name
}

function englishNameFromWikipediaUrl(url: string): string | null {
  const match = url.match(/wikipedia\.org\/wiki\/([^/?#]+)/i)
  if (!match?.[1]) return null
  let name = decodeURIComponent(match[1].replace(/_/g, ' '))
  name = name.replace(/\s*\([^)]*\)\s*$/, '').trim()
  if (!name || hasHebrew(name) || isUrlLike(name)) return null
  return name
}

function isNoInfoOnly(text: string): boolean {
  const trimmed = text.trim()
  return !trimmed || NO_INFO.test(trimmed) || trimmed.startsWith('אין מידע')
}

/** Collapse repeated "אין מידע" (and comma-only separators) to a single label. */
export function normalizeMemberSheetField(raw: string, noInfoLabel: string): string {
  const trimmed = raw.trim()
  if (isNoInfoOnly(trimmed)) return noInfoLabel

  const parts = trimmed
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
  if (parts.length > 1 && parts.every(isNoInfoOnly)) return noInfoLabel

  return trimmed
}

function localBioTranslation(text: string, noInfoLabel: string): string {
  if (isNoInfoOnly(text)) return noInfoLabel
  return text.trim()
}

async function fetchEnglishNameFromHebrewWikipedia(hebrewName: string): Promise<string | null> {
  const cacheKey = `name:${hebrewName}`
  const cached = nameCache.get(cacheKey)
  if (cached) return cached

  try {
    const searchUrl =
      `https://he.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(hebrewName)}` +
      '&limit=5&namespace=0&format=json&origin=*'
    const searchRes = await fetch(searchUrl)
    if (!searchRes.ok) return null
    const [, titles] = (await searchRes.json()) as [string, string[]]
    if (!titles?.length) return null

    for (const title of titles) {
      const llUrl =
        `https://he.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=en&titles=${encodeURIComponent(title)}` +
        '&format=json&origin=*'
      const llRes = await fetch(llUrl)
      if (!llRes.ok) continue
      const llData = (await llRes.json()) as {
        query?: { pages?: Record<string, { langlinks?: { lang: string; title: string }[] }> }
      }
      const page = Object.values(llData.query?.pages ?? {})[0]
      const enTitle = page?.langlinks?.find((l) => l.lang === 'en')?.title?.trim()
      if (enTitle && !hasHebrew(enTitle)) {
        nameCache.set(cacheKey, enTitle)
        return enTitle
      }
    }
  } catch {
    return null
  }
  return null
}

async function fetchEnglishNameFromWikidata(hebrewName: string): Promise<string | null> {
  const cacheKey = `wd:${hebrewName}`
  const cached = nameCache.get(cacheKey)
  if (cached) return cached

  try {
    const searchUrl =
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(hebrewName)}` +
      '&language=he&type=item&limit=5&format=json&origin=*'
    const searchRes = await fetch(searchUrl)
    if (!searchRes.ok) return null
    const data = (await searchRes.json()) as {
      search?: { id: string; label: string; description?: string }[]
    }
    const ids = (data.search ?? [])
      .filter((item) => item.id && item.label)
      .map((item) => item.id)
    if (!ids.length) return null

    const entityUrl =
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.join('|')}` +
      '&props=labels&languages=en&format=json&origin=*'
    const entityRes = await fetch(entityUrl)
    if (!entityRes.ok) return null
    const entityData = (await entityRes.json()) as {
      entities?: Record<string, { labels?: { en?: { value?: string } } }>
    }

    for (const id of ids) {
      const enLabel = entityData.entities?.[id]?.labels?.en?.value?.trim()
      if (enLabel && !hasHebrew(enLabel) && !isUrlLike(enLabel)) {
        nameCache.set(cacheKey, enLabel)
        return enLabel
      }
    }
  } catch {
    return null
  }
  return null
}

async function resolveEnglishName(member: KnessetMemberRow): Promise<string> {
  const hebrew = memberHebrewName(member)
  const fromWikiUrl =
    englishNameFromWikipediaUrl(member.portraitImageUrl) ??
    englishNameFromWikipediaUrl(member.imageUrl)
  if (fromWikiUrl) return fromWikiUrl

  if (hebrew) {
    const fromHeWiki = await fetchEnglishNameFromHebrewWikipedia(hebrew)
    if (fromHeWiki) return fromHeWiki
    const fromWd = await fetchEnglishNameFromWikidata(hebrew)
    if (fromWd) return fromWd
    return hebrew
  }

  return ''
}

async function translateHebrewOnline(text: string, noInfoLabel: string): Promise<string> {
  const trimmed = normalizeMemberSheetField(text, noInfoLabel)
  if (isNoInfoOnly(trimmed) || trimmed === noInfoLabel) return noInfoLabel
  if (!hasHebrew(trimmed)) return trimmed

  const cached = translationCache.get(trimmed)
  if (cached) return cached

  try {
    const url =
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed)}` +
      '&langpair=he|en'
    const res = await fetch(url)
    if (!res.ok) {
      return trimmed
    }
    const data = (await res.json()) as {
      responseData?: { translatedText?: string }
    }
    const translated = data.responseData?.translatedText?.trim()
    if (translated && !isUrlLike(translated)) {
      translationCache.set(trimmed, translated)
      return translated
    }
  } catch {
    return trimmed
  }
  return trimmed
}

function profileCacheKey(member: KnessetMemberRow): string {
  return [
    member.partyHeb,
    member.listRank,
    member.name,
    member.professionalExperience,
    member.militaryService,
    member.education,
  ].join('|')
}

export async function resolveMemberEnTooltip(
  member: KnessetMemberRow,
  noInfoLabel: string,
  unknownNameLabel = 'Unknown candidate',
): Promise<MemberEnTooltipProfile> {
  const key = profileCacheKey(member)
  const cached = profileCache.get(key)
  if (cached) return cached

  const inflight = profileInflight.get(key)
  if (inflight) return inflight

  const promise = (async () => {
    const [name, professional, military, education] = await Promise.all([
      resolveEnglishName(member),
      member.professionalExperience.trim()
        ? translateHebrewOnline(member.professionalExperience, noInfoLabel)
        : Promise.resolve(''),
      member.militaryService.trim()
        ? translateHebrewOnline(member.militaryService, noInfoLabel)
        : Promise.resolve(''),
      member.education.trim()
        ? translateHebrewOnline(member.education, noInfoLabel)
        : Promise.resolve(''),
    ])

    const profile: MemberEnTooltipProfile = {
      name: name || memberHebrewName(member) || unknownNameLabel,
      professional,
      military,
      education,
    }
    profileCache.set(key, profile)
    return profile
  })()

  profileInflight.set(key, promise)
  try {
    return await promise
  } finally {
    profileInflight.delete(key)
  }
}

/** Sync fallback while async EN profile loads. */
export function memberTooltipName(member: KnessetMemberRow, locale: AppLocale): string {
  if (locale === 'he') return memberHebrewName(member)
  const fromWikiUrl =
    englishNameFromWikipediaUrl(member.portraitImageUrl) ??
    englishNameFromWikipediaUrl(member.imageUrl)
  if (fromWikiUrl) return fromWikiUrl
  const hebrew = memberHebrewName(member)
  return hebrew || '…'
}

export function memberTooltipFieldValue(
  raw: string,
  locale: AppLocale,
  noInfoLabel: string,
): string {
  const normalized = normalizeMemberSheetField(raw, noInfoLabel)
  if (locale === 'he') return normalized
  return localBioTranslation(normalized, noInfoLabel)
}
