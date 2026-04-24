/**
 * Build poll-summary-narrative.json from rolling-window rows (same logic as the app).
 * Called from summarize-latest-blocs.mjs after sheet fetch.
 *
 * Trend bullets: no cross-outlet coalition/opp averages (hero already shows them); no “flat bloc”
 * per-outlet lines; no per-party bullets for Arab-segment lists (treat list-to-list moves as
 * structural). Outliers vs mean direction + non-Arab party averages only.
 *
 * Background defaults mirror TS fallbacks; the app prefers JSON `locales.*.background` when set—revise DEFAULT_BACKGROUND_* when the public story shifts.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Match poll-tracker-app/src/config/mappings.ts — English outlet labels */
const ENGLISH_MEDIA_NAMES = {
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

/** Match HEBREW_PARTY_DISPLAY_OVERRIDES */
const HEBREW_PARTY_OVERRIDES = {
  'Joint Arab List': 'רשימה ערבית משותפת',
}

/** One sentence: institutional + political frame only (no poll figures). Align EN/HE; refresh when context changes. */
const DEFAULT_BACKGROUND_EN =
  'The countdown to the October 2026 election, alongside fallout from the war with Iran and a divisive ceasefire, keeps the coalition stuck below a majority in most polls, with a slight softening for Likud and the right.'
const DEFAULT_BACKGROUND_HE =
  'רקע: ספירה לאחור לבחירות אוקטובר 2026, לצד הדי המלחמה מול איראן והפסקת אש שנויה במחלוקת—רוב הסקרים ממשיכים להציב את הקואליציה מתחת לרוב, עם ריכוך קל בליכוד ובימין.'

function round1(x) {
  return Math.round(x * 10) / 10
}

function mediaEn(mediaKey) {
  return ENGLISH_MEDIA_NAMES[mediaKey] ?? mediaKey
}

function mediaHe(mediaKey) {
  return mediaKey
}

function partyDisplayEn(partyKey) {
  return partyKey
}

function partyDisplayHe(partyKey, partyHebByKey) {
  const o = HEBREW_PARTY_OVERRIDES[partyKey]
  if (o) return o
  return partyHebByKey.get(partyKey)?.trim() || partyKey
}

function segmentForParty(segByParty, partyKey) {
  return segByParty?.get?.(partyKey) ?? 'Opposition'
}

/**
 * Mean seat delta vs prior per party; only outlets where the party changed contribute.
 * Mirrors poll-tracker-app/src/lib/pollRollingWindow.ts averagePartySeatDeltaAcrossOutlets
 */
function averagePartySeatDeltaAcrossOutlets(rollingRowsRaw) {
  const sum = new Map()
  const count = new Map()
  for (const row of rollingRowsRaw) {
    for (const cp of row.changedParties) {
      sum.set(cp.party, (sum.get(cp.party) ?? 0) + cp.delta)
      count.set(cp.party, (count.get(cp.party) ?? 0) + 1)
    }
  }
  const out = new Map()
  for (const [party, s] of sum) {
    const n = count.get(party) ?? 0
    if (n > 0) out.set(party, s / n)
  }
  return out
}

function hePollsPhrase(nOutlets) {
  if (nOutlets === 1) return 'סקר אחד'
  return `${nOutlets} סקרים`
}

function enPollsPhrase(nOutlets) {
  if (nOutlets === 1) return 'across 1 poll'
  return `across ${nOutlets} polls`
}

/** Whitelist in poll-tracker-app/src/ui/pollNarrativeHtml.ts sanitizeNarrativeHtml */
const SEAT_SPAN_CLASS_UP = 'lpo-ps-narrative-seat lpo-ps-narrative-seat--up'
const SEAT_SPAN_CLASS_DOWN = 'lpo-ps-narrative-seat lpo-ps-narrative-seat--down'
const TREND_ARROW_CLASS_UP =
  'lpo-ps-narrative-party-trend-arrow lpo-ps-narrative-party-trend-arrow--up'
const TREND_ARROW_CLASS_DOWN =
  'lpo-ps-narrative-party-trend-arrow lpo-ps-narrative-party-trend-arrow--down'
const SEAT_DELTA_RUN_CLASS = 'lpo-ps-narrative-seat-delta-run'

function trendArrowSpanHtml(avg) {
  const cls = avg > 0 ? TREND_ARROW_CLASS_UP : TREND_ARROW_CLASS_DOWN
  const ch = avg > 0 ? '+' : '-'
  return `<span class="${cls}">${ch}</span>`
}

function seatMagnitudeSpanHtml(avg, n) {
  const cls = avg > 0 ? SEAT_SPAN_CLASS_UP : SEAT_SPAN_CLASS_DOWN
  return `<span class="${cls}"><strong>${n}</strong></span>`
}

function seatDeltaLeadHtml(avg, n) {
  return `<span dir="ltr" class="${SEAT_DELTA_RUN_CLASS}">${trendArrowSpanHtml(avg)}${seatMagnitudeSpanHtml(avg, n)}</span>`
}

function partyTrendClauseEn(avg, n, nOutlets) {
  const seat = seatDeltaLeadHtml(avg, n)
  const scope = enPollsPhrase(nOutlets)
  return `${seat} seats on average (<strong>${scope}</strong>)`
}

function partyTrendClauseHe(avg, n, nOutlets) {
  const seat = seatDeltaLeadHtml(avg, n)
  const scope = hePollsPhrase(nOutlets)
  return `${seat} מנדטים בממוצע (<strong>${scope}</strong>)`
}

const NARRATIVE_PARTY_LABEL_CLASS = 'lpo-ps-narrative-party-label'

function partyLabelWrap(innerHtml) {
  return `<span class="${NARRATIVE_PARTY_LABEL_CLASS}">${innerHtml}</span>`
}

/** Party line: [[party:…]] first (line-start icon in RTL/LTR); one token per party (skill). */
function partyBulletEn(partyKey, avg, nOutlets) {
  const n = round1(Math.abs(avg))
  const clause = partyTrendClauseEn(avg, n, nOutlets)
  if (partyKey === 'Yisrael Beiteinu') {
    return `[[party:Yisrael Beiteinu]]${partyLabelWrap('<strong>Yisrael Beiteinu</strong>')} – ${clause}`
  }
  if (partyKey === "Bennett's Party") {
    return `[[party:Bennett]]${partyLabelWrap('<strong>Bennett</strong>')} – ${clause}`
  }
  const name = partyDisplayEn(partyKey)
  return `[[party:${partyKey}]]${partyLabelWrap(`<strong>${name}</strong>`)} – ${clause}`
}

function partyBulletHe(partyKey, avg, nOutlets, partyHebByKey) {
  const n = round1(Math.abs(avg))
  const clause = partyTrendClauseHe(avg, n, nOutlets)
  if (partyKey === 'Yisrael Beiteinu') {
    return `[[party:Yisrael Beiteinu]]${partyLabelWrap('<strong>ישראל ביתנו</strong>')} – ${clause}`
  }
  if (partyKey === "Bennett's Party") {
    return `[[party:Bennett]]${partyLabelWrap('<strong>בנט</strong>')} – ${clause}`
  }
  const name = partyDisplayHe(partyKey, partyHebByKey)
  return `[[party:${partyKey}]]${partyLabelWrap(`<strong>${name}</strong>`)} – ${clause}`
}

function changedPartyOutletCount(rollingRowsRaw, partyKey) {
  let n = 0
  for (const row of rollingRowsRaw) {
    if (row.changedParties.some((c) => c.party === partyKey)) n += 1
  }
  return n
}

function hebrewOutletsSubjectOutlier(namesHe) {
  if (namesHe.length === 1) return `ערוץ ${namesHe[0]}`
  if (namesHe.length === 2) return `ערוצי ${namesHe[0]} ו${namesHe[1]}`
  return `ערוצי ${namesHe[0]}, ${namesHe[1]} ו${namesHe[2]}`
}

function englishOutletsListOutlier(namesEn) {
  if (namesEn.length === 1) return namesEn[0]
  if (namesEn.length === 2) return `${namesEn[0]} and ${namesEn[1]}`
  return `${namesEn[0]}, ${namesEn[1]}, and ${namesEn[2]}`
}

function outlierBulletHe(outliers, namesHe) {
  const d0 = outliers[0].delta.coalition
  const strengthening = d0 > 0
  const subject = hebrewOutletsSubjectOutlier(namesHe)
  const verb = namesHe.length === 1 ? 'מצביע' : 'מצביעים'
  const noun = strengthening ? 'התחזקות' : 'התחלשות'
  return `<strong>חריגים:</strong> ${subject} ${verb} על ${noun} לקואליציה.`
}

function outlierBulletEn(outliers, namesEn) {
  const d0 = outliers[0].delta.coalition
  const strengthening = d0 > 0
  const list = englishOutletsListOutlier(namesEn)
  const verb = namesEn.length === 1 ? 'points' : 'point'
  const tail = strengthening ? 'coalition strengthening' : 'coalition weakening'
  return `<strong>Outliers:</strong> ${list} ${verb} to ${tail}.`
}

/**
 * @param {object} opts
 * @param {Array} opts.rollingRowsRaw — same shape as summarize-latest-blocs
 * @param {Map<string,string>} opts.partyHebByKey
 * @param {Map<string,string>} opts.segByParty — Party → Segment (Coalition | Opposition | Arabs)
 * @param {string} opts.asOfDate — YYYY-MM-DD
 * @param {number} opts.windowDays
 * @param {number} opts.avgRollCoalition — for outlier mean direction only (not echoed as a bullet)
 * @param {number} opts.prevRollAvgCoalition
 */
export function buildPollSummaryNarrativeDoc(opts) {
  const {
    rollingRowsRaw,
    partyHebByKey,
    segByParty,
    asOfDate,
    windowDays,
    avgRollC: avgRollCoalition,
    prevRollAvgC: prevRollAvgCoalition,
    nRollPrior,
    rn,
  } = opts

  const deltaC = nRollPrior ? round1(avgRollCoalition - prevRollAvgCoalition) : 0

  const enBullets = []
  const heBullets = []

  if (rn === 0) {
    enBullets.push(
      `<strong>Window</strong> – no polls in ${windowDays}d window – check sheet or stale filter`,
    )
    heBullets.push(
      `<strong>חלון</strong> – אין סקרים בחלון ${windowDays} ימים – בדקו גיליון או סינון ישנות`,
    )
  } else if (nRollPrior === 0) {
    enBullets.push(
      `<strong>Outlets</strong> – ${rn} polls in ${windowDays}d – no prior poll to compare per outlet`,
    )
    heBullets.push(
      `<strong>ערוצים</strong> – ${rn} סקרים ב־${windowDays} ימים – אין סקר קודם להשוואה לכל ערוץ`,
    )
  }

  const meanSignC = Math.sign(deltaC)
  if (nRollPrior > 0 && meanSignC !== 0) {
    const outliers = rollingRowsRaw.filter(
      (r) =>
        r.delta &&
        r.previous &&
        r.delta.coalition !== 0 &&
        Math.sign(r.delta.coalition) !== meanSignC &&
        Math.abs(deltaC) >= 0.2,
    )
    if (outliers.length > 0 && outliers.length <= 3) {
      const namesEn = outliers.map((r) => mediaEn(r.media))
      const namesHe = outliers.map((r) => mediaHe(r.media))
      enBullets.push(outlierBulletEn(outliers, namesEn))
      heBullets.push(outlierBulletHe(outliers, namesHe))
    }
  }

  const avgParty = averagePartySeatDeltaAcrossOutlets(rollingRowsRaw)
  const ranked = [...avgParty.entries()]
    .filter(
      ([partyKey, v]) =>
        v !== 0 &&
        !Number.isNaN(v) &&
        segmentForParty(segByParty, partyKey) !== 'Arabs',
    )
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 5)

  for (const [partyKey, avg] of ranked) {
    const nc = changedPartyOutletCount(rollingRowsRaw, partyKey)
    if (nc === 0) continue
    enBullets.push(partyBulletEn(partyKey, avg, nc))
    heBullets.push(partyBulletHe(partyKey, avg, nc, partyHebByKey))
  }

  const maxBullets = 8
  return {
    asOfUtc: asOfDate,
    locales: {
      en: {
        background: DEFAULT_BACKGROUND_EN,
        trendBullets: enBullets.slice(0, maxBullets),
      },
      he: {
        background: DEFAULT_BACKGROUND_HE,
        trendBullets: heBullets.slice(0, maxBullets),
      },
    },
  }
}

export function writePollSummaryNarrativeFromRolling(opts) {
  const doc = buildPollSummaryNarrativeDoc(opts)
  const outPath = path.join(__dirname, '../poll-tracker-app/src/content/poll-summary-narrative.json')
  fs.writeFileSync(outPath, `${JSON.stringify(doc, null, 2)}\n`, 'utf8')
  return outPath
}
