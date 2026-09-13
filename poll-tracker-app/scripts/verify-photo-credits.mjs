/**
 * Verify photo credit parsing preserves parenthetical notes (5 sample rows).
 * Run: node poll-tracker-app/scripts/verify-photo-credits.mjs
 */

const V2_GID = '2119255863'
const CREDITS_GID = '1260512030'
const SPREADSHEET_ID = '1oHaO9UKuLn1MR6iAQ2URu8XC62AkfoTN7zYAXxcV9SQ'

function parseCsvLine(line) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else inQuotes = false
      } else cur += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}

function parsePhotoCreditText(raw) {
  const t = raw.trim()
  return t.length > 0 ? t : null
}

/** Old buggy path — drops parenthetical credits. */
function canonicalizeSourceToken(fragment) {
  const t = fragment.trim()
  if (!t) return null
  const withoutYear = t.replace(/\b20\d{2}\b/g, '').trim()
  if (!withoutYear || withoutYear.length < 2) return null
  if (/^[\u0590-\u05FFa-zA-Z0-9."'\-\s]{2,48}$/.test(withoutYear)) return withoutYear
  return null
}

async function fetchCsv(gid) {
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`HTTP ${r.status} for gid ${gid}`)
  return r.text()
}

const csv = await fetchCsv(V2_GID)
const lines = csv.split(/\r?\n/).filter(Boolean)
const headers = parseCsvLine(lines[0])
const creditIdx = headers.indexOf('רישיון/מקור תמונה')
const nameIdx = headers.indexOf('שם המועמד/ת')

const creditsCsv = await fetchCsv(CREDITS_GID)
const creditLines = creditsCsv.split(/\r?\n/).filter(Boolean)
const creditHeaders = parseCsvLine(creditLines[0])
const creditCol = creditHeaders.indexOf('קרדיט')
const candCol = creditHeaders.indexOf('מועמד/ת')

function photoCreditDisplayMode(record) {
  const credit = record.credit?.trim() ?? ''
  if (!credit) return 'none'
  if (record.license?.trim() || credit.startsWith('אתר')) return 'full'
  return 'neutral'
}

console.log('=== Credit parser: parsePhotoCreditText vs old tokenizer (5 samples) ===\n')

const sampleRows = creditLines.slice(1, 6)
for (const line of sampleRows) {
  const cols = parseCsvLine(line)
  const raw = cols[creditCol] ?? ''
  const name = cols[candCol] ?? ''
  console.log(name)
  console.log(`  raw:     ${raw}`)
  console.log(`  parsed:  ${parsePhotoCreditText(raw)}`)
  console.log(`  old bug: ${canonicalizeSourceToken(raw)}`)
  console.log('')
}

const licenseCol = creditHeaders.indexOf('רישיון')
console.log('\n=== Under-photo display mode (licensed / neutral samples) ===\n')
for (const line of creditLines.slice(1)) {
  const cols = parseCsvLine(line)
  const record = {
    credit: cols[creditCol] ?? '',
    license: cols[licenseCol] ?? '',
  }
  const mode = photoCreditDisplayMode(record)
  if (mode === 'full' && record.license.trim()) {
    console.log(`${cols[candCol]}: full (license=${record.license.trim()})`)
  }
  if (mode === 'neutral' && /ynet/i.test(record.credit)) {
    console.log(`${cols[candCol]}: neutral (news credit hidden on card)`)
  }
  if (record.credit.trim().startsWith('אתר')) {
    console.log(`${cols[candCol]}: full (party site)`)
  }
}
