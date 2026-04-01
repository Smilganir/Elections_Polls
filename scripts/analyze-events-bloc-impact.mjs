/**
 * Rank Major Events Dim by how much the "bloc picture" shifted around each event date.
 *
 * Method (per event, per media outlet):
 *   - "Before" = latest poll strictly before the event date (within LOOKBACK_DAYS).
 *   - "After"  = earliest poll strictly after the event date (within LOOKAHEAD_DAYS).
 *   - Require both; average Δ(coalition), Δ(anti-bloc), Δ(lead) across outlets with a pair.
 *
 * Primary impact score: mean absolute Δ(lead) where lead = coalition − (opposition + arabs).
 *
 * Usage: node scripts/analyze-events-bloc-impact.mjs
 * Env: LOOKBACK_DAYS=120 LOOKAHEAD_DAYS=120 MIN_OUTLETS=4 (optional)
 * Requires poll-tracker-app/.env with VITE_GOOGLE_SHEETS_API_KEY (same as summarize-latest-blocs.mjs).
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '../poll-tracker-app/.env')

const LOOKBACK_DAYS = Number(process.env.LOOKBACK_DAYS) || 120
const LOOKAHEAD_DAYS = Number(process.env.LOOKAHEAD_DAYS) || 120
const MIN_OUTLETS = Number(process.env.MIN_OUTLETS) || 4

function loadEnv() {
  const o = {}
  if (!fs.existsSync(envPath)) return o
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) {
      let v = m[2].trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
        v = v.slice(1, -1)
      o[m[1].trim()] = v
    }
  }
  return o
}

const env = loadEnv()
const key = env.VITE_GOOGLE_SHEETS_API_KEY
const sid =
  env.VITE_GOOGLE_SHEETS_SPREADSHEET_ID?.trim() || '1RIqzrv_ViVWBqeXkM-rOAvusoXryyRFX5Xmu2S-uEw4'

if (!key) {
  console.error('Missing VITE_GOOGLE_SHEETS_API_KEY in poll-tracker-app/.env')
  process.exit(1)
}

function enc(s) {
  return encodeURIComponent(s)
}

async function sheet(tab) {
  const range = enc(`'${tab.replace(/'/g, "''")}'!A:Z`)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sid}/values/${range}?key=${enc(key)}`
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 60_000)
  const r = await fetch(url, {
    headers: { Referer: 'http://localhost:5173/' },
    signal: ctrl.signal,
  })
  clearTimeout(t)
  if (!r.ok) throw new Error(await r.text())
  const j = await r.json()
  return j.values ?? []
}

function parseSheetDate(s) {
  const m = String(s).trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function parseSegment(raw) {
  const t = (raw ?? '').trim()
  if (t === 'Coalition') return 'Coalition'
  if (t === 'Arabs') return 'Arabs'
  return 'Opposition'
}

function blocTotals(poll, segByParty) {
  let c = 0,
    o = 0,
    a = 0
  for (const pr of poll.parties) {
    const s = segByParty.get(pr.party) ?? 'Opposition'
    if (s === 'Coalition') c += pr.votes
    else if (s === 'Arabs') a += pr.votes
    else o += pr.votes
  }
  return { coalition: c, opposition: o, arabs: a }
}

const DAY = 86400000
const lookbackMs = LOOKBACK_DAYS * DAY
const lookaheadMs = LOOKAHEAD_DAYS * DAY

const unpivot = await sheet('UnpivotData')
const parties = await sheet('Parties Dim')
const major = await sheet('Major Events Dim')

const [uh, ...ud] = unpivot
const [ph, ...pd] = parties
const ui = Object.fromEntries(uh.map((h, i) => [h, i]))

const segByParty = new Map()
for (const row of pd) {
  const party = (row[ph.indexOf('Party')] ?? '').trim()
  if (!party) continue
  segByParty.set(party, parseSegment(row[ph.indexOf('Segment')]))
}

const rows = ud
  .map((row) => ({
    pollId: Number(row[ui['Poll ID']]),
    date: row[ui['Date']] || '',
    media: (row[ui['Media Outlet']] || '').trim(),
    party: (row[ui['Party']] || '').trim(),
    votes: Number(row[ui['Votes']]),
  }))
  .filter((r) => r.date && r.media && Number.isFinite(r.votes))

const byOutlet = new Map()
for (const r of rows) {
  if (!byOutlet.has(r.media)) byOutlet.set(r.media, new Map())
  const polls = byOutlet.get(r.media)
  if (!polls.has(r.pollId))
    polls.set(r.pollId, { pollId: r.pollId, date: r.date, parties: [] })
  const p = polls.get(r.pollId)
  p.parties.push(r)
  if (r.date > p.date) p.date = r.date
}

/** Flat list: one row per (media, pollId) with bloc numbers + dateMs */
const pollSnapshots = []
for (const [media, polls] of byOutlet) {
  for (const poll of polls.values()) {
    const { coalition: c, opposition: o, arabs: a } = blocTotals(poll, segByParty)
    const t = parseSheetDate(poll.date)
    if (t === null) continue
    pollSnapshots.push({
      media,
      pollId: poll.pollId,
      date: poll.date,
      dateMs: t,
      coalition: c,
      antiBloc: o + a,
      lead: c - (o + a),
    })
  }
}

const pollsByMedia = new Map()
for (const p of pollSnapshots) {
  if (!pollsByMedia.has(p.media)) pollsByMedia.set(p.media, [])
  pollsByMedia.get(p.media).push(p)
}
for (const arr of pollsByMedia.values()) arr.sort((a, b) => a.dateMs - b.dateMs || a.pollId - b.pollId)

function nearestBefore(media, eventMs) {
  const arr = pollsByMedia.get(media)
  if (!arr) return null
  let best = null
  for (const p of arr) {
    if (p.dateMs >= eventMs) break
    if (eventMs - p.dateMs > lookbackMs) continue
    best = p
  }
  return best
}

function nearestAfter(media, eventMs) {
  const arr = pollsByMedia.get(media)
  if (!arr) return null
  for (const p of arr) {
    if (p.dateMs <= eventMs) continue
    if (p.dateMs - eventMs > lookaheadMs) return null
    return p
  }
  return null
}

/** Major events: Start line only, same as useDashboardData */
let majorEvents = []
if (major.length > 1) {
  const [mh, ...md] = major
  const mi = Object.fromEntries(mh.map((h, i) => [h, i]))
  const nameI = mi['Event Name']
  const dateI = mi['Event Date']
  const lineI = mi['Event Line']
  const heI = mi['Event He']
  const catI = mi['Category']
  if (nameI !== undefined && dateI !== undefined) {
    const seen = new Set()
    for (const row of md) {
      const name = (row[nameI] ?? '').trim()
      const dateStr = (row[dateI] ?? '').trim()
      const line = lineI !== undefined ? (row[lineI] ?? '').trim() : 'Start'
      if (!name || !dateStr) continue
      if (lineI !== undefined && line !== 'Start') continue
      const eventMs = parseSheetDate(dateStr)
      if (eventMs === null) continue
      const key = `${name}\t${dateStr}`
      if (seen.has(key)) continue
      seen.add(key)
      majorEvents.push({
        eventName: name,
        eventNameHe: heI !== undefined ? (row[heI] ?? '').trim() : '',
        date: dateStr,
        dateMs: eventMs,
        category: catI !== undefined ? (row[catI] ?? '').trim() : '',
      })
    }
  }
}

majorEvents.sort((a, b) => a.dateMs - b.dateMs)

const allMedia = [...byOutlet.keys()]

const results = []
for (const ev of majorEvents) {
  const deltas = []
  for (const media of allMedia) {
    const b = nearestBefore(media, ev.dateMs)
    const a = nearestAfter(media, ev.dateMs)
    if (!b || !a) continue
    deltas.push({
      media,
      beforeDate: b.date,
      afterDate: a.date,
      dCoal: a.coalition - b.coalition,
      dAnti: a.antiBloc - b.antiBloc,
      dLead: a.lead - b.lead,
    })
  }
  const n = deltas.length
  if (n < MIN_OUTLETS) {
    results.push({
      ...ev,
      outletsPaired: n,
      skipped: true,
      reason: `fewer than ${MIN_OUTLETS} outlets with before+after polls in window`,
    })
    continue
  }
  const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length
  const meanDCoal = mean(deltas.map((d) => d.dCoal))
  const meanDAnti = mean(deltas.map((d) => d.dAnti))
  const meanDLead = mean(deltas.map((d) => d.dLead))
  const maeLead = mean(deltas.map((d) => Math.abs(d.dLead)))
  results.push({
    eventName: ev.eventName,
    eventNameHe: ev.eventNameHe,
    eventDate: ev.date,
    category: ev.category,
    outletsPaired: n,
    meanDeltaCoalition: Math.round(meanDCoal * 10) / 10,
    meanDeltaAntiBloc: Math.round(meanDAnti * 10) / 10,
    meanDeltaLead: Math.round(meanDLead * 10) / 10,
    /** Average |Δlead| per outlet — robust "how much moved" */
    meanAbsDeltaLead: Math.round(maeLead * 10) / 10,
    /** Signed swing in cross-outlet mean lead (same as meanDeltaLead); impact rank uses meanAbsDeltaLead */
    impactScore: Math.round(maeLead * 10) / 10,
    skipped: false,
    sample: deltas.slice(0, 3),
  })
}

const ranked = [...results].filter((r) => !r.skipped).sort((a, b) => b.impactScore - a.impactScore)

const report = {
  method: {
    lookbackDays: LOOKBACK_DAYS,
    lookaheadDays: LOOKAHEAD_DAYS,
    minOutlets: MIN_OUTLETS,
    leadDefinition: 'coalition_seats - (opposition + arabs)',
    pairing: 'per_outlet latest_poll_before_event_and_earliest_poll_after_event',
  },
  totalPollSnapshots: pollSnapshots.length,
  majorEventsCount: majorEvents.length,
  rankedByMeanAbsDeltaLead: ranked,
  skippedEvents: results.filter((r) => r.skipped),
  allEventsChronological: results.filter((r) => !r.skipped),
}

console.error(
  `\nניתוח שינוי גושים סביב אירועים (Major Events Dim)\n` +
    `חלון: עד ${LOOKBACK_DAYS} יום לפני / ${LOOKAHEAD_DAYS} יום אחרי תאריך האירוע · מינימום ${MIN_OUTLETS} מדיות עם זוג סקרים\n` +
    `מדד עיקרי: ממוצע |Δיתרון| לפי מדיה — יתרון = קואליציה − (אופוזיציה+ערבים)\n`,
)

if (ranked.length === 0) {
  console.error('אין אירועים עם מספיק זוגות סקרים. נסה להרחיב LOOKBACK_DAYS / LOOKAHEAD_DAYS או להוריד MIN_OUTLETS.\n')
} else {
  console.error('דירוג (מהגבוה לנמוך — הכי "הזיז" את תמונת הגושים):\n')
  ranked.slice(0, 15).forEach((r, i) => {
    const he = r.eventNameHe ? ` (${r.eventNameHe})` : ''
    console.error(
      `  ${i + 1}. ${r.eventName}${he} — ${r.eventDate} | מדיות: ${r.outletsPaired} | ממוצע|Δיתרון|: ${r.meanAbsDeltaLead} | ממוצע Δיתרון (חתום): ${r.meanDeltaLead > 0 ? '+' : ''}${r.meanDeltaLead}`,
    )
  })
  console.error('')
}

console.log(JSON.stringify(report, null, 2))
