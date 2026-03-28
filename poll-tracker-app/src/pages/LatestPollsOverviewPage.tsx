import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import dayjs from 'dayjs'
import {
  ENGLISH_MEDIA_NAMES,
  EVENT_CATEGORY_COLORS,
  isMajorEventExcludedFromDisplay,
  maxEventLabelsForViewportWidth,
  MEDIA_ICON_MAP,
  PARTY_ICON_MAP,
  formatEventLabelForDisplay,
  selectEventsForViewportDisplay,
  SEGMENT_COLORS,
} from '../config/mappings'
import { useDashboardData } from '../hooks/useDashboardData'
import type { MajorEventRow, PartyDimRow, Segment } from '../types/data'
import { IconWithFallback } from '../ui/IconWithFallback'
import { useLocale } from '../i18n/useLocale'
import { UI } from '../i18n/strings'
import { publicUrl } from '../utils/publicUrl'

type PollColumn = {
  pollId: number
  date: string
  mediaOutlet: string
  respondents: number
  parties: {
    party: string
    votes: number
    segment: Segment
    partyId: number
  }[]
  coalitionTotal: number
  oppositionTotal: number
  arabsTotal: number
}

type PreviousPollMap = Map<string, Map<string, number>>

function Sparkline({ data, eventDates, color, globalMinT, globalMaxT, seatsLabel }: {
  data: { date: string; votes: number }[]
  eventDates: string[]
  color: string
  globalMinT?: number
  globalMaxT?: number
  seatsLabel: string
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<{ idx: number; x: number; y: number } | null>(null)

  const W = 200, H = 30
  const pad = { t: 2, b: 2, l: 0, r: 0 }
  const cw = W
  const ch = H - pad.t - pad.b

  const ts = useMemo(() => data.map(d => new Date(d.date).getTime()), [data])
  const minT = globalMinT ?? ts[0]
  const maxT = globalMaxT ?? ts[ts.length - 1]
  const rangeT = maxT - minT || 1

  const vals = useMemo(() => data.map(d => d.votes), [data])
  const minV = Math.min(...vals)
  const maxV = Math.max(...vals)
  const vPad = 1
  const fullRange = (maxV + vPad) - (minV - vPad) || 1
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length

  const toX = useCallback((t: number) => pad.l + ((t - minT) / rangeT) * cw, [minT, rangeT, cw])
  const toY = (v: number) => pad.t + ch - ((v - (minV - vPad)) / fullRange) * ch

  const pathD = useMemo(() => {
    let d = ''
    for (let i = 0; i < data.length; i++) {
      const px = toX(ts[i])
      const py = toY(vals[i])
      d += i === 0 ? `M${px},${py}` : `H${px}V${py}`
    }
    return d
  }, [data, ts, vals, toX])

  const evXs = useMemo(() =>
    eventDates
      .map(ed => new Date(ed).getTime())
      .filter(t => t >= minT && t <= maxT)
      .map(t => toX(t)),
    [eventDates, minT, maxT, toX],
  )

  const avgY = toY(avg)
  const lastX = toX(maxT)
  const lastY = toY(vals[vals.length - 1])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const pxX = e.clientX - rect.left
    const ratio = pxX / rect.width
    const cursorT = minT + ratio * rangeT
    let best = 0
    let bestDist = Infinity
    for (let i = 0; i < ts.length; i++) {
      const dist = Math.abs(ts[i] - cursorT)
      if (dist < bestDist) { bestDist = dist; best = i }
    }
    setHover({ idx: best, x: e.clientX, y: e.clientY })
  }, [ts, minT, rangeT])

  const handleMouseLeave = useCallback(() => setHover(null), [])

  if (data.length < 2) return null

  const hoverPoint = hover !== null ? {
    vx: toX(ts[hover.idx]),
    vy: toY(vals[hover.idx]),
  } : null

  return (
    <div
      ref={wrapRef}
      className="lpo-sparkline-wrap"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="lpo-sparkline-svg">
        <line x1={pad.l} y1={avgY} x2={W - pad.r} y2={avgY}
          stroke="rgba(255,255,255,0.15)" strokeWidth={0.5} strokeDasharray="3,2"
          vectorEffect="non-scaling-stroke" />
        {evXs.map((ex, i) => (
          <line key={i} x1={ex} y1={pad.t} x2={ex} y2={H - pad.b}
            stroke="rgba(255,255,255,0.12)" strokeWidth={0.8} strokeDasharray="2,2"
            vectorEffect="non-scaling-stroke" />
        ))}
        <path d={pathD} fill="none" stroke={color} strokeWidth={1}
          vectorEffect="non-scaling-stroke" />
        <circle cx={lastX} cy={lastY} r={0.1} fill="none" stroke={color}
          strokeWidth={3} vectorEffect="non-scaling-stroke" />
        {hoverPoint && (
          <>
            <line x1={hoverPoint.vx} y1={pad.t} x2={hoverPoint.vx} y2={H - pad.b}
              stroke="rgba(255,255,255,0.35)" strokeWidth={0.8}
              vectorEffect="non-scaling-stroke" />
            <circle cx={hoverPoint.vx} cy={hoverPoint.vy} r={0.1} fill="none" stroke="#fff"
              strokeWidth={3.5} vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
      {hover !== null && (
        <div
          className="lpo-sparkline-tooltip"
          style={{ left: hover.x, top: hover.y }}
        >
          <strong>{data[hover.idx].votes}</strong> {seatsLabel}
          <span className="lpo-sparkline-tooltip-date">
            {dayjs(data[hover.idx].date).format('MMM D, YYYY')}
          </span>
        </div>
      )}
    </div>
  )
}

export function LatestPollsOverviewPage() {
  const { locale, setLocale } = useLocale()
  const t = UI[locale]
  const { unpivot, events, majorEvents, partiesDim, loading, error } = useDashboardData()
  const [pageIndex, setPageIndex] = useState(0)

  useEffect(() => {
    let cancelled = false
    if (locale === 'he') {
      void import('dayjs/locale/he')
        .then(() => {
          if (!cancelled) dayjs.locale('he')
        })
        .catch(() => {
          if (!cancelled) dayjs.locale('en')
        })
    } else {
      dayjs.locale('en')
    }
    return () => {
      cancelled = true
    }
  }, [locale])

  function getDefaultPollsPerPage() {
    const w = window.innerWidth
    if (w <= 480) return 2
    if (w <= 768) return 2
    if (w <= 1100) return 3
    return 4
  }

  const [pollsPerPage, setPollsPerPage] = useState(getDefaultPollsPerPage)

  useEffect(() => {
    setPollsPerPage((p) => (p > 5 ? 5 : p))
  }, [])

  const [eventViewportWidth, setEventViewportWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1200,
  )

  useEffect(() => {
    function handleResize() {
      setPollsPerPage(getDefaultPollsPerPage())
      setPageIndex(0)
      setEventViewportWidth(window.innerWidth)
    }
    setEventViewportWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const segmentMap = useMemo(() => {
    const m = new Map<string, PartyDimRow>()
    for (const p of partiesDim) m.set(p.party, p)
    return m
  }, [partiesDim])

  const mediaHeLabelByOutlet = useMemo(() => {
    const m = new Map<string, string>()
    for (const ev of events) {
      if (!ev.mediaOutlet) continue
      if (!m.has(ev.mediaOutlet)) {
        m.set(ev.mediaOutlet, ev.mediaOutletSheet || ev.mediaOutlet)
      }
    }
    return m
  }, [events])

  const displayMediaOutlet = useCallback(
    (outlet: string) => {
      if (locale === 'he') {
        return mediaHeLabelByOutlet.get(outlet) ?? outlet
      }
      return ENGLISH_MEDIA_NAMES[outlet] ?? outlet
    },
    [locale, mediaHeLabelByOutlet],
  )

  const displayParty = useCallback(
    (partyKey: string) => {
      if (locale !== 'he') return partyKey
      const he = segmentMap.get(partyKey)?.partyHeb?.trim()
      return he || partyKey
    },
    [locale, segmentMap],
  )

  const { polls, previousVotes } = useMemo(() => {
    const grouped = new Map<string, PollColumn>()

    for (const row of unpivot) {
      const key = `${row.pollId}`
      if (!grouped.has(key)) {
        grouped.set(key, {
          pollId: row.pollId,
          date: row.date,
          mediaOutlet: row.mediaOutlet,
          respondents: row.respondents,
          parties: [],
          coalitionTotal: 0,
          oppositionTotal: 0,
          arabsTotal: 0,
        })
      }
      const dim = segmentMap.get(row.party)
      const segment: Segment = dim?.segment ?? 'Opposition'
      const partyId = dim?.partyId ?? 99

      grouped.get(key)!.parties.push({
        party: row.party,
        votes: row.votes,
        segment,
        partyId,
      })
    }

    const list = Array.from(grouped.values())
    for (const poll of list) {
      poll.parties.sort((a, b) => b.votes - a.votes || a.partyId - b.partyId)
      poll.coalitionTotal = poll.parties
        .filter((p) => p.segment === 'Coalition')
        .reduce((s, p) => s + p.votes, 0)
      poll.oppositionTotal = poll.parties
        .filter((p) => p.segment === 'Opposition')
        .reduce((s, p) => s + p.votes, 0)
      poll.arabsTotal = poll.parties
        .filter((p) => p.segment === 'Arabs')
        .reduce((s, p) => s + p.votes, 0)
    }

    list.sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date)
      if (dateCompare !== 0) return dateCompare
      return b.pollId - a.pollId
    })

    const prevVotes: PreviousPollMap = new Map()
    const outletLatestPollId = new Map<string, number>()
    for (const poll of list) {
      const existing = outletLatestPollId.get(poll.mediaOutlet)
      if (existing === undefined || poll.pollId > existing) {
        outletLatestPollId.set(poll.mediaOutlet, poll.pollId)
      }
    }
    for (const poll of list) {
      const latestId = outletLatestPollId.get(poll.mediaOutlet)
      if (latestId !== undefined && poll.pollId < latestId) {
        if (!prevVotes.has(poll.mediaOutlet)) {
          prevVotes.set(poll.mediaOutlet, new Map())
          for (const p of poll.parties) {
            prevVotes.get(poll.mediaOutlet)!.set(p.party, p.votes)
          }
        }
      }
    }

    return { polls: list, previousVotes: prevVotes }
  }, [unpivot, segmentMap])

  const totalPages = Math.max(1, Math.ceil(polls.length / pollsPerPage))
  const safePage = Math.min(pageIndex, totalPages - 1)
  const visiblePolls = polls.slice(
    safePage * pollsPerPage,
    (safePage + 1) * pollsPerPage,
  )

  const allParties = useMemo(() => {
    const pSet = new Map<string, { segment: Segment; maxVotes: number; partyId: number }>()
    for (const poll of polls) {
      for (const p of poll.parties) {
        const existing = pSet.get(p.party)
        if (!existing || p.votes > existing.maxVotes) {
          pSet.set(p.party, { segment: p.segment, maxVotes: p.votes, partyId: p.partyId })
        }
      }
    }

    const firstPoll = visiblePolls[0]
    const firstPollVotes = new Map<string, number>()
    if (firstPoll) {
      for (const p of firstPoll.parties) firstPollVotes.set(p.party, p.votes)
    }

    return Array.from(pSet.entries())
      .map(([party, info]) => ({ party, ...info }))
      .sort((a, b) => {
        const aVotes = firstPollVotes.get(a.party) ?? 0
        const bVotes = firstPollVotes.get(b.party) ?? 0
        return bVotes - aVotes || a.partyId - b.partyId
      })
  }, [polls, visiblePolls])

  const maxVotes = useMemo(() => {
    let m = 0
    for (const poll of polls) {
      for (const p of poll.parties) {
        if (p.votes > m) m = p.votes
      }
    }
    return m || 40
  }, [polls])

  const pollDateBounds = useMemo(() => {
    if (!polls.length) return { oldest: null as string | null, newest: null as string | null }
    let newestT = new Date(polls[0].date).getTime()
    let oldestT = newestT
    let newest = polls[0].date
    let oldest = polls[0].date
    for (const p of polls) {
      const t = new Date(p.date).getTime()
      if (!Number.isFinite(t)) continue
      if (t > newestT) {
        newestT = t
        newest = p.date
      }
      if (t < oldestT) {
        oldestT = t
        oldest = p.date
      }
    }
    return { oldest, newest }
  }, [polls])

  const boundDateFmt = locale === 'he' ? 'DD/MM/YYYY' : 'MM/DD/YYYY'
  const newestBoundLabel = pollDateBounds.newest
    ? dayjs(pollDateBounds.newest).format(boundDateFmt)
    : ''
  const oldestBoundLabel = pollDateBounds.oldest
    ? dayjs(pollDateBounds.oldest).format(boundDateFmt)
    : ''

  const showSparklines = visiblePolls.length === 1
  const sparklineOutlet = showSparklines ? visiblePolls[0].mediaOutlet : null

  type EnrichedEvent = {
    date: string
    name: string
    shortName: string
    shortNameHe: string
    category: string
  }

  const sparklineData = useMemo(() => {
    const empty = {
      history: new Map<string, { date: string; votes: number }[]>(),
      eventDates: [] as string[],
      enrichedEvents: [] as EnrichedEvent[],
      timeRange: { minT: 0, maxT: 0 },
    }
    if (!sparklineOutlet) return empty

    const history = new Map<string, { date: string; votes: number }[]>()
    for (const row of unpivot) {
      if (row.mediaOutlet !== sparklineOutlet) continue
      if (!history.has(row.party)) history.set(row.party, [])
      history.get(row.party)!.push({ date: row.date, votes: row.votes })
    }
    for (const [, arr] of history) {
      arr.sort((a, b) => a.date.localeCompare(b.date))
    }

    let minT = Infinity
    let maxT = -Infinity
    for (const [, arr] of history) {
      if (arr.length) {
        const first = new Date(arr[0].date).getTime()
        const last = new Date(arr[arr.length - 1].date).getTime()
        if (first < minT) minT = first
        if (last > maxT) maxT = last
      }
    }
    if (!Number.isFinite(minT)) {
      minT = 0
      maxT = 1
    }

    const majorEventMap = new Map<string, MajorEventRow>()
    for (const me of majorEvents) majorEventMap.set(me.eventName, me)

    const seen = new Set<string>()
    const enrichedAll: EnrichedEvent[] = []
    for (const row of events) {
      if (row.mediaOutlet !== sparklineOutlet || !row.eventName) continue
      if (isMajorEventExcludedFromDisplay(row.eventName)) continue
      if (seen.has(row.eventName)) continue
      seen.add(row.eventName)
      const major = majorEventMap.get(row.eventName)
      const shortName = formatEventLabelForDisplay(row.eventName, 20)
      const heRaw = major?.eventNameHe?.trim() ?? ''
      const shortNameHe = heRaw
        ? formatEventLabelForDisplay(heRaw, 20)
        : shortName
      enrichedAll.push({
        date: row.date,
        name: row.eventName,
        shortName,
        shortNameHe,
        category: major?.category ?? '',
      })
    }
    enrichedAll.sort((a, b) => a.date.localeCompare(b.date))

    const enrichedInPollRange = enrichedAll.filter(
      (e) => new Date(e.date).getTime() >= minT,
    )

    const maxLabels = maxEventLabelsForViewportWidth(eventViewportWidth)
    const enrichedEvents = selectEventsForViewportDisplay(enrichedInPollRange, maxLabels)
    const eventDates = enrichedEvents.map((e) => e.date)

    return { history, eventDates, enrichedEvents, timeRange: { minT, maxT } }
  }, [unpivot, events, majorEvents, sparklineOutlet, eventViewportWidth])

  const rowsRef = useRef<HTMLDivElement>(null)
  const headerEventsRef = useRef<HTMLDivElement>(null)
  const [overlayPos, setOverlayPos] = useState<{ left: number; width: number } | null>(null)

  const alignHeaderEventsToSparkline = useCallback(() => {
    if (!showSparklines) return
    const wrap = rowsRef.current?.querySelector('.lpo-sparkline-wrap')
    const events = headerEventsRef.current
    if (!wrap || !events) return
    events.style.marginLeft = '0'
    void events.offsetHeight
    const dx = wrap.getBoundingClientRect().left - events.getBoundingClientRect().left
    if (Math.abs(dx) > 0.25) events.style.marginLeft = `${dx}px`
  }, [showSparklines])

  useEffect(() => {
    if (!showSparklines) { setOverlayPos(null); return }
    function measure() {
      if (!rowsRef.current) return
      const wrapper = rowsRef.current.querySelector('.lpo-sparkline-wrap')
      if (!wrapper) return
      const containerRect = rowsRef.current.getBoundingClientRect()
      const wrapperRect = wrapper.getBoundingClientRect()
      setOverlayPos({
        left: wrapperRect.left - containerRect.left,
        width: wrapperRect.width,
      })
      requestAnimationFrame(() => alignHeaderEventsToSparkline())
    }
    measure()
    const ro = new ResizeObserver(measure)
    const container = rowsRef.current
    if (!container) {
      return () => {
        ro.disconnect()
      }
    }
    const wrapper = container.querySelector('.lpo-sparkline-wrap')
    if (wrapper) ro.observe(wrapper)
    ro.observe(container)
    return () => ro.disconnect()
  }, [showSparklines, allParties, eventViewportWidth, alignHeaderEventsToSparkline])

  useLayoutEffect(() => {
    if (!showSparklines) {
      if (headerEventsRef.current) headerEventsRef.current.style.marginLeft = ''
      return
    }
    alignHeaderEventsToSparkline()
  }, [showSparklines, alignHeaderEventsToSparkline, sparklineData.enrichedEvents.length, overlayPos?.width])

  function getChange(
    mediaOutlet: string,
    party: string,
    currentVotes: number,
  ): { value: number; direction: 'up' | 'down' | 'none' } | null {
    const prev = previousVotes.get(mediaOutlet)?.get(party)
    if (prev === undefined) return null
    const diff = currentVotes - prev
    if (diff === 0) return null
    return { value: Math.abs(diff), direction: diff > 0 ? 'up' : 'down' }
  }

  function getPreviousDate(mediaOutlet: string): string | null {
    for (const poll of polls) {
      if (poll.mediaOutlet === mediaOutlet && poll !== visiblePolls.find((v) => v.mediaOutlet === mediaOutlet)) {
        return poll.date
      }
    }
    return null
  }

  return (
    <section className="dashboard-frame">
      <div className="dashboard-heading">
        <h2>
          {t.titleLatest}
          <strong>{t.titleElectionPolls}</strong>
          {t.titleOverview}
        </h2>
        {error && <p className="meta error">{error}</p>}
      </div>

      <div className="lpo-legend-row">
        <div
          className="locale-toggle"
          role="group"
          aria-label={t.localeToggleAria}
        >
          <button
            type="button"
            className={`locale-toggle-btn${locale === 'en' ? ' active' : ''}`}
            onClick={() => setLocale('en')}
          >
            EN
          </button>
          <button
            type="button"
            className={`locale-toggle-btn${locale === 'he' ? ' active' : ''}`}
            onClick={() => setLocale('he')}
          >
            עב
          </button>
        </div>
        <div className="lpo-toolbar-pagination">
          <div className="lpo-nav-arrows">
            <button
              type="button"
              className="icon-pagination-btn icon-pagination-btn--header lpo-nav-grid-prev"
              disabled={safePage === 0}
              aria-label={t.previousBtn}
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
            >
              <img src={publicUrl('/pagination-prev.png')} alt="" decoding="async" />
            </button>
            <div className="lpo-page-scrubber-shell">
              <input
                type="range"
                className="lpo-page-scrubber"
                min={0}
                max={Math.max(0, totalPages - 1)}
                value={safePage}
                disabled={totalPages <= 1}
                aria-label={`${t.pageOf} ${safePage + 1} ${t.pageOfMid} ${totalPages}`}
                onChange={(e) => setPageIndex(Number(e.target.value))}
              />
            </div>
            <button
              type="button"
              className="icon-pagination-btn icon-pagination-btn--header lpo-nav-grid-next"
              disabled={safePage >= totalPages - 1}
              aria-label={t.nextBtn}
              onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
            >
              <img src={publicUrl('/pagination-next.png')} alt="" decoding="async" />
            </button>
            {newestBoundLabel ? (
              <span className="lpo-nav-bound-date lpo-nav-date-cell lpo-nav-date-cell--leading">
                {newestBoundLabel}
              </span>
            ) : (
              <span className="lpo-nav-date-cell lpo-nav-date-cell--leading" aria-hidden />
            )}
            <div className="lpo-nav-date-spacer" aria-hidden />
            {oldestBoundLabel ? (
              <span className="lpo-nav-bound-date lpo-nav-date-cell lpo-nav-date-cell--trailing">
                {oldestBoundLabel}
              </span>
            ) : (
              <span className="lpo-nav-date-cell lpo-nav-date-cell--trailing" aria-hidden />
            )}
          </div>
        </div>
        <div className="lpo-inline-filters">
          <label className="lpo-filter">
            <span>{t.pollsPerPage}</span>
            <select
              value={pollsPerPage}
              onChange={(e) => {
                setPollsPerPage(Number(e.target.value))
                setPageIndex(0)
              }}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {loading ? (
        <p style={{ color: '#6b829e' }}>{t.loading}</p>
      ) : visiblePolls.length === 0 ? (
        <p style={{ color: '#6b829e' }}>{t.noPolls}</p>
      ) : (
        <div
          className={`lpo-table${showSparklines ? ' lpo-single-col' : ''}`}
          style={{
            '--lpo-cols': visiblePolls.length,
          } as React.CSSProperties}
        >
          {/* Header row */}
          <div className="lpo-header-row">
            {!showSparklines && <div className="lpo-party-label-col" />}
            {visiblePolls.map((poll) => {
              const prevDate = getPreviousDate(poll.mediaOutlet)
              const prevCoalition = previousVotes.get(poll.mediaOutlet)
                ? Array.from(previousVotes.get(poll.mediaOutlet)!.entries())
                    .filter(([p]) => segmentMap.get(p)?.segment === 'Coalition')
                    .reduce((s, [, v]) => s + v, 0)
                : null
              const prevOpposition = previousVotes.get(poll.mediaOutlet)
                ? Array.from(previousVotes.get(poll.mediaOutlet)!.entries())
                    .filter(([p]) => segmentMap.get(p)?.segment !== 'Coalition' && segmentMap.get(p)?.segment !== 'Arabs')
                    .reduce((s, [, v]) => s + v, 0)
                : null
              const coalChange = prevCoalition !== null ? poll.coalitionTotal - prevCoalition : null
              const oppChange = prevOpposition !== null ? poll.oppositionTotal - prevOpposition : null
              const { minT, maxT } = sparklineData.timeRange
              const timeRange = maxT - minT || 1

              return (
                <div key={poll.pollId} className="lpo-col-header">
                  {showSparklines ? (
                    <div className="lpo-header-merged-inner">
                      <div className="lpo-header-meta-bars">
                        <div className="lpo-header-top-info">
                          <div className="lpo-col-media-name">
                            {displayMediaOutlet(poll.mediaOutlet)}
                          </div>
                          <div className="lpo-col-date">
                            {dayjs(poll.date).format(locale === 'he' ? 'DD/MM/YY' : 'MMM-DD/YY')}
                          </div>
                        </div>
                        <div className="lpo-header-bars-area">
                          <div className="lpo-col-media-icon lpo-header-icon">
                            <IconWithFallback
                              src={MEDIA_ICON_MAP[poll.mediaOutlet]}
                              label={displayMediaOutlet(poll.mediaOutlet)}
                            />
                          </div>
                          <div className="lpo-hbars">
                            <div className="lpo-hbar-segment">
                              <span className="lpo-hbar-label">{t.coalition}</span>
                              <div className="lpo-hbar-track">
                                <div className="lpo-hbar-fill" style={{ width: `${(poll.coalitionTotal / 120) * 100}%`, background: SEGMENT_COLORS.Coalition }} />
                                <div
                                  className="lpo-hbar-end-meta"
                                  style={{ left: `${(poll.coalitionTotal / 120) * 100}%` }}
                                >
                                  <strong className="lpo-hbar-value" style={{ color: SEGMENT_COLORS.Coalition }}>{poll.coalitionTotal}</strong>
                                </div>
                              </div>
                            </div>
                            <div className="lpo-hbar-segment">
                              <span className="lpo-hbar-label">{t.opposition}</span>
                              <div className="lpo-hbar-track">
                                <div className="lpo-hbar-fill" style={{ width: `${(poll.oppositionTotal / 120) * 100}%`, background: SEGMENT_COLORS.Opposition }} />
                                <div
                                  className="lpo-hbar-end-meta"
                                  style={{ left: `${(poll.oppositionTotal / 120) * 100}%` }}
                                >
                                  <strong className="lpo-hbar-value" style={{ color: SEGMENT_COLORS.Opposition }}>{poll.oppositionTotal}</strong>
                                </div>
                              </div>
                            </div>
                            <div className="lpo-hbar-segment">
                              <span className="lpo-hbar-label">{t.arabs}</span>
                              <div className="lpo-hbar-track">
                                <div className="lpo-hbar-fill" style={{ width: `${(poll.arabsTotal / 120) * 100}%`, background: SEGMENT_COLORS.Arabs }} />
                                <div
                                  className="lpo-hbar-end-meta"
                                  style={{ left: `${(poll.arabsTotal / 120) * 100}%` }}
                                >
                                  <strong className="lpo-hbar-value" style={{ color: SEGMENT_COLORS.Arabs }}>{poll.arabsTotal}</strong>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div
                        ref={headerEventsRef}
                        className={`lpo-header-events${overlayPos ? ' lpo-header-events--sized' : ''}`}
                        style={overlayPos ? { width: overlayPos.width } : undefined}
                      >
                        {sparklineData.enrichedEvents.map((ev) => {
                          const evT = new Date(ev.date).getTime()
                          const pct = ((evT - minT) / timeRange) * 100
                          const catColor = EVENT_CATEGORY_COLORS[ev.category] ?? 'rgba(255,255,255,0.3)'
                          return (
                            <div key={`${ev.name}-${ev.date}`} className="lpo-event-label" style={{ left: `${pct}%` }}>
                              <span className="lpo-event-label-text" style={{ color: catColor }}>
                                {locale === 'he' ? ev.shortNameHe : ev.shortName}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="lpo-col-media-icon">
                        <IconWithFallback
                          src={MEDIA_ICON_MAP[poll.mediaOutlet]}
                          label={displayMediaOutlet(poll.mediaOutlet)}
                        />
                      </div>
                      <div className="lpo-col-media-name">
                        {displayMediaOutlet(poll.mediaOutlet)}
                      </div>
                      <div className="lpo-col-date">
                        {t.latestPrefix}{' '}
                        <strong>
                          {dayjs(poll.date).format(locale === 'he' ? 'DD/MM/YYYY' : 'M/D/YYYY')}
                        </strong>
                      </div>
                      {prevDate && (
                        <div className="lpo-col-prev-date">
                          {t.previousDate}{' '}
                          {dayjs(prevDate).format(locale === 'he' ? 'DD/MM/YYYY' : 'MMM-DD-YYYY')}
                        </div>
                      )}
                      <div
                        className={
                          visiblePolls.length > 1
                            ? 'lpo-col-totals lpo-col-totals--multi'
                            : 'lpo-col-totals'
                        }
                      >
                        {visiblePolls.length > 1 ? (
                          <>
                            <span className="lpo-total opposition">
                              <span className="lpo-total-label">{t.opposition}</span>
                              <span className="lpo-total-figures">
                                <strong>{poll.oppositionTotal}</strong>
                                {oppChange !== null && oppChange !== 0 ? (
                                  <span className={`lpo-change ${oppChange > 0 ? 'up' : 'down'}`}>
                                    {oppChange > 0 ? '\u25B2' : '\u25BC'}{Math.abs(oppChange)}
                                  </span>
                                ) : null}
                              </span>
                            </span>
                            <span className="lpo-total coalition">
                              <span className="lpo-total-label">{t.coalition}</span>
                              <span className="lpo-total-figures">
                                <strong>{poll.coalitionTotal}</strong>
                                {coalChange !== null && coalChange !== 0 ? (
                                  <span className={`lpo-change ${coalChange > 0 ? 'up' : 'down'}`}>
                                    {coalChange > 0 ? '\u25B2' : '\u25BC'}{Math.abs(coalChange)}
                                  </span>
                                ) : null}
                              </span>
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="lpo-total coalition">
                              <span className="lpo-total-label">{t.coalition}</span>
                              <span className="lpo-total-figures">
                                <strong>{poll.coalitionTotal}</strong>
                                {coalChange !== null && coalChange !== 0 ? (
                                  <span className={`lpo-change ${coalChange > 0 ? 'up' : 'down'}`}>
                                    {coalChange > 0 ? '\u25B2' : '\u25BC'}{Math.abs(coalChange)}
                                  </span>
                                ) : null}
                              </span>
                            </span>
                            <span className="lpo-total opposition">
                              <span className="lpo-total-label">{t.opposition}</span>
                              <span className="lpo-total-figures">
                                <strong>{poll.oppositionTotal}</strong>
                                {oppChange !== null && oppChange !== 0 ? (
                                  <span className={`lpo-change ${oppChange > 0 ? 'up' : 'down'}`}>
                                    {oppChange > 0 ? '\u25B2' : '\u25BC'}{Math.abs(oppChange)}
                                  </span>
                                ) : null}
                              </span>
                            </span>
                          </>
                        )}
                      </div>
                      <div
                        className={
                          visiblePolls.length > 1
                            ? 'lpo-threshold-bar lpo-threshold-bar--opp-left'
                            : 'lpo-threshold-bar'
                        }
                      >
                        {visiblePolls.length > 1 ? (
                          <>
                            <div
                              className="lpo-threshold-fill opposition-fill"
                              style={{ width: `${(poll.oppositionTotal / 120) * 100}%`, left: 0 }}
                            />
                            <div
                              className="lpo-threshold-fill arabs-fill"
                              style={{
                                width: `${(poll.arabsTotal / 120) * 100}%`,
                                left: `${(poll.oppositionTotal / 120) * 100}%`,
                              }}
                            />
                            <div
                              className="lpo-threshold-fill coalition-fill"
                              style={{
                                width: `${(poll.coalitionTotal / 120) * 100}%`,
                                left: `${((poll.oppositionTotal + poll.arabsTotal) / 120) * 100}%`,
                              }}
                            />
                          </>
                        ) : (
                          <>
                            <div className="lpo-threshold-fill coalition-fill" style={{ width: `${(poll.coalitionTotal / 120) * 100}%` }} />
                            <div
                              className="lpo-threshold-fill arabs-fill"
                              style={{ width: `${(poll.arabsTotal / 120) * 100}%`, left: `${(poll.coalitionTotal / 120) * 100}%` }}
                            />
                            <div
                              className="lpo-threshold-fill opposition-fill"
                              style={{
                                width: `${(poll.oppositionTotal / 120) * 100}%`,
                                left: `${((poll.coalitionTotal + poll.arabsTotal) / 120) * 100}%`,
                              }}
                            />
                          </>
                        )}
                        <div className="lpo-threshold-line" style={{ left: `${(60 / 120) * 100}%` }} />
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {/* Party rows with event line overlay in sparkline mode */}
          <div ref={rowsRef} className="lpo-rows-container" style={{ position: 'relative' }}>
            {showSparklines && overlayPos && (() => {
              const { minT, maxT } = sparklineData.timeRange
              const timeRange = maxT - minT || 1
              return (
                <div className="lpo-event-overlay" style={{ left: overlayPos.left, width: overlayPos.width }}>
                  {sparklineData.enrichedEvents.map((ev) => {
                    const evT = new Date(ev.date).getTime()
                    const pct = ((evT - minT) / timeRange) * 100
                    const catColor = EVENT_CATEGORY_COLORS[ev.category] ?? 'rgba(255,255,255,0.3)'
                    return (
                      <div key={`${ev.name}-${ev.date}`} className="lpo-event-line" style={{ left: `${pct}%`, borderColor: catColor }} />
                    )
                  })}
                </div>
              )
            })()}
            {allParties.map((partyInfo) => (
              <div key={partyInfo.party} className="lpo-party-row">
                <div className="lpo-party-label-col">
                  <IconWithFallback
                    src={PARTY_ICON_MAP[partyInfo.party]}
                    label={displayParty(partyInfo.party)}
                  />
                  <span className="lpo-party-name">{displayParty(partyInfo.party)}</span>
                </div>
                {visiblePolls.map((poll) => {
                  const partyData = poll.parties.find(
                    (p) => p.party === partyInfo.party,
                  )
                  const votes = partyData?.votes ?? 0
                  const segment = partyData?.segment ?? partyInfo.segment
                  const change = getChange(poll.mediaOutlet, partyInfo.party, votes)

                  const partyHistory = showSparklines ? sparklineData.history.get(partyInfo.party) : undefined
                  const barPct = maxVotes > 0 ? (votes / maxVotes) * 100 : 0

                  return (
                    <div key={poll.pollId} className={`lpo-party-cell${showSparklines ? ' lpo-has-sparkline' : ''}`}>
                      <span className="lpo-party-cell-name">{displayParty(partyInfo.party)}</span>
                      <div className="lpo-bar-row">
                        <div className="lpo-bar-track">
                          <div
                            className="lpo-bar-fill"
                            style={{
                              width: `${barPct}%`,
                              background: SEGMENT_COLORS[segment],
                            }}
                          />
                          <div
                            className="lpo-bar-end-meta"
                            style={{ left: `${barPct}%` }}
                          >
                            <strong
                              className="lpo-votes"
                              style={{ color: SEGMENT_COLORS[segment] }}
                            >{votes}</strong>{change ? (
                              <span className={`lpo-change-badge ${change.direction}`}>
                                {change.direction === 'up' ? '\u25B2' : '\u25BC'}
                                {change.value}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    {showSparklines && partyHistory && partyHistory.length >= 2 && (
                      <Sparkline
                        data={partyHistory}
                        eventDates={sparklineData.eventDates}
                        color={SEGMENT_COLORS[segment]}
                        globalMinT={sparklineData.timeRange.minT}
                        globalMaxT={sparklineData.timeRange.maxT}
                        seatsLabel={t.seats}
                      />
                    )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pagination-controls" style={{ marginTop: '1rem' }}>
        <button
          type="button"
          className="icon-pagination-btn icon-pagination-btn--footer"
          disabled={safePage === 0}
          aria-label={t.previousBtn}
          onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
        >
          <img src={publicUrl('/pagination-prev.png')} alt="" decoding="async" />
        </button>
        <span className="pagination-controls-caption">
          {t.pageOf} {safePage + 1} {t.pageOfMid} {totalPages} &middot; {polls.length}{' '}
          {t.pollsWord}
        </span>
        <button
          type="button"
          className="icon-pagination-btn icon-pagination-btn--footer"
          disabled={safePage >= totalPages - 1}
          aria-label={t.nextBtn}
          onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
        >
          <img src={publicUrl('/pagination-next.png')} alt="" decoding="async" />
        </button>
      </div>
    </section>
  )
}
