import { useCallback, useEffect, useState } from 'react'
import { fetchSheet } from '../services/sheetsApi'
import type { EventRow, MajorEventRow, PartyDimRow, Segment, UnpivotRow } from '../types/data'

function rowsToObjects(rows: string[][]): Record<string, string>[] {
  if (!rows.length) return []
  const [header, ...data] = rows
  if (!header?.length) return []
  return data.map((row) =>
    Object.fromEntries(header.map((key, index) => [key, row[index] ?? ''])),
  )
}

function parseSegment(raw: string): Segment {
  const trimmed = raw.trim()
  if (trimmed === 'Coalition') return 'Coalition'
  if (trimmed === 'Arabs') return 'Arabs'
  return 'Opposition'
}

const DEFAULT_POLL_INTERVAL_MS = 3 * 60 * 1000

function sheetsPollIntervalMs(): number {
  const raw = import.meta.env.VITE_SHEETS_POLL_INTERVAL_MS
  if (raw === undefined || raw === '') return DEFAULT_POLL_INTERVAL_MS
  const n = Number(raw)
  return Number.isFinite(n) && n >= 30_000 ? n : DEFAULT_POLL_INTERVAL_MS
}

type DashboardDataState = {
  unpivot: UnpivotRow[]
  events: EventRow[]
  majorEvents: MajorEventRow[]
  partiesDim: PartyDimRow[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useDashboardData(): DashboardDataState {
  const [unpivot, setUnpivot] = useState<UnpivotRow[]>([])
  const [events, setEvents] = useState<EventRow[]>([])
  const [majorEvents, setMajorEvents] = useState<MajorEventRow[]>([])
  const [partiesDim, setPartiesDim] = useState<PartyDimRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const [unpivotData, eventsData, partiesDimData] = await Promise.all([
        fetchSheet('UnpivotData'),
        fetchSheet('Events Dates per Media Outlet'),
        fetchSheet('Parties Dim'),
      ])

      let majorEventsRows: string[][] = []
      try {
        const majorRes = await fetchSheet('Major Events Dim')
        majorEventsRows = majorRes.rows
      } catch {
        /* optional tab — page still works without Hebrew labels / categories */
      }

      const unpivotObjects = rowsToObjects(unpivotData.rows)
      const eventObjects = rowsToObjects(eventsData.rows)
      const partiesDimObjects = rowsToObjects(partiesDimData.rows)
      const majorEventsObjects = rowsToObjects(majorEventsRows)

      const nextUnpivot: UnpivotRow[] = unpivotObjects
        .map((row) => ({
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
        .filter((row) => row.date && Number.isFinite(row.votes))

      const outletCell = (row: Record<string, string>) =>
        (row['Media Outlet'] ?? '').trim()

      const nextEvents: EventRow[] = eventObjects
        .map((row) => {
          const mo = outletCell(row)
          return {
            date: row['Event Date (Major Events Dim)'],
            eventName: row['Event Name (Major Events Dim)'],
            mediaOutlet: mo,
            mediaOutletSheet: mo,
            party: row['Party'] ?? '',
          }
        })
        .filter((row) => row.date && row.eventName)

      const nextPartiesDim: PartyDimRow[] = partiesDimObjects.map((row) => ({
        party: row['Party'] ?? '',
        partyHeb: row['Party_heb'] ?? '',
        segment: parseSegment(row['Segment'] ?? ''),
        partyId: Number(row['Party ID']) || 0,
        imageUrl: row['Image URL'] ?? '',
      }))

      const nextMajorEvents: MajorEventRow[] = Array.from(
        new Map(
          majorEventsObjects
            .filter((row) => row['Event Name'] && row['Event Date'] && row['Event Line'] === 'Start')
            .map((row) => [row['Event Name'], {
              eventName: row['Event Name'],
              eventNameHe: (row['Event He'] ?? '').trim(),
              date: row['Event Date'],
              category: row['Category'] ?? '',
            }]),
        ).values(),
      )

      setUnpivot(nextUnpivot)
      setEvents(nextEvents)
      setMajorEvents(nextMajorEvents)
      setPartiesDim(nextPartiesDim)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed loading data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()

    const intervalMs = sheetsPollIntervalMs()
    const interval = window.setInterval(() => void refresh(), intervalMs)

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [refresh])

  return { unpivot, events, majorEvents, partiesDim, loading, error, refresh }
}
