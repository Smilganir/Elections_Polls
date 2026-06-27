/**
 * Detect a new Maariv poll in Google Sheets (for Friday narrative sync).
 * Writes GitHub Actions outputs: sync, poll_id, poll_date, reason.
 *
 * Fingerprint: .maariv-narrative-sync (pollId:YYYY-MM-DD)
 * Force: node scripts/check-maariv-friday-poll.mjs --force
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '../poll-tracker-app/.env')
const fingerprintPath = path.join(__dirname, '../.maariv-narrative-sync')
const MAARIV_KEY = 'מעריב'
const FORCE = process.argv.includes('--force')

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

function enc(s) {
  return encodeURIComponent(s)
}

function ilParts(now = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]))
  return {
    isoDate: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: parts.weekday,
    hour: Number(parts.hour),
  }
}

function readFingerprint() {
  if (!fs.existsSync(fingerprintPath)) return { pollId: 0, date: '' }
  const raw = fs.readFileSync(fingerprintPath, 'utf8').trim()
  const m = raw.match(/^(\d+):(\d{4}-\d{2}-\d{2})/)
  if (!m) return { pollId: 0, date: '' }
  return { pollId: Number(m[1]), date: m[2] }
}

function writeGithubOutput(key, value) {
  const out = process.env.GITHUB_OUTPUT
  if (!out) return
  fs.appendFileSync(out, `${key}=${value}\n`)
}

async function sheet(tab, key, sid) {
  const range = enc(`'${tab.replace(/'/g, "''")}'!A:Z`)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sid}/values/${range}?key=${enc(key)}`
  const r = await fetch(url, { headers: { Referer: 'http://localhost:5173/' } })
  if (!r.ok) throw new Error(await r.text())
  const j = await r.json()
  return j.values ?? []
}

async function latestMaarivPoll() {
  const env = loadEnv()
  const key = env.VITE_GOOGLE_SHEETS_API_KEY
  const sid =
    env.VITE_GOOGLE_SHEETS_SPREADSHEET_ID?.trim() || '1RIqzrv_ViVWBqeXkM-rOAvusoXryyRFX5Xmu2S-uEw4'
  if (!key) throw new Error('Missing VITE_GOOGLE_SHEETS_API_KEY in poll-tracker-app/.env')

  const unpivot = await sheet('UnpivotData', key, sid)
  const [uh, ...ud] = unpivot
  const ui = Object.fromEntries(uh.map((h, i) => [h, i]))

  let best = null
  for (const row of ud) {
    const media = (row[ui['Media Outlet']] || '').trim()
    if (media !== MAARIV_KEY) continue
    const pollId = Number(row[ui['Poll ID']])
    const date = (row[ui['Date']] || '').trim()
    if (!Number.isFinite(pollId) || !date) continue
    if (!best || pollId > best.pollId) best = { pollId, date }
    else if (pollId === best.pollId && date > best.date) best.date = date
  }
  return best
}

function emit(sync, reason, poll) {
  writeGithubOutput('sync', sync ? 'true' : 'false')
  writeGithubOutput('reason', reason)
  if (poll) {
    writeGithubOutput('poll_id', String(poll.pollId))
    writeGithubOutput('poll_date', poll.date)
  }
  console.log(JSON.stringify({ sync, reason, poll }, null, 2))
}

const il = ilParts()
const isFriday = il.weekday === 'Fri'
const fp = readFingerprint()

try {
  const poll = await latestMaarivPoll()
  if (!poll) {
    emit(false, 'no_maariv_poll_in_sheet')
    process.exit(0)
  }

  const isNew = poll.pollId > fp.pollId

  if (FORCE) {
    emit(true, 'forced', poll)
    process.exit(0)
  }

  if (!isNew) {
    emit(false, 'maariv_unchanged', poll)
    process.exit(0)
  }

  if (isFriday || process.env.GITHUB_EVENT_NAME === 'workflow_dispatch') {
    emit(true, isFriday ? 'new_maariv_on_friday' : 'manual_dispatch_new_maariv', poll)
    process.exit(0)
  }

  emit(false, 'new_maariv_outside_friday_window', poll)
} catch (err) {
  console.error(err)
  emit(false, 'error')
  process.exit(1)
}
