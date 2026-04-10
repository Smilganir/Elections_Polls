/**
 * One-off: fetch UnpivotData + Parties Dim, latest poll per media outlet, bloc seat totals.
 * Run from repo root: node scripts/summarize-latest-blocs.mjs
 * Requires poll-tracker-app/.env with VITE_GOOGLE_SHEETS_API_KEY (Sheets API, sheet link viewable).
 *
 * Drops an outlet if its latest poll date is more than MAX_STALE_DAYS before today (UTC calendar days).
 * Override: MAX_STALE_DAYS=45 node scripts/summarize-latest-blocs.mjs
 *
 * vsPreviousPollSameOutlets: for each remaining outlet, compares latest poll to the prior poll
 * (second-highest Poll ID for that outlet) and reports cross-outlet means + per-outlet deltas.
 *
 * rollingWindow30dCoO: matches the web app “poll summary” — per outlet, latest poll *dated* in the window;
 * headline = coalition vs opposition only (Arabs excluded); prior = next-lower Poll ID; changedParties vs prior.
 */
const MAX_STALE_DAYS = Number(process.env.MAX_STALE_DAYS) || 30

function utcDayStart(d) {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

function parseSheetDate(s) {
  const m = String(s).trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function ageDaysPollToToday(pollDateStr, today = new Date()) {
  const pollT = parseSheetDate(pollDateStr)
  if (pollT === null) return Infinity
  const diff = utcDayStart(today) - pollT
  return Math.floor(diff / 86400000)
}
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { buildPollBlocHtml } from './poll-bloc-html.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '../poll-tracker-app/.env')

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

function parseSegment(raw) {
  const t = (raw ?? '').trim()
  if (t === 'Coalition') return 'Coalition'
  if (t === 'Arabs') return 'Arabs'
  return 'Opposition'
}

/** Bloc seat totals for one poll record `{ parties: [...] }`. */
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

/** Party rows sorted by seats descending for one poll. */
function partyBreakdownList(poll, segByParty) {
  return [...poll.parties]
    .map((pr) => ({
      party: pr.party,
      votes: pr.votes,
      segment: segByParty.get(pr.party) ?? 'Opposition',
    }))
    .sort((a, b) => b.votes - a.votes || a.party.localeCompare(b.party))
}

const unpivot = await sheet('UnpivotData')
const parties = await sheet('Parties Dim')
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

const rawLatest = []
for (const [media, polls] of byOutlet) {
  let best = null
  for (const p of polls.values()) {
    if (!best || p.pollId > best.pollId) best = p
  }
  if (!best) continue
  const { coalition: c, opposition: o, arabs: a } = blocTotals(best, segByParty)
  const parties = partyBreakdownList(best, segByParty)
  rawLatest.push({
    media,
    pollId: best.pollId,
    date: best.date,
    coalition: c,
    opposition: o,
    arabs: a,
    parties,
  })
}

const today = new Date()
const excludedStale = []
const latest = []
for (const row of rawLatest) {
  const age = ageDaysPollToToday(row.date, today)
  if (age > MAX_STALE_DAYS) {
    excludedStale.push({ media: row.media, date: row.date, ageDays: age })
    continue
  }
  latest.push(row)
}
latest.sort((x, y) => x.media.localeCompare(y.media))
excludedStale.sort((a, b) => a.media.localeCompare(b.media))

const n = latest.length || 1
const avgC = latest.reduce((s, x) => s + x.coalition, 0) / n
const avgO = latest.reduce((s, x) => s + x.opposition, 0) / n
const avgA = latest.reduce((s, x) => s + x.arabs, 0) / n
const antiBloc = avgO + avgA

const majC = latest.filter((x) => x.coalition >= 61).length
const majAnti = latest.filter((x) => x.opposition + x.arabs >= 61).length

const withLead = latest.map((x) => ({
  ...x,
  anti: x.opposition + x.arabs,
  leadCoalition: x.coalition - (x.opposition + x.arabs),
}))

const coalitionLeadsCount = withLead.filter((x) => x.leadCoalition > 0).length
const antiLeadsCount = withLead.filter((x) => x.leadCoalition < 0).length

const outlierAntiLead = withLead.filter((x) => x.leadCoalition < 0).map((x) => x.media)
const outlierCoalLead = withLead.filter((x) => x.leadCoalition > 0 && avgC < antiBloc).map((x) => x.media)

/** Simple momentum: avg coalition in latest 25% of dated polls vs prior 25% (by unique poll dates). */
const byDate = [...latest].sort((a, b) => a.date.localeCompare(b.date))
const dates = [...new Set(byDate.map((x) => x.date))]
const q = Math.max(1, Math.floor(dates.length / 4))
const recentDates = new Set(dates.slice(-q))
const oldDates = new Set(dates.slice(0, q))
const avgCoalRecent =
  byDate.filter((x) => recentDates.has(x.date)).reduce((s, x) => s + x.coalition, 0) /
    Math.max(1, byDate.filter((x) => recentDates.has(x.date)).length) || avgC
const avgCoalOld =
  byDate.filter((x) => oldDates.has(x.date)).reduce((s, x) => s + x.coalition, 0) /
    Math.max(1, byDate.filter((x) => oldDates.has(x.date)).length) || avgC
const momentum =
  avgCoalRecent > avgCoalOld + 0.5 ? 'upwards' : avgCoalRecent < avgCoalOld - 0.5 ? 'downwards' : 'flat'

/** Latest (<30d) vs immediately prior poll, same outlets only (second-highest Poll ID per outlet). */
const vsPreviousRows = []
for (const cur of latest) {
  const polls = byOutlet.get(cur.media)
  if (!polls) continue
  const sortedIds = [...polls.keys()].sort((a, b) => b - a)
  if (sortedIds.length < 2) continue
  const prevPoll = polls.get(sortedIds[1])
  if (!prevPoll) continue
  const prevBlocs = blocTotals(prevPoll, segByParty)
  vsPreviousRows.push({
    media: cur.media,
    latest: {
      pollId: cur.pollId,
      date: cur.date,
      coalition: cur.coalition,
      opposition: cur.opposition,
      arabs: cur.arabs,
      antiBloc: cur.opposition + cur.arabs,
    },
    previous: {
      pollId: prevPoll.pollId,
      date: prevPoll.date,
      ...prevBlocs,
      antiBloc: prevBlocs.opposition + prevBlocs.arabs,
    },
    delta: {
      coalition: cur.coalition - prevBlocs.coalition,
      opposition: cur.opposition - prevBlocs.opposition,
      arabs: cur.arabs - prevBlocs.arabs,
      antiBloc: cur.opposition + cur.arabs - (prevBlocs.opposition + prevBlocs.arabs),
      coalitionMinusAnti:
        cur.coalition -
        (cur.opposition + cur.arabs) -
        (prevBlocs.coalition - (prevBlocs.opposition + prevBlocs.arabs)),
    },
  })
}

const nv = vsPreviousRows.length
const avgLatestComparable =
  nv === 0
    ? { coalition: 0, opposition: 0, arabs: 0, antiBloc: 0 }
    : {
        coalition: vsPreviousRows.reduce((s, r) => s + r.latest.coalition, 0) / nv,
        opposition: vsPreviousRows.reduce((s, r) => s + r.latest.opposition, 0) / nv,
        arabs: vsPreviousRows.reduce((s, r) => s + r.latest.arabs, 0) / nv,
      }
if (nv > 0)
  avgLatestComparable.antiBloc = avgLatestComparable.opposition + avgLatestComparable.arabs

const avgPreviousComparable =
  nv === 0
    ? { coalition: 0, opposition: 0, arabs: 0, antiBloc: 0 }
    : {
        coalition: vsPreviousRows.reduce((s, r) => s + r.previous.coalition, 0) / nv,
        opposition: vsPreviousRows.reduce((s, r) => s + r.previous.opposition, 0) / nv,
        arabs: vsPreviousRows.reduce((s, r) => s + r.previous.arabs, 0) / nv,
      }
if (nv > 0)
  avgPreviousComparable.antiBloc = avgPreviousComparable.opposition + avgPreviousComparable.arabs

const deltaAvgComparable =
  nv === 0
    ? { coalition: 0, opposition: 0, arabs: 0, antiBloc: 0, coalitionMinusAnti: 0 }
    : {
        coalition: avgLatestComparable.coalition - avgPreviousComparable.coalition,
        opposition: avgLatestComparable.opposition - avgPreviousComparable.opposition,
        arabs: avgLatestComparable.arabs - avgPreviousComparable.arabs,
        antiBloc: avgLatestComparable.antiBloc - avgPreviousComparable.antiBloc,
        coalitionMinusAnti:
          avgLatestComparable.coalition -
          avgLatestComparable.antiBloc -
          (avgPreviousComparable.coalition - avgPreviousComparable.antiBloc),
      }

function round1(x) {
  return Math.round(x * 10) / 10
}

/** Votes by party name for one poll object from byOutlet. */
function votesByPartyFromPoll(poll) {
  const m = new Map()
  for (const pr of poll.parties) m.set(pr.party, pr.votes)
  return m
}

/**
 * Rolling 30d window: per outlet, latest poll *dated* in window; C/O headline only (matches React poll summary).
 * Prior = next-lower Poll ID for that outlet.
 */
const rollingRowsRaw = []
for (const [media, pollsMap] of byOutlet) {
  const outletPolls = [...pollsMap.values()]
  const inWindow = outletPolls.filter((p) => ageDaysPollToToday(p.date, today) <= MAX_STALE_DAYS)
  if (inWindow.length === 0) continue
  inWindow.sort((a, b) => {
    const dc = b.date.localeCompare(a.date)
    if (dc !== 0) return dc
    return b.pollId - a.pollId
  })
  const current = inWindow[0]
  const bl = blocTotals(current, segByParty)
  const byIdDesc = [...outletPolls].sort((a, b) => b.pollId - a.pollId)
  const idx = byIdDesc.findIndex((p) => p.pollId === current.pollId)
  const prevPoll = idx >= 0 && idx + 1 < byIdDesc.length ? byIdDesc[idx + 1] : null
  const prevBl = prevPoll ? blocTotals(prevPoll, segByParty) : null

  const curM = votesByPartyFromPoll(current)
  const changedParties = []
  if (prevPoll) {
    const pM = votesByPartyFromPoll(prevPoll)
    const names = new Set([...curM.keys(), ...pM.keys()])
    for (const party of names) {
      const c = curM.get(party) ?? 0
      const pv = pM.get(party) ?? 0
      if (c === pv) continue
      changedParties.push({
        party,
        segment: segByParty.get(party) ?? 'Opposition',
        currentVotes: c,
        previousVotes: pv,
        delta: c - pv,
      })
    }
    changedParties.sort(
      (a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.party.localeCompare(b.party),
    )
  }

  rollingRowsRaw.push({
    media,
    current: {
      pollId: current.pollId,
      date: current.date,
      coalition: bl.coalition,
      opposition: bl.opposition,
      arabs: bl.arabs,
    },
    previous:
      prevPoll && prevBl
        ? {
            pollId: prevPoll.pollId,
            date: prevPoll.date,
            coalition: prevBl.coalition,
            opposition: prevBl.opposition,
          }
        : null,
    delta:
      prevBl !== null
        ? {
            coalition: bl.coalition - prevBl.coalition,
            opposition: bl.opposition - prevBl.opposition,
          }
        : null,
    changedParties,
  })
}

rollingRowsRaw.sort((a, b) => {
  const dc = b.current.date.localeCompare(a.current.date)
  if (dc !== 0) return dc
  return b.current.pollId - a.current.pollId
})

const rn = rollingRowsRaw.length
const avgRollC = rn ? rollingRowsRaw.reduce((s, x) => s + x.current.coalition, 0) / rn : 0
const avgRollO = rn ? rollingRowsRaw.reduce((s, x) => s + x.current.opposition, 0) / rn : 0
const rollWithPrior = rollingRowsRaw.filter((x) => x.previous !== null)
const nRollPrior = rollWithPrior.length
const prevRollAvgC =
  nRollPrior === 0
    ? 0
    : rollWithPrior.reduce((s, x) => s + x.previous.coalition, 0) / nRollPrior
const prevRollAvgO =
  nRollPrior === 0
    ? 0
    : rollWithPrior.reduce((s, x) => s + x.previous.opposition, 0) / nRollPrior

const englishMedia = {
  ערוץ_14: 'Channel 14',
  גלובס: 'Globes',
  כאן_חדשות: 'Kan News',
  כלכליסט: 'Calcalist',
  מעריב: 'Maariv',
  דבר: 'Davar',
  וואלה: 'Walla',
  ynet: 'Ynet',
  N12: 'N12',
  i24NEWS: 'i24NEWS',
  'הארץ': 'Haaretz',
  'ישראל היום': 'Israel Hayom',
}

function en(m) {
  return englishMedia[m] ?? m.replace(/_/g, ' ')
}

const report = {
  maxStaleDays: MAX_STALE_DAYS,
  referenceDateUtc: today.toISOString().slice(0, 10),
  excludedStaleOutlets: excludedStale.map((x) => ({
    media: en(x.media),
    date: x.date,
    ageDays: x.ageDays,
  })),
  outlets: n,
  avgCoalition: Math.round(avgC * 10) / 10,
  avgOpposition: Math.round(avgO * 10) / 10,
  avgArabs: Math.round(avgA * 10) / 10,
  avgAntiBloc: Math.round(antiBloc * 10) / 10,
  coalitionLeadSeats: Math.round((avgC - antiBloc) * 10) / 10,
  outletsCoalition61: majC,
  outletsAntiBloc61: majAnti,
  coalitionLeadsOutlets: coalitionLeadsCount,
  antiBlocLeadsOutlets: antiLeadsCount,
  outlierMediaAntiAhead: outlierAntiLead.map(en),
  momentum,
  avgCoalRecent: Math.round(avgCoalRecent * 10) / 10,
  avgCoalOld: Math.round(avgCoalOld * 10) / 10,
  vsPreviousPollSameOutlets: {
    description:
      'Among outlets whose latest poll is <maxStaleDays old: cross-outlet mean of that latest vs mean of each outlet’s prior poll (second-highest Poll ID).',
    outletsWithPriorPoll: vsPreviousRows.length,
    latestAvgAmongComparable: {
      coalition: round1(avgLatestComparable.coalition),
      opposition: round1(avgLatestComparable.opposition),
      arabs: round1(avgLatestComparable.arabs),
      antiBloc: round1(avgLatestComparable.antiBloc),
    },
    previousAvgAmongComparable: {
      coalition: round1(avgPreviousComparable.coalition),
      opposition: round1(avgPreviousComparable.opposition),
      arabs: round1(avgPreviousComparable.arabs),
      antiBloc: round1(avgPreviousComparable.antiBloc),
    },
    deltaAvgLatestMinusPrevious: {
      coalition: round1(deltaAvgComparable.coalition),
      opposition: round1(deltaAvgComparable.opposition),
      arabs: round1(deltaAvgComparable.arabs),
      antiBloc: round1(deltaAvgComparable.antiBloc),
      coalitionMinusAnti: round1(deltaAvgComparable.coalitionMinusAnti),
    },
        perOutlet: vsPreviousRows.map((r) => ({
          media: en(r.media),
          mediaKey: r.media,
          latest: { ...r.latest },
          previous: { ...r.previous },
          deltaLatestMinusPrevious: {
            coalition: r.delta.coalition,
            opposition: r.delta.opposition,
            arabs: r.delta.arabs,
            antiBloc: r.delta.antiBloc,
            coalitionMinusAnti: r.delta.coalitionMinusAnti,
          },
        })),
  },
  perOutlet: withLead.map((x) => ({
    media: en(x.media),
    mediaKey: x.media,
    pollId: x.pollId,
    date: x.date,
    coalition: x.coalition,
    opposition: x.opposition,
    arabs: x.arabs,
    antiBloc: x.anti,
    coalitionMinusAnti: x.leadCoalition,
    parties: (x.parties ?? []).map((p) => ({
      party: p.party,
      votes: p.votes,
      segment: p.segment,
    })),
  })),
  rollingWindow30dCoO: {
    description:
      `Latest poll per outlet dated within ${MAX_STALE_DAYS} days (not necessarily each outlet’s global latest poll). Headline averages use coalition vs opposition seats only (Arab-segment parties excluded). Prior poll = same outlet’s next-lower Poll ID.`,
    outlets: rn,
    avgCoalition: round1(avgRollC),
    avgOpposition: round1(avgRollO),
    outletsWithPriorPoll: nRollPrior,
    prevAvgCoalition: round1(prevRollAvgC),
    prevAvgOpposition: round1(prevRollAvgO),
    deltaCoalition: nRollPrior ? round1(avgRollC - prevRollAvgC) : 0,
    deltaOpposition: nRollPrior ? round1(avgRollO - prevRollAvgO) : 0,
    perOutlet: rollingRowsRaw.map((row) => ({
      media: en(row.media),
      mediaKey: row.media,
      latest: { ...row.current },
      previous: row.previous,
      deltaLatestMinusPrevious: row.delta,
      changedParties: row.changedParties,
    })),
  },
}

console.log(JSON.stringify(report, null, 2))

const WRITE_HTML = !process.argv.includes('--no-html')
const htmlPath = path.join(__dirname, 'poll-bloc-summary.html')

if (WRITE_HTML) {
  fs.writeFileSync(htmlPath, buildPollBlocHtml(report), 'utf8')
  console.error(`Wrote ${htmlPath}`)
}
