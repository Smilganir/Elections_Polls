import { useEffect, useRef, useState } from 'react'
import { fetchSheet } from '@shared/services/sheetsApi'
import type { UnpivotRow, PartyDimRow, MediaOutletDimRow, Segment } from '@shared/types/data'
import type { HistoricalAccuracyResult } from '@shared/types/data'
import {
  harmonizeArabList,
  computeHistoricalAccuracy,
} from '@shared/lib/mediaBiasAnalysis'
import {
  knesset2022FinalPolls,
  parseKnesset25ResultsSheet,
  KNESSET_25_RESULTS_SHEET_TABS,
} from '@shared/lib/historicalPolls2022'
import { mergeYeshAtidIntoBennettParty } from '../utils/mergeYeshAtidIntoBennettParty'

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchKnesset25ResultsSheet(): Promise<string[][] | null> {
  for (const tab of KNESSET_25_RESULTS_SHEET_TABS) {
    try {
      const res = await fetchSheet(tab, 'A:ZZ')
      return res.rows
    } catch {
      /* try alternate tab spelling */
    }
  }
  return null
}

// ─── Row parsers (mirror useDashboardData logic) ─────────────────────────────

function rowsToObjects(rows: string[][]): Record<string, string>[] {
  if (!rows.length) return []
  const [header, ...data] = rows
  if (!header?.length) return []
  return data.map(row => Object.fromEntries(header.map((key, i) => [key, row[i] ?? ''])))
}

function parseSegment(raw: string): Segment {
  const t = raw.trim()
  if (t === 'Coalition') return 'Coalition'
  if (t === 'Arabs') return 'Arabs'
  return 'Opposition'
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
    segment: parseSegment(row['Segment'] ?? ''),
    partyId: Number(row['Party ID']) || 0,
    imageUrl: row['Image URL'] ?? '',
  }))
}

function parseMediaOutletsDim(rows: string[][]): MediaOutletDimRow[] {
  return rowsToObjects(rows)
    .filter(row => (row['Media Outlet'] ?? '').trim())
    .map(row => ({
      mediaOutlet: (row['Media Outlet'] ?? '').trim(),
      enMediaOutlet: (row['English Media Outlet'] ?? row['Media Outlet EN'] ?? '').trim(),
      shortDescription: (row['Short Description'] ?? '').trim(),
      biasNote: (row['Political / Bias Note'] ?? row['Bias Note'] ?? '').trim(),
    }))
}

// ─── Types ────────────────────────────────────────────────────────────────────

type RawSheetData = {
  unpivot: UnpivotRow[]
  partiesDim: PartyDimRow[]
  mediaOutletsDim: MediaOutletDimRow[]
  /** Merged static + `Kneset 25 Results` sheet (when available) for 2022 gauge + track record */
  knessetFinalPolls: Record<string, Record<string, number>>
}

export type MediaBiasData = {
  /**
   * Harmonized raw poll rows (Arab-list merge applied).
   * Baseline / residual computation happens in MediaBiasPanel so that the
   * totalPollsMin filter and windowDays UI controls both feed into it
   * without requiring a network round-trip.
   */
  harmonized: UnpivotRow[]
  /** 2022 accuracy keyed by outlet (Hebrew) name. */
  accuracy: Record<string, HistoricalAccuracyResult>
  partiesDim: PartyDimRow[]
  mediaOutletsDim: MediaOutletDimRow[]
}

type State = {
  data: MediaBiasData | null
  loading: boolean
  error: string | null
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Fetches the three required sheets once (network, cached in a ref), then
 * re-harmonizes when `combineArabs` changes.
 *
 * Baseline / residual computation is intentionally left to MediaBiasPanel so
 * that the `totalPollsMin` outlet filter (UI state) and `windowDays` both feed
 * into the LOO baseline calculation without needing a network round-trip.
 */
export function useMediaBiasData(combineArabs = true): State {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null })
  const rawRef = useRef<RawSheetData | null>(null)

  useEffect(() => {
    let cancelled = false

    async function run() {
      // Phase 1: fetch sheets (network — only runs once, then uses the ref cache).
      if (!rawRef.current) {
        setState(s => ({ ...s, loading: true, error: null }))
        try {
          const [unpivotRes, partiesRes, outletsRes, knessetRows] = await Promise.all([
            fetchSheet('UnpivotData'),
            fetchSheet('Parties Dim'),
            fetchSheet('Media Outlets Dim'),
            fetchKnesset25ResultsSheet(),
          ])
          const sheetPolls = parseKnesset25ResultsSheet(knessetRows ?? [])
          const knessetFinalPolls =
            Object.keys(sheetPolls).length > 0
              ? { ...knesset2022FinalPolls, ...sheetPolls }
              : knesset2022FinalPolls
          rawRef.current = {
            unpivot: parseUnpivot(unpivotRes.rows),
            partiesDim: parsePartiesDim(partiesRes.rows),
            mediaOutletsDim: parseMediaOutletsDim(outletsRes.rows),
            knessetFinalPolls,
          }
        } catch (err) {
          if (!cancelled) {
            setState({
              data: null,
              loading: false,
              error: err instanceof Error ? err.message : 'Failed to load sheet data',
            })
          }
          return
        }
      }

      if (cancelled || !rawRef.current) return

      // Phase 2: harmonize (pure, cheap — no network).
      const raw = rawRef.current
      const harmonized = mergeYeshAtidIntoBennettParty(
        harmonizeArabList(raw.unpivot, { combine: combineArabs }),
      )

      // Pre-compute 2022 accuracy for all outlets present in the sheet data.
      const allOutlets = [...new Set(raw.unpivot.map(r => r.mediaOutlet))]
      const accuracy: Record<string, HistoricalAccuracyResult> = {}
      for (const outlet of allOutlets) {
        accuracy[outlet] = computeHistoricalAccuracy(outlet, raw.knessetFinalPolls)
      }

      if (!cancelled) {
        setState({
          data: { harmonized, accuracy, partiesDim: raw.partiesDim, mediaOutletsDim: raw.mediaOutletsDim },
          loading: false,
          error: null,
        })
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [combineArabs])

  return state
}
