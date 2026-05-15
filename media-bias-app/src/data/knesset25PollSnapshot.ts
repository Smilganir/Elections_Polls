import type { UnpivotRow } from '@shared/types/data'
import { harmonizeArabList } from '@shared/lib/mediaBiasAnalysis'
import { mergeYeshAtidIntoBennettParty } from '../utils/mergeYeshAtidIntoBennettParty'
import knesset25UnpivotCsv from '../../../data/elections-polls-knesset25-unpivot.csv?raw'

/** Outlets shown on the Knesset 25 focused heatmap (themadad snapshot). */
export const KNESSET25_FOCUS_OUTLETS = [
  'חדשות 12',
  'חדשות 13',
  'מעריב',
  'כאן חדשות',
  'ערוץ 14',
] as const

/** Parties shown on the Knesset 25 focused heatmap (English keys = sheet schema). */
export const KNESSET25_FOCUS_PARTIES = ['Likud', 'Blue & White', 'Yesh Atid'] as const

function parseUnpivotCsv(text: string): UnpivotRow[] {
  // Sheet exports often include UTF-8 BOM — without stripping, the first header is "\ufeffPoll ID"
  // and column lookup fails, yielding zero rows.
  const raw = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const lines = raw.split(/\r?\n/).filter(line => line.length > 0)
  if (lines.length < 2) return []
  const header = lines[0]!.split(',')
  const col = (name: string) => header.indexOf(name)
  const iPoll = col('Poll ID')
  const iDate = col('Date')
  const iResp = col('Respondents')
  const iOutlet = col('Media Outlet')
  const iPollster = col('Pollster')
  const iIdx = col('Media Index')
  const iParty = col('Party')
  const iVotes = col('Votes')
  const iRank = col('Votes_Rank')
  if (
    [iPoll, iDate, iResp, iOutlet, iPollster, iIdx, iParty, iVotes, iRank].some(i => i < 0)
  ) {
    return []
  }
  const out: UnpivotRow[] = []
  for (let r = 1; r < lines.length; r++) {
    const row = lines[r]!.split(',')
    const date = row[iDate] ?? ''
    const votes = Number(row[iVotes])
    if (!date || !Number.isFinite(votes)) continue
    out.push({
      pollId: Number(row[iPoll]),
      date,
      respondents: Number(row[iResp]),
      mediaOutlet: row[iOutlet] ?? '',
      pollster: row[iPollster] ?? '',
      mediaIndex: Number(row[iIdx]),
      party: row[iParty] ?? '',
      votes,
      votesRank: Number(row[iRank]),
    })
  }
  return out
}

/**
 * Harmonized unpivot rows for the bundled Knesset 25 static sheet.
 *
 * @param mergeYeshAtidIntoBennett — When `true` (default), matches the main media-bias panel (Yesh Atid +
 *   Bennett's Party → one Yahad line). When `false`, keeps **Yesh Atid** as its own party so focused
 *   heatmaps that list Yesh Atid still get residuals.
 */
export function buildKnesset25Harmonized(
  combineArabs: boolean,
  mergeYeshAtidIntoBennett = true,
): UnpivotRow[] {
  const unpivot = parseUnpivotCsv(knesset25UnpivotCsv)
  const harmonized = harmonizeArabList(unpivot, { combine: combineArabs })
  return mergeYeshAtidIntoBennett ? mergeYeshAtidIntoBennettParty(harmonized) : harmonized
}
