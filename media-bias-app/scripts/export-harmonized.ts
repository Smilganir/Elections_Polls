/**
 * CLI: fetch UnpivotData, apply harmonizeArabList, write UTF-8 BOM CSV.
 * Requires VITE_GOOGLE_SHEETS_API_KEY in media-bias-app/.env (same as the app).
 * Usage: npm run export-harmonized [--] [--split-arabs]
 */
import { config as loadEnv } from 'dotenv'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { UnpivotRow } from '../../poll-tracker-app/src/types/data'
import { harmonizeArabList } from '../../poll-tracker-app/src/lib/mediaBiasAnalysis'
import { harmonizedRowsToCsv } from '../src/utils/exportHarmonizedCsv'
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
  // Keys restricted by HTTP referrer reject Node’s empty Referer (same as browser + unsafe-url).
  const referer =
    process.env.GOOGLE_SHEETS_REFERRER?.trim() || 'http://localhost:5173/'
  const res = await fetch(url, { headers: { Referer: referer } })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google Sheets API ${res.status}: ${text}`)
  }
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

  console.error(`Fetching UnpivotData… (spreadsheet ${spreadsheetId.slice(0, 8)}…)`)
  const rows = await fetchSheetValues('UnpivotData', apiKey, spreadsheetId)
  const unpivot = parseUnpivot(rows)
  const harmonized = mergeYeshAtidIntoBennettParty(harmonizeArabList(unpivot, { combine }))

  const outPath = join(ROOT, combine ? 'harmonized-export.csv' : 'harmonized-export-split-arabs.csv')
  const csv = harmonizedRowsToCsv(harmonized)
  writeFileSync(outPath, `\ufeff${csv}`, 'utf8')

  console.error(`Wrote ${harmonized.length} rows → ${outPath}`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
