/**
 * CLI: fetch → harmonize → same outlet filters as panel default → listResidualDiagnostics → CSV.
 * Usage: npm run export-residual-diagnostics [--] [--split-arabs] [--window 30] [--min-polls 5]
 */
import { config as loadEnv } from 'dotenv'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { UnpivotRow } from '../../poll-tracker-app/src/types/data'
import { harmonizeArabList, listResidualDiagnostics } from '../../poll-tracker-app/src/lib/mediaBiasAnalysis'
import { residualDiagnosticsToCsv } from '../src/utils/exportResidualDiagnosticsCsv'
import { mergeYeshAtidIntoBennettParty } from '../src/utils/mergeYeshAtidIntoBennettParty'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

loadEnv({ path: join(ROOT, '.env') })

const DEFAULT_SPREADSHEET_ID = '1RIqzrv_ViVWBqeXkM-rOAvusoXryyRFX5Xmu2S-uEw4'

function a1RangeForApi(tab: string, cellRange: string): string {
  const escaped = tab.replace(/'/g, "''")
  return `'${escaped}'!${cellRange}`
}

async function fetchSheetValues(
  tab: string,
  apiKey: string,
  spreadsheetId: string,
): Promise<string[][]> {
  const rangePath = encodeURIComponent(a1RangeForApi(tab, 'A:Z'))
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${rangePath}?key=${encodeURIComponent(apiKey)}`
  const referer =
    process.env.GOOGLE_SHEETS_REFERRER?.trim() || 'http://localhost:5173/'
  const res = await fetch(url, { headers: { Referer: referer } })
  if (!res.ok) throw new Error(`Google Sheets API ${res.status}: ${await res.text()}`)
  const data = (await res.json()) as { values?: string[][] }
  return data.values ?? []
}

function rowsToObjects(rows: string[][]): Record<string, string>[] {
  if (!rows.length) return []
  const [header, ...data] = rows
  if (!header?.length) return []
  return data.map(row => Object.fromEntries(header.map((key, i) => [key, row[i] ?? ''])))
}

function parseUnpivot(rows: string[][]): UnpivotRow[] {
  return rowsToObjects(rows)
    .map(row => ({
      pollId: Number(row['Poll ID']),
      date: row['Date'],
      respondents: Number(row['Respondents']),
      mediaOutlet: row['Media Outlet'],
      pollster: row['Pollster'],
      mediaIndex: Number(row['Media Index']),
      party: row['Party'],
      votes: Number(row['Votes']),
      votesRank: Number(row['Votes_Rank']),
    }))
    .filter(r => r.date && Number.isFinite(r.votes))
}

function filterLikePanel(
  harmonized: UnpivotRow[],
  totalPollsMin: number,
  excludedOutlets: Set<string>,
): UnpivotRow[] {
  const pollsPerOutlet = new Map<string, Set<number>>()
  for (const r of harmonized) {
    if (!pollsPerOutlet.has(r.mediaOutlet)) pollsPerOutlet.set(r.mediaOutlet, new Set())
    pollsPerOutlet.get(r.mediaOutlet)!.add(r.pollId)
  }
  return harmonized.filter(r => {
    if ((pollsPerOutlet.get(r.mediaOutlet)?.size ?? 0) < totalPollsMin) return false
    if (excludedOutlets.has(r.mediaOutlet)) return false
    return true
  })
}

function argNumber(flag: string, fallback: number): number {
  const i = process.argv.indexOf(flag)
  if (i === -1 || !process.argv[i + 1]) return fallback
  const n = Number(process.argv[i + 1])
  return Number.isFinite(n) ? n : fallback
}

async function main(): Promise<void> {
  const apiKey = process.env.VITE_GOOGLE_SHEETS_API_KEY?.trim()
  if (!apiKey) {
    console.error('Missing VITE_GOOGLE_SHEETS_API_KEY in media-bias-app/.env')
    process.exit(1)
  }
  const spreadsheetId =
    process.env.VITE_GOOGLE_SHEETS_SPREADSHEET_ID?.trim() || DEFAULT_SPREADSHEET_ID

  const splitArabs = process.argv.includes('--split-arabs')
  const combine = !splitArabs
  const windowDays = argNumber('--window', 30)
  const totalPollsMin = argNumber('--min-polls', 5)

  console.error(`Fetching UnpivotData… window=${windowDays} minPolls=${totalPollsMin}`)
  const rows = await fetchSheetValues('UnpivotData', apiKey, spreadsheetId)
  const unpivot = parseUnpivot(rows)
  const harmonized = mergeYeshAtidIntoBennettParty(harmonizeArabList(unpivot, { combine }))
  const filtered = filterLikePanel(harmonized, totalPollsMin, new Set())

  const diagnostics = listResidualDiagnostics(filtered, windowDays)
  const csv = residualDiagnosticsToCsv(diagnostics)
  const outPath = join(ROOT, 'residual-diagnostics-export.csv')
  writeFileSync(outPath, `\ufeff${csv}`, 'utf8')

  const included = diagnostics.filter(d => d.status === 'included').length
  const skipped = diagnostics.length - included
  console.error(
    `Wrote ${diagnostics.length} rows (${included} included, ${skipped} skipped) → ${outPath}`,
  )
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
