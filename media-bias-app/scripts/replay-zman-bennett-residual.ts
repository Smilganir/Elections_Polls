/**
 * Digit replay: fetch live UnpivotData + Parties Dim, mirror MediaBiasPanel LOO pipeline,
 * print Bennett merged line ("Bennett's Party") × זמן ישראל mean raw residual with vs without חדשות 12.
 *
 * Usage: npx tsx scripts/replay-zman-bennett-residual.ts [--window 30] [--min-polls 5]
 */
import { config as loadEnv } from 'dotenv'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { PartyDimRow, ResidualRow, UnpivotRow } from '../../poll-tracker-app/src/types/data'
import {
  computeHouseEffects,
  computeResiduals,
  harmonizeArabList,
} from '../../poll-tracker-app/src/lib/mediaBiasAnalysis'
import { mergeYeshAtidIntoBennettParty } from '../src/utils/mergeYeshAtidIntoBennettParty'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

loadEnv({ path: join(ROOT, '.env'), quiet: true })

const DEFAULT_SPREADSHEET_ID = '1RIqzrv_ViVWBqeXkM-rOAvusoXryyRFX5Xmu2S-uEw4'
const PARTY_KEY = "Bennett's Party"
const ZMAN_SHEET = 'זמן ישראל'
const N12_SHEET = 'חדשות 12'

function a1RangeForApi(tab: string, cellRange: string): string {
  const escaped = tab.replace(/'/g, "''")
  return `'${escaped}'!${cellRange}`
}

async function fetchSheetValues(
  tab: string,
  apiKey: string,
  spreadsheetId: string,
): Promise<string[][]> {
  const rangePath = encodeURIComponent(a1RangeForApi(tab, 'A:ZZ'))
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${rangePath}?key=${encodeURIComponent(apiKey)}`
  const referer = process.env.GOOGLE_SHEETS_REFERRER?.trim() || 'http://localhost:5173/'
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

function parsePartiesDim(rows: string[][]): PartyDimRow[] {
  return rowsToObjects(rows).map(row => ({
    party: row['Party'] ?? '',
    partyHeb: row['Party_heb'] ?? '',
    segment:
      row['Segment']?.trim() === 'Coalition'
        ? 'Coalition'
        : row['Segment']?.trim() === 'Arabs'
          ? 'Arabs'
          : 'Opposition',
    partyId: Number(row['Party ID']) || 0,
    imageUrl: row['Image URL'] ?? '',
  }))
}

function pollsPerOutletFrom(harmonized: UnpivotRow[]): Map<string, Set<number>> {
  const pollsPerOutlet = new Map<string, Set<number>>()
  for (const r of harmonized) {
    if (!pollsPerOutlet.has(r.mediaOutlet)) pollsPerOutlet.set(r.mediaOutlet, new Set())
    pollsPerOutlet.get(r.mediaOutlet)!.add(r.pollId)
  }
  return pollsPerOutlet
}

function filterLikePanel(
  harmonized: UnpivotRow[],
  totalPollsMin: number,
  excludedOutlets: Set<string>,
): UnpivotRow[] {
  const pollsPerOutlet = pollsPerOutletFrom(harmonized)
  return harmonized.filter(r => {
    if ((pollsPerOutlet.get(r.mediaOutlet)?.size ?? 0) < totalPollsMin) return false
    if (excludedOutlets.has(r.mediaOutlet)) return false
    return true
  })
}

/** Exclude every ≥minPolls outlet not in `allow` — matches “only these columns checked” in the panel. */
function exclusionsKeepingAllowlist(
  harmonized: UnpivotRow[],
  totalPollsMin: number,
  allow: Set<string>,
): Set<string> {
  const pollsPerOutlet = pollsPerOutletFrom(harmonized)
  const excluded = new Set<string>()
  for (const [outlet, ids] of pollsPerOutlet) {
    if (ids.size >= totalPollsMin && !allow.has(outlet)) excluded.add(outlet)
  }
  return excluded
}

function argNumber(flag: string, fallback: number): number {
  const i = process.argv.indexOf(flag)
  if (i === -1 || !process.argv[i + 1]) return fallback
  const n = Number(process.argv[i + 1])
  return Number.isFinite(n) ? n : fallback
}

function cellMeanRaw(
  residualsReturn: ReturnType<typeof computeResiduals>,
  partiesDim: PartyDimRow[],
  outlet: string,
  party: string,
  fdrMinN: number,
): { meanRawResid: number; n: number } {
  const cells = computeHouseEffects(residualsReturn, partiesDim, { minN: fdrMinN })
  const c = cells.find(x => x.outlet === outlet && x.party === party)
  return { meanRawResid: c?.meanRawResid ?? NaN, n: c?.n ?? 0 }
}

/** Heatmap math: mean over polls of (votes − LOO baseline). */
function zmanBennettBreakdown(residuals: ResidualRow[]): {
  n: number
  sumVotes: number
  sumBaseline: number
  meanVotes: number
  meanBaseline: number
  meanRawResidual: number
  /** Sorted by date, then pollId */
  polls: { pollId: number; date: string; votes: number; LOO_baseline: number; rawResidual: number }[]
} {
  const rows = residuals
    .filter(r => r.mediaOutlet === ZMAN_SHEET && r.party === PARTY_KEY)
    .sort((a, b) => {
      const d = a.date.localeCompare(b.date)
      return d !== 0 ? d : a.pollId - b.pollId
    })
  const n = rows.length
  const sumVotes = rows.reduce((s, r) => s + r.votes, 0)
  const sumBaseline = rows.reduce((s, r) => s + r.baseline, 0)
  const meanVotes = n ? sumVotes / n : NaN
  const meanBaseline = n ? sumBaseline / n : NaN
  const meanRawResidual = n ? rows.reduce((s, r) => s + r.rawResidual, 0) / n : NaN
  return {
    n,
    sumVotes,
    sumBaseline,
    meanVotes,
    meanBaseline,
    meanRawResidual,
    polls: rows.map(r => ({
      pollId: r.pollId,
      date: r.date,
      votes: r.votes,
      LOO_baseline: round3(r.baseline),
      rawResidual: round3(r.rawResidual),
    })),
  }
}

async function main(): Promise<void> {
  const apiKey = process.env.VITE_GOOGLE_SHEETS_API_KEY?.trim()
  if (!apiKey) {
    console.error('Missing VITE_GOOGLE_SHEETS_API_KEY in media-bias-app/.env')
    process.exit(1)
  }
  const spreadsheetId =
    process.env.VITE_GOOGLE_SHEETS_SPREADSHEET_ID?.trim() || DEFAULT_SPREADSHEET_ID

  const windowDays = argNumber('--window', 30)
  const totalPollsMin = argNumber('--min-polls', 5)
  const fdrMinN = argNumber('--fdr-min', 10)

  const [unpivotRows, partiesRows] = await Promise.all([
    fetchSheetValues('UnpivotData', apiKey, spreadsheetId),
    fetchSheetValues('Parties Dim', apiKey, spreadsheetId),
  ])

  const harmonized = mergeYeshAtidIntoBennettParty(harmonizeArabList(parseUnpivot(unpivotRows), { combine: true }))
  const partiesDim = parsePartiesDim(partiesRows)

  const withoutN12 = filterLikePanel(harmonized, totalPollsMin, new Set([N12_SHEET]))
  const withN12 = filterLikePanel(harmonized, totalPollsMin, new Set())

  const resWo = computeResiduals(withoutN12, windowDays)
  const resWi = computeResiduals(withN12, windowDays)

  const zmanWo = resWo.filter(r => r.mediaOutlet === ZMAN_SHEET && r.party === PARTY_KEY)
  const zmanWi = resWi.filter(r => r.mediaOutlet === ZMAN_SHEET && r.party === PARTY_KEY)

  const cellWo = cellMeanRaw(resWo, partiesDim, ZMAN_SHEET, PARTY_KEY, fdrMinN)
  const cellWi = cellMeanRaw(resWi, partiesDim, ZMAN_SHEET, PARTY_KEY, fdrMinN)

  const avgVotesWo = zmanWo.length ? zmanWo.reduce((s, r) => s + r.votes, 0) / zmanWo.length : NaN
  const avgVotesWi = zmanWi.length ? zmanWi.reduce((s, r) => s + r.votes, 0) / zmanWi.length : NaN
  const avgBaseWo = zmanWo.length ? zmanWo.reduce((s, r) => s + r.baseline, 0) / zmanWo.length : NaN
  const avgBaseWi = zmanWi.length ? zmanWi.reduce((s, r) => s + r.baseline, 0) / zmanWi.length : NaN

  /** Columns visible in your screenshots (sheet Hebrew keys — see ENGLISH_MEDIA_NAMES). */
  const screenshotPeersNoN12 = new Set<string>([
    ZMAN_SHEET,
    'ערוץ 14',
    'כאן חדשות',
    'ישראל היום',
    'i24 news',
  ])
  const screenshotPeersWithN12 = new Set<string>([...screenshotPeersNoN12, N12_SHEET])

  const exNoN12 = exclusionsKeepingAllowlist(harmonized, totalPollsMin, screenshotPeersNoN12)
  const exWithN12 = exclusionsKeepingAllowlist(harmonized, totalPollsMin, screenshotPeersWithN12)

  const filtShotNoN12 = filterLikePanel(harmonized, totalPollsMin, exNoN12)
  const filtShotWithN12 = filterLikePanel(harmonized, totalPollsMin, exWithN12)

  const resShotWo = computeResiduals(filtShotNoN12, windowDays)
  const resShotWi = computeResiduals(filtShotWithN12, windowDays)

  const cellShotWo = cellMeanRaw(resShotWo, partiesDim, ZMAN_SHEET, PARTY_KEY, fdrMinN)
  const cellShotWi = cellMeanRaw(resShotWi, partiesDim, ZMAN_SHEET, PARTY_KEY, fdrMinN)

  const breakdown5 = zmanBennettBreakdown(resShotWo)
  const breakdown6 = zmanBennettBreakdown(resShotWi)

  const pollsPerOutlet = pollsPerOutletFrom(harmonized)
  const outletsMeetingMin = [...pollsPerOutlet.entries()]
    .filter(([, s]) => s.size >= totalPollsMin)
    .map(([o]) => o)
    .sort()

  const report = {
    spreadsheetId,
    windowDays,
    totalPollsMin,
    fdrMinN,
    outlets_meeting_min_polls_count: outletsMeetingMin.length,
    outlets_meeting_min_polls_list: outletsMeetingMin,
    scenario_toggle_only_N12_else_all_eligible: {
      party: PARTY_KEY,
      outlet: ZMAN_SHEET,
      note: 'Excluded only חדשות 12 vs nobody excluded (all outlets ≥ min polls remain).',
      heatmap_meanRawResidual_excludeN12: round1(cellWo.meanRawResid),
      heatmap_meanRawResidual_includeN12: round1(cellWi.meanRawResid),
      delta_meanRawResidual: round1(cellWi.meanRawResid - cellWo.meanRawResid),
      poll_rows_Zman: cellWo.n,
      row_avg_votes_excludeN12: round2(avgVotesWo),
      row_avg_votes_includeN12: round2(avgVotesWi),
      row_avg_LOO_baseline_excludeN12: round2(avgBaseWo),
      row_avg_LOO_baseline_includeN12: round2(avgBaseWi),
      identity_residual_equals_votes_minus_baseline_excludeN12: round2(avgVotesWo - avgBaseWo),
      identity_residual_equals_votes_minus_baseline_includeN12: round2(avgVotesWi - avgBaseWi),
    },
    scenario_screenshot_allowlists_only_these_columns_checked: {
      allowlist_without_N12: [...screenshotPeersNoN12].sort(),
      allowlist_with_N12: [...screenshotPeersWithN12].sort(),
      excluded_outlets_without_N12: [...exNoN12].sort(),
      excluded_outlets_with_N12: [...exWithN12].sort(),
      excluded_outlet_count_without_N12: exNoN12.size,
      excluded_outlet_count_with_N12: exWithN12.size,
      heatmap_meanRawResidual_5_columns: round1(cellShotWo.meanRawResid),
      heatmap_meanRawResidual_6_columns_includes_N12: round1(cellShotWi.meanRawResid),
      delta_meanRawResidual: round1(cellShotWi.meanRawResid - cellShotWo.meanRawResid),
      poll_rows_Zman_5_col: cellShotWo.n,
      poll_rows_Zman_6_col: cellShotWi.n,
      screenshot_1_formula_Zman_Bennett_cell:
        'mean over Zman Yahad-merge polls of (votes − LOO baseline), LOO = rolling cross-outlet mean of peers in checked columns only (same party, dates in baseline window), excluding Zman from its own baseline',
      screenshot_1_aggregate_numbers: {
        N_polls: breakdown5.n,
        sum_votes: breakdown5.sumVotes,
        sum_LOO_baseline: round3(breakdown5.sumBaseline),
        mean_votes: round3(breakdown5.meanVotes),
        mean_LOO_baseline: round3(breakdown5.meanBaseline),
        mean_raw_residual_displayed_in_cell: round1(breakdown5.meanRawResidual),
        verify_mean_equals_meanVotes_minus_meanBaseline: round3(
          breakdown5.meanVotes - breakdown5.meanBaseline,
        ),
      },
      screenshot_1_per_poll_table: breakdown5.polls,
      screenshot_2_aggregate_numbers: {
        N_polls: breakdown6.n,
        sum_votes: breakdown6.sumVotes,
        sum_LOO_baseline: round3(breakdown6.sumBaseline),
        mean_votes: round3(breakdown6.meanVotes),
        mean_LOO_baseline: round3(breakdown6.meanBaseline),
        mean_raw_residual_displayed_in_cell: round1(breakdown6.meanRawResidual),
        verify_mean_equals_meanVotes_minus_meanBaseline: round3(
          breakdown6.meanVotes - breakdown6.meanBaseline,
        ),
      },
      screenshot_2_per_poll_table: breakdown6.polls,
    },
  }

  const outPath = join(ROOT, '..', 'replay-zman-screenshots-detail.json')
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.error(`Wrote ${outPath}`)
}

function round1(x: number): number {
  return Math.round(x * 10) / 10
}
function round2(x: number): number {
  return Math.round(x * 100) / 100
}
function round3(x: number): number {
  return Math.round(x * 1000) / 1000
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
