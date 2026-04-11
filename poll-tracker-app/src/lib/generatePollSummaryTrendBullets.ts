import { PARTY_SEGMENT_BY_KEY } from '../config/mappings'
import { narrativePartyLabelWrap, narrativeSeatDeltaLeadHtml } from '../ui/pollNarrativeHtml'
import type { AppLocale } from '../i18n/localeContext'
import type { Segment } from '../types/data'
import {
  averagePartySeatDeltaAcrossOutlets,
  type RollingWindowRow,
  type RollingWindowSummary,
} from './pollRollingWindow'

function round1(n: number) {
  return Math.round(n * 10) / 10
}

function segmentForPartyKey(partyKey: string, rows: RollingWindowRow[]): Segment {
  const fromMap = PARTY_SEGMENT_BY_KEY[partyKey]
  if (fromMap) return fromMap
  for (const row of rows) {
    const cp = row.changedParties.find((c) => c.party === partyKey)
    if (cp) return cp.segment
  }
  return 'Opposition'
}

function changedPartyOutletCount(rows: RollingWindowRow[], partyKey: string): number {
  let n = 0
  for (const row of rows) {
    if (row.changedParties.some((c) => c.party === partyKey)) n += 1
  }
  return n
}

/** Hebrew subject: ערוץ X / ערוצי X ו-Y / ערוצי X, Y ו-Z */
function hebrewOutletsSubjectOutlier(displayNames: string[]): string {
  if (displayNames.length === 1) return `ערוץ ${displayNames[0]}`
  if (displayNames.length === 2) return `ערוצי ${displayNames[0]} ו${displayNames[1]}`
  return `ערוצי ${displayNames[0]}, ${displayNames[1]} ו${displayNames[2]}`
}

function englishOutletsListOutlier(displayNames: string[]): string {
  if (displayNames.length === 1) return displayNames[0]
  if (displayNames.length === 2) return `${displayNames[0]} and ${displayNames[1]}`
  return `${displayNames[0]}, ${displayNames[1]}, and ${displayNames[2]}`
}

function outlierTrendBullets(
  outliers: RollingWindowRow[],
  displayMediaOutlet: (outlet: string) => string,
  locale: AppLocale,
): string {
  const first = outliers[0]
  if (!first?.previous) return ''
  const d0 = first.current.coalitionTotal - first.previous.coalitionTotal
  const strengthening = d0 > 0
  const names = outliers.map((r) => displayMediaOutlet(r.current.mediaOutlet))

  if (locale === 'he') {
    const subject = hebrewOutletsSubjectOutlier(names)
    const verb = outliers.length === 1 ? 'מצביע' : 'מצביעים'
    const noun = strengthening ? 'התחזקות' : 'התחלשות'
    return `<strong>חריגים:</strong> ${subject} ${verb} על ${noun} לקואליציה.`
  }

  const list = englishOutletsListOutlier(names)
  const verb = outliers.length === 1 ? 'points' : 'point'
  const tail = strengthening ? 'coalition strengthening' : 'coalition weakening'
  return `<strong>Outliers:</strong> ${list} ${verb} to ${tail}.`
}

function hePollsPhrase(nOutlets: number): string {
  if (nOutlets === 1) return 'סקר אחד'
  return `${nOutlets} סקרים`
}

function enPollsPhrase(nOutlets: number): string {
  if (nOutlets === 1) return 'across 1 poll'
  return `across ${nOutlets} polls`
}

function partyTrendClause(locale: AppLocale, avg: number, n: number, nOutlets: number): string {
  const seat = narrativeSeatDeltaLeadHtml(avg, n)
  if (locale === 'he') {
    const scope = hePollsPhrase(nOutlets)
    return `${seat} מנדטים בממוצע (${scope})`
  }
  const scope = enPollsPhrase(nOutlets)
  return `${seat} seats on average (${scope})`
}

function partyTrendBulletHtml(
  partyKey: string,
  avg: number,
  nOutlets: number,
  locale: AppLocale,
  displayParty: (k: string) => string,
): string {
  const n = round1(Math.abs(avg))
  const clause = partyTrendClause(locale, avg, n, nOutlets)

  /* [[party:…]] first so icon sits at line-start (inline-end in RTL, inline-start in LTR). */
  if (partyKey === 'Yisrael Beiteinu') {
    if (locale === 'he') {
      return `[[party:Yisrael Beiteinu]]${narrativePartyLabelWrap('<strong>ישראל ביתנו</strong>')} – ${clause}`
    }
    return `[[party:Yisrael Beiteinu]]${narrativePartyLabelWrap('<strong>Yisrael Beiteinu</strong>')} – ${clause}`
  }
  if (partyKey === "Bennett's Party") {
    if (locale === 'he') {
      return `[[party:Bennett]]${narrativePartyLabelWrap('<strong>בנט</strong>')} – ${clause}`
    }
    return `[[party:Bennett]]${narrativePartyLabelWrap('<strong>Bennett</strong>')} – ${clause}`
  }

  const name = displayParty(partyKey)
  return `[[party:${partyKey}]]${narrativePartyLabelWrap(`<strong>${name}</strong>`)} – ${clause}`
}

const MAX_BULLETS = 8

/**
 * Data-driven poll summary trend bullets: matches rules in scripts/build-poll-summary-narrative.mjs
 * (no aggregate hero restatement, no flat-outlet lines, no Arab-segment party trend lines).
 * Uses the same rolling window and rows as {@link buildRollingWindowReport}.
 */
export function generatePollSummaryTrendBullets(
  rows: RollingWindowRow[],
  summary: RollingWindowSummary,
  opts: {
    locale: AppLocale
    windowDays: number
    displayMediaOutlet: (outlet: string) => string
    displayParty: (partyKey: string) => string
  },
): string[] {
  const { locale, windowDays, displayMediaOutlet, displayParty } = opts
  const rn = rows.length
  const nRollPrior = summary.nWithPrior
  const deltaC = summary.deltaCoalition

  const bullets: string[] = []

  if (rn === 0) {
    if (locale === 'he') {
      bullets.push(
        `<strong>חלון</strong> – אין סקרים בחלון ${windowDays} ימים – בדקו גיליון או סינון ישנות`,
      )
    } else {
      bullets.push(
        `<strong>Window</strong> – no polls in ${windowDays}d window – check sheet or stale filter`,
      )
    }
    return bullets
  }

  if (nRollPrior === 0) {
    if (locale === 'he') {
      bullets.push(
        `<strong>ערוצים</strong> – ${rn} סקרים ב־${windowDays} ימים – אין סקר קודם להשוואה לכל ערוץ`,
      )
    } else {
      bullets.push(
        `<strong>Outlets</strong> – ${rn} polls in ${windowDays}d – no prior poll to compare per outlet`,
      )
    }
    return bullets
  }

  const meanSignC = Math.sign(deltaC)
  if (meanSignC !== 0 && Math.abs(deltaC) >= 0.2) {
    const outliers = rows.filter((r) => {
      if (!r.previous) return false
      const dC = r.current.coalitionTotal - r.previous.coalitionTotal
      return dC !== 0 && Math.sign(dC) !== meanSignC
    })
    if (outliers.length > 0 && outliers.length <= 3) {
      bullets.push(outlierTrendBullets(outliers, displayMediaOutlet, locale))
    }
  }

  const avgParty = averagePartySeatDeltaAcrossOutlets(rows)
  const ranked = [...avgParty.entries()]
    .filter(
      ([partyKey, v]) =>
        v !== 0 && !Number.isNaN(v) && segmentForPartyKey(partyKey, rows) !== 'Arabs',
    )
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 5)

  for (const [partyKey, avg] of ranked) {
    const nc = changedPartyOutletCount(rows, partyKey)
    if (nc === 0) continue
    bullets.push(partyTrendBulletHtml(partyKey, avg, nc, locale, displayParty))
  }

  return bullets.slice(0, MAX_BULLETS)
}
