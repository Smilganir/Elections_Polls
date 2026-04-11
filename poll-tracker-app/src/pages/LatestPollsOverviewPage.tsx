import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import dayjs from 'dayjs'
import {
  ENGLISH_MEDIA_NAMES,
  EVENT_CATEGORY_COLORS,
  isMajorEventExcludedFromDisplay,
  maxEventLabelsForViewportWidth,
  MEDIA_ICON_MAP,
  PARTY_ICON_MAP,
  HEBREW_PARTY_DISPLAY_OVERRIDES,
  formatEventLabelForDisplay,
  selectEventsForViewportDisplay,
  SEGMENT_COLORS,
  SPARKLINE_PARTY_DEBUT_DATE,
} from '../config/mappings'
import { useDashboardData } from '../hooks/useDashboardData'
import type { MajorEventRow, PartyDimRow, Segment } from '../types/data'
import { IconWithFallback } from '../ui/IconWithFallback'
import { PaginationChevronIcon } from '../ui/PaginationChevronIcon'
import { useLocale } from '../i18n/useLocale'
import type { AppLocale } from '../i18n/localeContext'
import { UI } from '../i18n/strings'
import type { UiStrings } from '../i18n/strings'
import { trackMergeArabsToggle } from '../lib/gtagEvents'
import { pickPollSummaryNarrative } from '../content/pickPollSummaryNarrative'
import { buildRollingWindowReport } from '../lib/pollRollingWindow'
import { PollSummaryPanel } from '../ui/PollSummaryPanel'
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

type BlocPollPoint = { date: string; pollId: number; coalition: number; opposition: number; arabs: number }

/** When merge is on, Arab-list parties use the same fill as opposition (white); when off, Arabs stay grey. */
function segmentDisplayColor(segment: Segment, mergeArabsWithOpposition: boolean): string {
  if (mergeArabsWithOpposition && segment === 'Arabs') return SEGMENT_COLORS.Opposition
  return SEGMENT_COLORS[segment]
}

const COMBINE_ARABS_STORAGE_KEY = 'lpo-combine-arabs-with-opposition'

const DEFAULT_POLL_SUMMARY_WINDOW_DAYS = 10
const MIN_POLL_SUMMARY_WINDOW_DAYS = 1
const MAX_POLL_SUMMARY_WINDOW_DAYS = 90

function clampPollSummaryWindowDays(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_POLL_SUMMARY_WINDOW_DAYS
  return Math.min(
    MAX_POLL_SUMMARY_WINDOW_DAYS,
    Math.max(MIN_POLL_SUMMARY_WINDOW_DAYS, Math.round(n)),
  )
}

/** Wider than this: polls-per-page select offers 6; at or below: max option is 5 (matches tablet/small layout). */
const LPO_DESKTOP_POLLS_PER_PAGE_BREAKPOINT_PX = 768

function maxPollsPerPageForWidth(width: number): number {
  return width > LPO_DESKTOP_POLLS_PER_PAGE_BREAKPOINT_PX ? 6 : 5
}

/**
 * Poll paging swipe: use shortest viewport edge so landscape phones still qualify (width often > 768).
 * 1100 covers common tablets (e.g. iPad short edge 820–1024); min > 1100 excludes typical desktop FHD+.
 */
const LPO_SWIPE_MAX_SHORT_EDGE_PX = 1100
function shouldUseLpoSwipeGestures(): boolean {
  if (typeof window === 'undefined') return false
  return Math.min(window.innerWidth, window.innerHeight) <= LPO_SWIPE_MAX_SHORT_EDGE_PX
}

function latestExtremaIndices(vals: number[]) {
  if (vals.length < 2) return null
  const maxV = Math.max(...vals)
  const minV = Math.min(...vals)
  let maxIdx = 0
  for (let i = vals.length - 1; i >= 0; i--) {
    if (vals[i] === maxV) {
      maxIdx = i
      break
    }
  }
  let minIdx = 0
  for (let i = vals.length - 1; i >= 0; i--) {
    if (vals[i] === minV) {
      minIdx = i
      break
    }
  }
  return { maxV, minV, maxIdx, minIdx, flat: maxV === minV }
}

function blocHighlightIdx(series: BlocPollPoint[], currentPollDate: string | undefined): number | null {
  if (!currentPollDate || series.length === 0) return null
  const exact = series.findIndex((d) => d.date === currentPollDate)
  if (exact >= 0) return exact
  const targetT = new Date(currentPollDate).getTime()
  if (!Number.isFinite(targetT)) return series.length - 1
  const ts = series.map((d) => new Date(d.date).getTime())
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < ts.length; i++) {
    const dist = Math.abs(ts[i] - targetT)
    if (dist < bestDist) {
      bestDist = dist
      best = i
    }
  }
  return best
}

/** True when viewport width is at most `maxPx` (for overlap heuristics on small screens). */
function useMediaMaxWidth(maxPx: number) {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(`(max-width: ${maxPx}px)`).matches,
  )
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxPx}px)`)
    const onChange = () => setMatches(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [maxPx])
  return matches
}

/** Narrow portrait phone/tablet — event labels default off (crowded sparklines). */
const PORTRAIT_MOBILE_EVENT_MQ = '(max-width: 768px) and (orientation: portrait)'

function isPortraitMobileForEvents(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.matchMedia(PORTRAIT_MOBILE_EVENT_MQ).matches
  } catch {
    return false
  }
}

/**
 * Initial event-label visibility: hidden on narrow portrait; visible on landscape and wider layouts.
 */
function defaultShowEventLabelsForViewport(): boolean {
  if (typeof window === 'undefined') return true
  return !isPortraitMobileForEvents()
}

/** Marker strip + interactive bloc band: stepped lines, HTML labels, hover tooltip, current-poll ▼ on chart top edge. */
function HeaderBlocSparklineBundle({
  series,
  minT,
  maxT,
  currentPollDate,
  band,
  t,
  locale,
  combineArabsWithOpposition,
}: {
  series: BlocPollPoint[]
  minT: number
  maxT: number
  currentPollDate: string
  band: { top: number; height: number } | null
  t: UiStrings
  locale: AppLocale
  combineArabsWithOpposition: boolean
}) {
  const W = 200
  const H = 100
  const rangeT = maxT - minT || 1
  const toX = (tMs: number) => ((tMs - minT) / rangeT) * W

  const [hover, setHover] = useState<{ idx: number; x: number; y: number } | null>(null)
  const narrowLayout = useMediaMaxWidth(768)
  const ts = useMemo(() => series.map((d) => new Date(d.date).getTime()), [series])
  const coalVals = useMemo(() => series.map((p) => p.coalition), [series])
  const oppVals = useMemo(
    () =>
      series.map((p) =>
        combineArabsWithOpposition ? p.opposition + p.arabs : p.opposition,
      ),
    [series, combineArabsWithOpposition],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (series.length < 2) return
      const rect = e.currentTarget.getBoundingClientRect()
      const pxX = e.clientX - rect.left
      const ratio = pxX / rect.width
      const cursorT = minT + ratio * rangeT
      let best = 0
      let bestDist = Infinity
      for (let i = 0; i < ts.length; i++) {
        const dist = Math.abs(ts[i] - cursorT)
        if (dist < bestDist) {
          bestDist = dist
          best = i
        }
      }
      setHover({ idx: best, x: e.clientX, y: e.clientY })
    },
    [ts, minT, rangeT, series.length],
  )

  const handleMouseLeave = useCallback(() => setHover(null), [])

  if (series.length < 2) return null

  let minV = Infinity
  let maxV = -Infinity
  for (const p of series) {
    const oppV = combineArabsWithOpposition ? p.opposition + p.arabs : p.opposition
    if (p.coalition < minV) minV = p.coalition
    if (p.coalition > maxV) maxV = p.coalition
    if (oppV < minV) minV = oppV
    if (oppV > maxV) maxV = oppV
  }
  const vPad = 1
  const fullRange = (maxV + vPad) - (minV - vPad) || 1
  const toY = (v: number) => H - ((v - (minV - vPad)) / fullRange) * H

  let coalD = ''
  let oppD = ''
  for (let i = 0; i < series.length; i++) {
    const x = toX(ts[i])
    const yc = toY(series[i].coalition)
    const yo = toY(
      combineArabsWithOpposition
        ? series[i].opposition + series[i].arabs
        : series[i].opposition,
    )
    coalD += i === 0 ? `M${x},${yc}` : `H${x}V${yc}`
    oppD += i === 0 ? `M${x},${yo}` : `H${x}V${yo}`
  }

  const showMajLine = 60 >= minV - vPad && 60 <= maxV + vPad
  const majY = toY(60)

  const stepStroke = {
    fill: 'none' as const,
    vectorEffect: 'non-scaling-stroke' as const,
    strokeLinecap: 'butt' as const,
    strokeLinejoin: 'miter' as const,
  }

  const exCoal = latestExtremaIndices(coalVals)
  const exOpp = latestExtremaIndices(oppVals)
  const hi = blocHighlightIdx(series, currentPollDate)
  const markerLeftPct = hi !== null && series.length ? (toX(ts[hi]) / W) * 100 : null

  const dateFmt = locale === 'he' ? 'DD/MM/YYYY' : 'MMM D, YYYY'
  const earliestLeftPct = (toX(ts[0]) / W) * 100
  const showEarliestBlocLabels = !narrowLayout || earliestLeftPct >= 26

  return (
    <>
      <div className="lpo-header-bloc-marker-strip" aria-hidden>
        {markerLeftPct !== null ? (
          <span
            className="lpo-header-bloc-current-marker"
            style={{ left: `${markerLeftPct}%` }}
            title={series[hi!].date}
            role="img"
            aria-label={series[hi!].date}
          />
        ) : null}
      </div>
      <div
        className="lpo-header-events-bloc-chart-wrap"
        style={band ? { top: band.top, height: band.height } : undefined}
      >
        <div
          className="lpo-header-bloc-interactive"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <svg
            className="lpo-header-events-bloc-chart"
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            overflow="visible"
            aria-hidden
          >
            {showMajLine ? (
              <line
                x1={0}
                x2={W}
                y1={majY}
                y2={majY}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={0.6}
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
            <path
              d={coalD}
              {...stepStroke}
              stroke={SEGMENT_COLORS.Coalition}
              strokeWidth={0.7}
              strokeOpacity={1}
            />
            <path
              d={oppD}
              {...stepStroke}
              stroke={SEGMENT_COLORS.Opposition}
              strokeWidth={0.7}
              strokeOpacity={1}
            />
          </svg>
          {showEarliestBlocLabels ? (
            <>
              <span
                className="lpo-header-bloc-earliest-val"
                style={{
                  left: `${earliestLeftPct}%`,
                  top: `${(toY(series[0].coalition) / H) * 100}%`,
                  color: SEGMENT_COLORS.Coalition,
                  opacity: 0.9,
                }}
                title={`${series[0].date} · ${t.coalition}`}
              >
                {series[0].coalition}
              </span>
              <span
                className="lpo-header-bloc-earliest-val"
                style={{
                  left: `${earliestLeftPct}%`,
                  top: `${(toY(combineArabsWithOpposition ? series[0].opposition + series[0].arabs : series[0].opposition) / H) * 100}%`,
                  color: SEGMENT_COLORS.Opposition,
                  opacity: 0.88,
                }}
                title={`${series[0].date} · ${t.opposition}`}
              >
                {combineArabsWithOpposition
                  ? series[0].opposition + series[0].arabs
                  : series[0].opposition}
              </span>
            </>
          ) : null}
          {exCoal && !exCoal.flat && (
            <>
              {exCoal.maxV !== series[0].coalition ? (
                <span
                  className="lpo-header-bloc-extrema lpo-header-bloc-extrema--max"
                  style={{
                    left: `${(toX(ts[exCoal.maxIdx]) / W) * 100}%`,
                    top: `${(toY(series[exCoal.maxIdx].coalition) / H) * 100}%`,
                    color: SEGMENT_COLORS.Coalition,
                    opacity: 0.9,
                  }}
                  title={`${series[exCoal.maxIdx].date} · max (latest) ${exCoal.maxV} ${t.seats}`}
                >
                  {exCoal.maxV}
                </span>
              ) : null}
              {exCoal.minIdx !== 0 ? (
                <span
                  className="lpo-header-bloc-extrema lpo-header-bloc-extrema--min"
                  style={{
                    left: `${(toX(ts[exCoal.minIdx]) / W) * 100}%`,
                    top: `${(toY(series[exCoal.minIdx].coalition) / H) * 100}%`,
                    color: SEGMENT_COLORS.Coalition,
                    opacity: 0.9,
                  }}
                  title={`${series[exCoal.minIdx].date} · min (latest) ${exCoal.minV} ${t.seats}`}
                >
                  {exCoal.minV}
                </span>
              ) : null}
            </>
          )}
          {exOpp && !exOpp.flat && (
            <>
              {exOpp.maxV !==
              (combineArabsWithOpposition
                ? series[0].opposition + series[0].arabs
                : series[0].opposition) ? (
                <span
                  className="lpo-header-bloc-extrema lpo-header-bloc-extrema--max"
                  style={{
                    left: `${(toX(ts[exOpp.maxIdx]) / W) * 100}%`,
                    top: `${(toY(exOpp.maxV) / H) * 100}%`,
                    color: SEGMENT_COLORS.Opposition,
                    opacity: 0.88,
                  }}
                  title={`${series[exOpp.maxIdx].date} · max (latest) ${exOpp.maxV} ${t.seats}`}
                >
                  {exOpp.maxV}
                </span>
              ) : null}
              {exOpp.minIdx !== 0 ? (
                <span
                  className="lpo-header-bloc-extrema lpo-header-bloc-extrema--min"
                  style={{
                    left: `${(toX(ts[exOpp.minIdx]) / W) * 100}%`,
                    top: `${(toY(exOpp.minV) / H) * 100}%`,
                    color: SEGMENT_COLORS.Opposition,
                    opacity: 0.88,
                  }}
                  title={`${series[exOpp.minIdx].date} · min (latest) ${exOpp.minV} ${t.seats}`}
                >
                  {exOpp.minV}
                </span>
              ) : null}
            </>
          )}
          {hover !== null &&
            typeof document !== 'undefined' &&
            createPortal(
              <div
                className="lpo-sparkline-tooltip lpo-header-bloc-sparkline-tooltip"
                style={{ left: hover.x, top: hover.y }}
              >
                <span className="lpo-header-bloc-tooltip-lines">
                  <strong style={{ color: SEGMENT_COLORS.Coalition }}>{series[hover.idx].coalition}</strong>{' '}
                  {t.coalition}
                  <br />
                  <strong style={{ color: SEGMENT_COLORS.Opposition }}>
                    {combineArabsWithOpposition
                      ? series[hover.idx].opposition + series[hover.idx].arabs
                      : series[hover.idx].opposition}
                  </strong>{' '}
                  {t.opposition}
                  {!combineArabsWithOpposition ? (
                    <>
                      <br />
                      <strong style={{ color: SEGMENT_COLORS.Arabs }}>{series[hover.idx].arabs}</strong> {t.arabs}
                    </>
                  ) : null}
                </span>
                <span className="lpo-sparkline-tooltip-date">
                  {dayjs(series[hover.idx].date).format(dateFmt)}
                </span>
              </div>,
              document.body,
            )}
        </div>
      </div>
    </>
  )
}

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
  const narrowLayout = useMediaMaxWidth(768)
  const lineOpacity = 1

  /* Taller viewBox with same plot band (ch=26) so extrema labels sit in top/bottom gutters, not on y≈0/H. */
  const W = 200, H = 44
  const pad = { t: 9, b: 9, l: 0, r: 0 }
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

  /** Latest chronological index for each extrema (scan from end of sorted series). */
  const latestExtrema = useMemo(() => {
    if (vals.length < 2) return null
    const maxV = Math.max(...vals)
    const minV = Math.min(...vals)
    let maxIdx = 0
    for (let i = vals.length - 1; i >= 0; i--) {
      if (vals[i] === maxV) {
        maxIdx = i
        break
      }
    }
    let minIdx = 0
    for (let i = vals.length - 1; i >= 0; i--) {
      if (vals[i] === minV) {
        minIdx = i
        break
      }
    }
    return { maxV, minV, maxIdx, minIdx, flat: maxV === minV }
  }, [vals])

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

  const earliestXPct = (toX(ts[0]) / W) * 100
  const showEarliestVotesLabel = !narrowLayout || earliestXPct >= 26

  return (
    <div
      ref={wrapRef}
      className="lpo-sparkline-wrap"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        overflow="visible"
        className="lpo-sparkline-svg"
      >
        <line x1={pad.l} y1={avgY} x2={W - pad.r} y2={avgY}
          stroke="rgba(255,255,255,0.15)" strokeWidth={0.5} strokeDasharray="3,2"
          vectorEffect="non-scaling-stroke" />
        {evXs.map((ex, i) => (
          <line key={i} x1={ex} y1={pad.t} x2={ex} y2={H - pad.b}
            stroke="rgba(255,255,255,0.12)" strokeWidth={0.8} strokeDasharray="2,2"
            vectorEffect="non-scaling-stroke" />
        ))}
        <path d={pathD} fill="none" stroke={color} strokeWidth={0.7}
          strokeOpacity={lineOpacity}
          vectorEffect="non-scaling-stroke" />
        <circle cx={lastX} cy={lastY} r={0.1} fill="none" stroke={color}
          strokeOpacity={lineOpacity}
          strokeWidth={0.7} vectorEffect="non-scaling-stroke" />
        {hoverPoint && (
          <>
            <line x1={hoverPoint.vx} y1={pad.t} x2={hoverPoint.vx} y2={H - pad.b}
              stroke="rgba(255,255,255,0.35)" strokeWidth={0.8}
              vectorEffect="non-scaling-stroke" />
            <circle cx={hoverPoint.vx} cy={hoverPoint.vy} r={0.1} fill="none" stroke="#fff"
              strokeWidth={1.1} vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
      {showEarliestVotesLabel ? (
        <span
          className="lpo-sparkline-earliest-votes"
          style={{
            left: `${(toX(ts[0]) / W) * 100}%`,
            top: `${(toY(vals[0]) / H) * 100}%`,
            color,
            opacity: lineOpacity,
          }}
          title={`${data[0].date} · ${data[0].votes} ${seatsLabel}`}
        >
          {data[0].votes}
        </span>
      ) : null}
      {latestExtrema && !latestExtrema.flat && (
        <>
          {latestExtrema.maxV !== data[0].votes ? (
            <span
              className="lpo-sparkline-extrema-html lpo-sparkline-extrema-html--max"
              style={{
                left: `${(toX(ts[latestExtrema.maxIdx]) / W) * 100}%`,
                top: `${(toY(vals[latestExtrema.maxIdx]) / H) * 100}%`,
                color,
                opacity: lineOpacity,
              }}
              title={`${data[latestExtrema.maxIdx].date} · max (latest) ${latestExtrema.maxV} ${seatsLabel}`}
            >
              {latestExtrema.maxV}
            </span>
          ) : null}
          {latestExtrema.minIdx !== 0 ? (
            <span
              className="lpo-sparkline-extrema-html lpo-sparkline-extrema-html--min"
              style={{
                left: `${(toX(ts[latestExtrema.minIdx]) / W) * 100}%`,
                top: `${(toY(vals[latestExtrema.minIdx]) / H) * 100}%`,
                color,
                opacity: lineOpacity,
              }}
              title={`${data[latestExtrema.minIdx].date} · min (latest) ${latestExtrema.minV} ${seatsLabel}`}
            >
              {latestExtrema.minV}
            </span>
          ) : null}
        </>
      )}
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

function BlocArabsToggle({
  t,
  combineArabsWithOpposition,
  setCombineArabsWithOpposition,
}: {
  t: UiStrings
  combineArabsWithOpposition: boolean
  setCombineArabsWithOpposition: (v: boolean) => void
}) {
  return (
    <div className="lpo-bloc-arabs-toggle-wrap" title={t.blocArabsToggleAria}>
      <span className="lpo-bloc-arabs-toggle-label" id="lpo-bloc-arabs-toggle-lbl">
        {t.blocArabsToggleLabel}
      </span>
      <div
        className="locale-toggle lpo-bloc-arabs-toggle"
        role="group"
        aria-labelledby="lpo-bloc-arabs-toggle-lbl"
      >
        <button
          type="button"
          className={`locale-toggle-btn${!combineArabsWithOpposition ? ' active' : ''}`}
          onClick={() => {
            if (combineArabsWithOpposition) {
              trackMergeArabsToggle(false)
              setCombineArabsWithOpposition(false)
            }
          }}
        >
          {t.blocArabsSeparate}
        </button>
        <button
          type="button"
          className={`locale-toggle-btn${combineArabsWithOpposition ? ' active' : ''}`}
          onClick={() => {
            if (!combineArabsWithOpposition) {
              trackMergeArabsToggle(true)
              setCombineArabsWithOpposition(true)
            }
          }}
        >
          {t.blocArabsCombined}
        </button>
      </div>
    </div>
  )
}

export function LatestPollsOverviewPage() {
  const { locale, setLocale } = useLocale()
  const t = UI[locale]
  const { unpivot, events, majorEvents, partiesDim, loading, error } = useDashboardData()
  const [pageIndex, setPageIndex] = useState(0)
  /** Single-column (sparkline) mode: filter rows to one party; cleared when leaving sparkline mode or All parties. Poll pagination is kept while focused. */
  const [sparklineFocusedParty, setSparklineFocusedParty] = useState<string | null>(null)
  const [showEventLabels, setShowEventLabels] = useState(defaultShowEventLabelsForViewport)

  const [combineArabsWithOpposition, setCombineArabsWithOpposition] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(COMBINE_ARABS_STORAGE_KEY) === '1'
  })
  const [showPollSummary, setShowPollSummary] = useState(true)
  const [pollSummaryWindowDays, setPollSummaryWindowDays] = useState(
    DEFAULT_POLL_SUMMARY_WINDOW_DAYS,
  )
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(
      COMBINE_ARABS_STORAGE_KEY,
      combineArabsWithOpposition ? '1' : '0',
    )
  }, [combineArabsWithOpposition])

  /** Sync event labels with portrait vs horizontal narrow layout (iOS may need a tick after orientation change). */
  useEffect(() => {
    const mq = window.matchMedia(PORTRAIT_MOBILE_EVENT_MQ)
    let wasPortraitMobile = mq.matches

    const apply = () => {
      const pm = window.matchMedia(PORTRAIT_MOBILE_EVENT_MQ).matches
      if (wasPortraitMobile && !pm) {
        setShowEventLabels(true)
      } else if (!wasPortraitMobile && pm) {
        setShowEventLabels(false)
      }
      wasPortraitMobile = pm
    }

    mq.addEventListener('change', apply)
    let orientTimeout: ReturnType<typeof setTimeout> | undefined
    const onOrientationChange = () => {
      if (orientTimeout !== undefined) clearTimeout(orientTimeout)
      orientTimeout = setTimeout(apply, 100)
    }
    window.addEventListener('orientationchange', onOrientationChange)
    return () => {
      mq.removeEventListener('change', apply)
      window.removeEventListener('orientationchange', onOrientationChange)
      if (orientTimeout !== undefined) clearTimeout(orientTimeout)
    }
  }, [])

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
  /** After the user picks "# of polls" from the select, do not override it on resize until full page load. */
  const pollsPerPageUserChosenRef = useRef(false)

  useEffect(() => {
    const maxOpt = maxPollsPerPageForWidth(typeof window !== 'undefined' ? window.innerWidth : 1200)
    setPollsPerPage((p) => (p > maxOpt ? maxOpt : p))
  }, [])

  /** Sparkline mode (1 poll): show timeline event labels by default; skip on portrait mobile (crowded). */
  useEffect(() => {
    if (pollsPerPage !== 1) return
    if (isPortraitMobileForEvents()) return
    setShowEventLabels(true)
  }, [pollsPerPage])

  const [eventViewportWidth, setEventViewportWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1200,
  )

  const pollsPerPageOptions = useMemo(
    () => Array.from({ length: maxPollsPerPageForWidth(eventViewportWidth) }, (_, i) => i + 1),
    [eventViewportWidth],
  )

  useEffect(() => {
    function handleResize() {
      const w = window.innerWidth
      if (!pollsPerPageUserChosenRef.current) {
        setPollsPerPage(getDefaultPollsPerPage())
        setPageIndex(0)
      } else {
        const cap = maxPollsPerPageForWidth(w)
        setPollsPerPage((p) => (p > cap ? cap : p))
      }
      setEventViewportWidth(w)
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
      const override = HEBREW_PARTY_DISPLAY_OVERRIDES[partyKey]
      if (override) return override
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

  const pollRollingReport = useMemo(
    () => buildRollingWindowReport(polls, pollSummaryWindowDays),
    [polls, pollSummaryWindowDays],
  )

  const pollSummaryNarrativePick = useMemo(() => pickPollSummaryNarrative(locale), [locale])
  const pollSummaryNarrativeAsOfDisplay = useMemo(() => {
    if (!pollSummaryNarrativePick?.asOfUtc) return undefined
    return dayjs(pollSummaryNarrativePick.asOfUtc).format(
      locale === 'he' ? 'DD/MM/YYYY' : 'M/D/YYYY',
    )
  }, [pollSummaryNarrativePick?.asOfUtc, locale])

  const minPollDateByOutlet = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of polls) {
      const cur = m.get(p.mediaOutlet)
      if (cur === undefined || p.date.localeCompare(cur) < 0) m.set(p.mediaOutlet, p.date)
    }
    return m
  }, [polls])

  /** False when this column is that outlet's earliest poll — deltas vs `previousVotes` are vs latest, not a real prior. */
  function hasPriorPollInSeries(poll: PollColumn): boolean {
    const minD = minPollDateByOutlet.get(poll.mediaOutlet)
    if (minD === undefined) return false
    return poll.date.localeCompare(minD) > 0
  }

  const totalPages = Math.max(1, Math.ceil(polls.length / pollsPerPage))
  const totalPagesRef = useRef(totalPages)
  totalPagesRef.current = totalPages
  const safePage = Math.min(pageIndex, totalPages - 1)
  const visiblePolls = polls.slice(
    safePage * pollsPerPage,
    (safePage + 1) * pollsPerPage,
  )
  const lpoHorizontalSyncKey = visiblePolls.map((p) => p.pollId).join(',')

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

  /** Sparklines + merged header only when the user sets "1 poll per page" — not when the last page has fewer polls than requested. */
  const showSparklines = pollsPerPage === 1
  const sparklineOutlet =
    showSparklines && visiblePolls[0] ? visiblePolls[0].mediaOutlet : null

  useEffect(() => {
    if (!showSparklines) setSparklineFocusedParty(null)
  }, [showSparklines])

  const displayedParties = useMemo(() => {
    if (!showSparklines || !sparklineFocusedParty) return allParties
    const row = allParties.find((p) => p.party === sparklineFocusedParty)
    return row ? [row] : allParties
  }, [allParties, showSparklines, sparklineFocusedParty])

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
      blocSeries: [] as BlocPollPoint[],
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
    for (const party of [...history.keys()]) {
      const debutStr = SPARKLINE_PARTY_DEBUT_DATE[party]
      if (!debutStr) continue
      const debut = dayjs(debutStr)
      if (!debut.isValid()) continue
      const arr = history.get(party)!
      history.set(
        party,
        arr.filter((pt) => {
          const t = dayjs(pt.date)
          return t.isValid() && !t.isBefore(debut, 'day')
        }),
      )
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
      const shortName = formatEventLabelForDisplay(row.eventName, 20, 'en-event-name')
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

    const blocByPoll = new Map<number, { date: string; coalition: number; opposition: number; arabs: number }>()
    for (const row of unpivot) {
      if (row.mediaOutlet !== sparklineOutlet) continue
      let rec = blocByPoll.get(row.pollId)
      if (!rec) {
        rec = { date: row.date, coalition: 0, opposition: 0, arabs: 0 }
        blocByPoll.set(row.pollId, rec)
      }
      const seg = segmentMap.get(row.party)?.segment ?? 'Opposition'
      if (seg === 'Coalition') rec.coalition += row.votes
      else if (seg === 'Opposition') rec.opposition += row.votes
      else if (seg === 'Arabs') rec.arabs += row.votes
    }
    const blocSeries: BlocPollPoint[] = Array.from(blocByPoll.entries())
      .map(([pollId, v]) => ({ pollId, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return { history, eventDates, enrichedEvents, timeRange: { minT, maxT }, blocSeries }
  }, [unpivot, events, majorEvents, sparklineOutlet, eventViewportWidth, segmentMap])

  const rowsRef = useRef<HTMLDivElement>(null)
  const lpoTableRef = useRef<HTMLDivElement>(null)
  const lpoBodyHScrollRef = useRef<HTMLDivElement>(null)
  const lpoOutletPageKeyRef = useRef<string>('')
  const [lpoHScrollLeft, setLpoHScrollLeft] = useState(0)
  const [lpoHScrollWidth, setLpoHScrollWidth] = useState(0)
  const lpoSwipeStartRef = useRef<{
    x0: number
    y0: number
    scrollLeft0: number
  } | null>(null)
  const headerEventsRef = useRef<HTMLDivElement>(null)
  const headerHbarsRef = useRef<HTMLDivElement>(null)
  const [overlayPos, setOverlayPos] = useState<{ left: number; width: number } | null>(null)
  /** Top/height of bloc chart vs `.lpo-header-events`, aligned to coalition→arabs bar tracks. */
  const [headerBlocBand, setHeaderBlocBand] = useState<{ top: number; height: number } | null>(null)

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

  const measureHeaderBlocBand = useCallback(() => {
    if (!showSparklines) {
      setHeaderBlocBand(null)
      return
    }
    const events = headerEventsRef.current
    const hbars = headerHbarsRef.current
    if (!events || !hbars) return
    const tracks = hbars.querySelectorAll('.lpo-hbar-track')
    if (tracks.length < 1) return
    const er = events.getBoundingClientRect()
    let trackTop = Infinity
    let trackBottom = -Infinity
    for (const node of tracks) {
      const r = node.getBoundingClientRect()
      trackTop = Math.min(trackTop, r.top)
      trackBottom = Math.max(trackBottom, r.bottom)
    }
    const top = trackTop - er.top
    const height = trackBottom - trackTop
    if (height > 2 && Number.isFinite(top) && Number.isFinite(height)) {
      setHeaderBlocBand({ top, height })
    }
  }, [showSparklines])

  useEffect(() => {
    if (!showSparklines) {
      setOverlayPos(null)
      setHeaderBlocBand(null)
      return
    }
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
      requestAnimationFrame(() => {
        alignHeaderEventsToSparkline()
        measureHeaderBlocBand()
        requestAnimationFrame(() => measureHeaderBlocBand())
      })
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
    const table = lpoTableRef.current
    if (table) ro.observe(table)
    return () => ro.disconnect()
  }, [
    showSparklines,
    allParties,
    eventViewportWidth,
    sparklineFocusedParty,
    combineArabsWithOpposition,
    alignHeaderEventsToSparkline,
    measureHeaderBlocBand,
    sparklineData.blocSeries.length,
  ])

  useLayoutEffect(() => {
    if (!showSparklines) {
      if (headerEventsRef.current) headerEventsRef.current.style.marginLeft = ''
      return
    }
    alignHeaderEventsToSparkline()
    measureHeaderBlocBand()
  }, [
    showSparklines,
    alignHeaderEventsToSparkline,
    measureHeaderBlocBand,
    sparklineData.enrichedEvents.length,
    sparklineData.blocSeries.length,
    overlayPos?.width,
    sparklineFocusedParty,
    combineArabsWithOpposition,
  ])

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

  const syncLpoHorizontalScrollMetrics = useCallback(() => {
    const el = lpoBodyHScrollRef.current
    if (!el) return
    setLpoHScrollLeft(el.scrollLeft)
    setLpoHScrollWidth(el.scrollWidth)
  }, [])

  useLayoutEffect(() => {
    const el = lpoBodyHScrollRef.current
    if (el && lpoHorizontalSyncKey !== lpoOutletPageKeyRef.current) {
      lpoOutletPageKeyRef.current = lpoHorizontalSyncKey
      el.scrollLeft = 0
    }
    syncLpoHorizontalScrollMetrics()
  }, [
    syncLpoHorizontalScrollMetrics,
    lpoHorizontalSyncKey,
    displayedParties.length,
    showSparklines,
    sparklineFocusedParty,
    loading,
  ])

  useEffect(() => {
    const el = lpoBodyHScrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => syncLpoHorizontalScrollMetrics())
    ro.observe(el)
    const inner = el.firstElementChild
    if (inner) ro.observe(inner)
    return () => ro.disconnect()
  }, [syncLpoHorizontalScrollMetrics, loading, lpoHorizontalSyncKey])

  const handleLpoTableTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (typeof window === 'undefined') return
    if (!shouldUseLpoSwipeGestures()) return
    if (totalPagesRef.current <= 1) return
    if (e.touches.length !== 1) return
    const touch = e.touches[0]
    const scrollHost = lpoBodyHScrollRef.current
    lpoSwipeStartRef.current = {
      x0: touch.clientX,
      y0: touch.clientY,
      scrollLeft0: scrollHost?.scrollLeft ?? 0,
    }
  }, [])

  const handleLpoTableTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (typeof window === 'undefined') return
    if (!shouldUseLpoSwipeGestures()) return
    const start = lpoSwipeStartRef.current
    lpoSwipeStartRef.current = null
    if (!start || e.changedTouches.length !== 1) return
    const maxPage = totalPagesRef.current - 1
    if (maxPage < 1) return
    const touch = e.changedTouches[0]
    const dx = touch.clientX - start.x0
    const dy = touch.clientY - start.y0
    const scrollHost = lpoBodyHScrollRef.current
    const scrollDelta = scrollHost ? Math.abs(scrollHost.scrollLeft - start.scrollLeft0) : 0
    const minSwipePx = 56
    const scrollIgnorePx = 14
    if (scrollDelta > scrollIgnorePx) return
    if (Math.abs(dx) < minSwipePx) return
    if (Math.abs(dx) < Math.abs(dy) * 1.25) return
    if (dx < 0) {
      setPageIndex((p) => Math.min(maxPage, p + 1))
    } else {
      setPageIndex((p) => Math.max(0, p - 1))
    }
  }, [])

  const handleLpoTableTouchCancel = useCallback(() => {
    lpoSwipeStartRef.current = null
  }, [])

  return (
    <section className="dashboard-frame">
      <div className="dashboard-heading dashboard-heading--lpo">
        <div className="dashboard-heading-sync-grid" dir="ltr">
          <div className="dashboard-heading-bar">
            <div className="dashboard-heading-locale-slot">
            <div className="dashboard-heading-left-stack" dir="ltr">
              <div
                className="locale-toggle dashboard-heading-locale-toggle"
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
            </div>
            </div>
            <h2 dir={locale === 'he' ? 'rtl' : 'ltr'}>
            {t.titleLatest}
            <strong>{t.titleElectionPolls}</strong>
            {t.titleOverview}
          </h2>
            <div className="dashboard-heading-actions">
            <div className="dashboard-heading-actions-stack">
              {showPollSummary ? (
                <button
                  type="button"
                  className="lpo-ps-nav-btn"
                  onClick={() => setShowPollSummary(false)}
                  aria-label={t.pollSummaryCloseAria}
                >
                  {t.pollSummaryPartiesDetailBtn}
                </button>
              ) : (
                <button
                  type="button"
                  className="lpo-ps-nav-btn"
                  onClick={() => setShowPollSummary(true)}
                  aria-label={t.pollSummaryOpenAria.replace(
                    /\{n\}/g,
                    String(pollSummaryWindowDays),
                  )}
                >
                  {t.pollSummaryOpenBtn}
                </button>
              )}
            </div>
            </div>
          </div>
          {!loading && showPollSummary ? (
            <div className="lpo-ps-heading-meta" dir="ltr">
              <BlocArabsToggle
                t={t}
                combineArabsWithOpposition={combineArabsWithOpposition}
                setCombineArabsWithOpposition={setCombineArabsWithOpposition}
              />
              <p
                className="lpo-ps-subtitle lpo-ps-subtitle--under-page-title"
                dir={locale === 'he' ? 'rtl' : 'ltr'}
              >
                {t.pollSummarySubtitle.replace(/\{n\}/g, String(pollSummaryWindowDays))}
              </p>
              <div className="lpo-ps-window-days-row">
                <label
                  className="lpo-ps-window-days-label"
                  dir={locale === 'he' ? 'rtl' : 'ltr'}
                >
                  <span>{t.pollSummaryWindowDaysLabel}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={MIN_POLL_SUMMARY_WINDOW_DAYS}
                    max={MAX_POLL_SUMMARY_WINDOW_DAYS}
                    step={1}
                    value={pollSummaryWindowDays}
                    aria-label={`${t.pollSummaryWindowDaysLabel}. ${t.pollSummaryWindowDaysAria}`}
                    onChange={(e) => {
                      const v = e.target.valueAsNumber
                      if (Number.isNaN(v)) return
                      setPollSummaryWindowDays(clampPollSummaryWindowDays(v))
                    }}
                    onBlur={(e) => {
                      const v = e.target.valueAsNumber
                      if (Number.isNaN(v)) {
                        setPollSummaryWindowDays(DEFAULT_POLL_SUMMARY_WINDOW_DAYS)
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          ) : null}
          {!loading && !showPollSummary ? (
            <div className="lpo-legend-row">
              <div className="lpo-toolbar-locale-stack">
                <BlocArabsToggle
                  t={t}
                  combineArabsWithOpposition={combineArabsWithOpposition}
                  setCombineArabsWithOpposition={setCombineArabsWithOpposition}
                />
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
                      <PaginationChevronIcon direction="prev" />
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
                      <PaginationChevronIcon direction="next" />
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
                  <label className="lpo-filter lpo-filter--page-count">
                    <div className="lpo-filter-top-row">
                      <span className="lpo-filter-label" id="lpo-polls-per-page-lbl">
                        {t.pollsPerPage}
                      </span>
                      <select
                        value={pollsPerPage}
                        title={t.pollsPerPageHint}
                        aria-labelledby="lpo-polls-per-page-lbl"
                        aria-describedby="lpo-polls-per-page-hint"
                        onChange={(e) => {
                          pollsPerPageUserChosenRef.current = true
                          setPollsPerPage(Number(e.target.value))
                          setPageIndex(0)
                        }}
                      >
                        {pollsPerPageOptions.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>
                    <span
                      id="lpo-polls-per-page-hint"
                      className="lpo-filter-hint"
                      title={t.pollsPerPageHint}
                    >
                      {t.pollsPerPageHint}
                    </span>
                  </label>
                </div>
            </div>
          ) : null}
        </div>
        {error && <p className="meta error">{error}</p>}
      </div>

      {loading ? (
        <p style={{ color: '#6b829e' }}>{t.loading}</p>
      ) : showPollSummary ? (
        <PollSummaryPanel
          rows={pollRollingReport.rows}
          summary={pollRollingReport.summary}
          locale={locale}
          t={t}
          maxStaleDays={pollSummaryWindowDays}
          combineArabsWithOpposition={combineArabsWithOpposition}
          displayMediaOutlet={displayMediaOutlet}
          displayParty={displayParty}
          narrativeBackground={pollSummaryNarrativePick?.background}
          narrativeTrendBullets={pollSummaryNarrativePick?.trendBullets}
          narrativeAsOfDisplay={pollSummaryNarrativeAsOfDisplay}
        />
      ) : visiblePolls.length === 0 ? (
        <p style={{ color: '#6b829e' }}>{t.noPolls}</p>
      ) : (
        <div
          ref={lpoTableRef}
          className={`lpo-table${showSparklines ? ' lpo-single-col' : ''}${showSparklines && sparklineFocusedParty ? ' lpo-sparkline-party-focus' : ''}`}
          style={{
            '--lpo-cols': visiblePolls.length,
          } as React.CSSProperties}
          onTouchStart={handleLpoTableTouchStart}
          onTouchEnd={handleLpoTableTouchEnd}
          onTouchCancel={handleLpoTableTouchCancel}
        >
          <div className="lpo-sticky-header-shell">
            <div className="lpo-header-sync-clip">
              <div
                className="lpo-header-sync-track"
                style={{
                  minWidth: '100%',
                  ...(lpoHScrollWidth > 0 ? { width: lpoHScrollWidth } : {}),
                  marginLeft: -lpoHScrollLeft,
                }}
              >
                {/* Header row */}
                <div className="lpo-header-row">
            {!showSparklines && (
              <div
                className={`lpo-party-label-col${visiblePolls.length > 1 ? ' lpo-party-label-col--bloc-legend' : ''}`}
              >
                {visiblePolls.length > 1 ? (
                  <div className="lpo-header-bloc-legend" aria-hidden>
                    <div className="lpo-bloc-legend-row lpo-bloc-legend-row--opposition">
                      <span className="lpo-bloc-legend-swatch" />
                      <span className="lpo-bloc-legend-text">
                        {t.opposition}
                      </span>
                    </div>
                    {!combineArabsWithOpposition ? (
                      <div className="lpo-bloc-legend-row lpo-bloc-legend-row--arabs">
                        <span className="lpo-bloc-legend-swatch" />
                        <span className="lpo-bloc-legend-text">{t.arabs}</span>
                      </div>
                    ) : null}
                    <div className="lpo-bloc-legend-row lpo-bloc-legend-row--coalition">
                      <span className="lpo-bloc-legend-swatch" />
                      <span className="lpo-bloc-legend-text">{t.coalition}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
            {visiblePolls.map((poll) => {
              const prevDate = getPreviousDate(poll.mediaOutlet)
              const showDeltaVsPrior = hasPriorPollInSeries(poll)
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
              const prevArabs = previousVotes.get(poll.mediaOutlet)
                ? Array.from(previousVotes.get(poll.mediaOutlet)!.entries())
                    .filter(([p]) => segmentMap.get(p)?.segment === 'Arabs')
                    .reduce((s, [, v]) => s + v, 0)
                : null
              const arabsChange = prevArabs !== null ? poll.arabsTotal - prevArabs : null
              const prevCombinedAnti =
                prevOpposition !== null && prevArabs !== null
                  ? prevOpposition + prevArabs
                  : null
              const oppPlusArabs = poll.oppositionTotal + poll.arabsTotal
              const combinedOppChange =
                combineArabsWithOpposition && prevCombinedAnti !== null
                  ? oppPlusArabs - prevCombinedAnti
                  : null
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
                          <div className="lpo-hbars" ref={headerHbarsRef}>
                            <div className="lpo-hbar-sixty-line-global" aria-hidden title="60" />
                            <span className="lpo-hbar-label">{t.coalition}</span>
                            <div className="lpo-hbar-track">
                              <div className="lpo-hbar-fill" style={{ width: `${(poll.coalitionTotal / 120) * 100}%`, background: SEGMENT_COLORS.Coalition }} />
                              <div
                                className="lpo-hbar-end-meta"
                                style={{ left: `${(poll.coalitionTotal / 120) * 100}%` }}
                              >
                                <strong className="lpo-hbar-value" style={{ color: SEGMENT_COLORS.Coalition }}>{poll.coalitionTotal}</strong>
                                {showDeltaVsPrior && coalChange !== null && coalChange !== 0 ? (
                                  <>
                                    <span className="lpo-vote-change-spacer" aria-hidden>{'\u0020'}</span>
                                    <span className={`lpo-change-badge ${coalChange > 0 ? 'up' : 'down'}`}>
                                      {coalChange > 0 ? '↗' : '↘'}
                                      {Math.abs(coalChange)}
                                    </span>
                                  </>
                                ) : null}
                              </div>
                            </div>
                            <span className="lpo-hbar-label">
                              {t.opposition}
                            </span>
                            <div className="lpo-hbar-track">
                              {combineArabsWithOpposition && oppPlusArabs > 0 ? (
                                <div
                                  className="lpo-hbar-fill lpo-hbar-fill-combo"
                                  style={{ width: `${(oppPlusArabs / 120) * 100}%` }}
                                >
                                  {poll.oppositionTotal > 0 ? (
                                    <div
                                      className={
                                        'lpo-hbar-fill-combo-seg ' +
                                        (poll.arabsTotal === 0
                                          ? 'lpo-hbar-fill-combo-seg--only'
                                          : 'lpo-hbar-fill-combo-seg--first')
                                      }
                                      style={{
                                        flex: `0 0 ${(poll.oppositionTotal / oppPlusArabs) * 100}%`,
                                        background: SEGMENT_COLORS.Opposition,
                                      }}
                                    />
                                  ) : null}
                                  {poll.arabsTotal > 0 ? (
                                    <div
                                      className={
                                        'lpo-hbar-fill-combo-seg ' +
                                        (poll.oppositionTotal === 0
                                          ? 'lpo-hbar-fill-combo-seg--only'
                                          : 'lpo-hbar-fill-combo-seg--last')
                                      }
                                      style={{
                                        flex: `0 0 ${(poll.arabsTotal / oppPlusArabs) * 100}%`,
                                        background: SEGMENT_COLORS.Opposition,
                                      }}
                                    />
                                  ) : null}
                                </div>
                              ) : (
                                <div
                                  className="lpo-hbar-fill"
                                  style={{
                                    width: `${(poll.oppositionTotal / 120) * 100}%`,
                                    background: SEGMENT_COLORS.Opposition,
                                  }}
                                />
                              )}
                              <div
                                className="lpo-hbar-end-meta"
                                style={{
                                  left: `${((combineArabsWithOpposition ? oppPlusArabs : poll.oppositionTotal) / 120) * 100}%`,
                                }}
                              >
                                <strong className="lpo-hbar-value" style={{ color: '#e1e8f2' }}>
                                  {combineArabsWithOpposition ? oppPlusArabs : poll.oppositionTotal}
                                </strong>
                                {showDeltaVsPrior && !combineArabsWithOpposition && oppChange !== null && oppChange !== 0 ? (
                                  <>
                                    <span className="lpo-vote-change-spacer" aria-hidden>{'\u0020'}</span>
                                    <span className={`lpo-change-badge ${oppChange > 0 ? 'up' : 'down'}`}>
                                      {oppChange > 0 ? '↗' : '↘'}
                                      {Math.abs(oppChange)}
                                    </span>
                                  </>
                                ) : null}
                                {showDeltaVsPrior && combineArabsWithOpposition && combinedOppChange !== null && combinedOppChange !== 0 ? (
                                  <>
                                    <span className="lpo-vote-change-spacer" aria-hidden>{'\u0020'}</span>
                                    <span className={`lpo-change-badge ${combinedOppChange > 0 ? 'up' : 'down'}`}>
                                      {combinedOppChange > 0 ? '↗' : '↘'}
                                      {Math.abs(combinedOppChange)}
                                    </span>
                                  </>
                                ) : null}
                              </div>
                            </div>
                            {!combineArabsWithOpposition ? (
                              <>
                                <span className="lpo-hbar-label">{t.arabs}</span>
                                <div className="lpo-hbar-track">
                                  <div className="lpo-hbar-fill" style={{ width: `${(poll.arabsTotal / 120) * 100}%`, background: SEGMENT_COLORS.Arabs }} />
                                  <div
                                    className="lpo-hbar-end-meta"
                                    style={{ left: `${(poll.arabsTotal / 120) * 100}%` }}
                                  >
                                    <strong className="lpo-hbar-value" style={{ color: SEGMENT_COLORS.Arabs }}>{poll.arabsTotal}</strong>
                                    {showDeltaVsPrior && arabsChange !== null && arabsChange !== 0 ? (
                                      <>
                                        <span className="lpo-vote-change-spacer" aria-hidden>{'\u0020'}</span>
                                        <span className={`lpo-change-badge ${arabsChange > 0 ? 'up' : 'down'}`}>
                                          {arabsChange > 0 ? '↗' : '↘'}
                                          {Math.abs(arabsChange)}
                                        </span>
                                      </>
                                    ) : null}
                                  </div>
                                </div>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <div
                        ref={headerEventsRef}
                        className={`lpo-header-events${overlayPos ? ' lpo-header-events--sized' : ''}`}
                        style={overlayPos ? { width: overlayPos.width } : undefined}
                      >
                        <button
                          type="button"
                          className={`lpo-event-labels-toggle lpo-event-labels-toggle--bloc-header${showEventLabels ? ' lpo-event-labels-toggle--on' : ''}`}
                          aria-pressed={showEventLabels}
                          aria-label={t.eventLabelsToggleAria}
                          onClick={() => setShowEventLabels((v) => !v)}
                        >
                          {t.eventLabelsToggle}
                        </button>
                        <HeaderBlocSparklineBundle
                          series={sparklineData.blocSeries}
                          minT={minT}
                          maxT={maxT}
                          currentPollDate={poll.date}
                          band={headerBlocBand}
                          t={t}
                          locale={locale}
                          combineArabsWithOpposition={combineArabsWithOpposition}
                        />
                        {showEventLabels
                          ? sparklineData.enrichedEvents.map((ev) => {
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
                            })
                          : null}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="lpo-col-header-media-row">
                        <div className="lpo-col-media-icon">
                          <IconWithFallback
                            src={MEDIA_ICON_MAP[poll.mediaOutlet]}
                            label={displayMediaOutlet(poll.mediaOutlet)}
                          />
                        </div>
                        <div className="lpo-col-header-text-block">
                          <div className="lpo-col-media-name">
                            {displayMediaOutlet(poll.mediaOutlet)}
                          </div>
                          <div className="lpo-col-date">
                            {t.latestPrefix}{' '}
                            <strong>
                              {dayjs(poll.date).format(locale === 'he' ? 'DD/MM/YYYY' : 'M/D/YYYY')}
                            </strong>
                          </div>
                          {showDeltaVsPrior && prevDate && (
                            <div className="lpo-col-prev-date">
                              {t.previousDate}{' '}
                              {dayjs(prevDate).format(locale === 'he' ? 'DD/MM/YYYY' : 'MMM-DD-YYYY')}
                            </div>
                          )}
                        </div>
                      </div>
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
                              <span className="lpo-total-label">
                                {t.opposition}
                              </span>
                              <span className="lpo-total-figures">
                                <strong>{combineArabsWithOpposition ? oppPlusArabs : poll.oppositionTotal}</strong>
                                {showDeltaVsPrior && combineArabsWithOpposition && combinedOppChange !== null && combinedOppChange !== 0 ? (
                                  <>
                                    <span className="lpo-vote-change-spacer" aria-hidden>{'\u0020'}</span>
                                    <span className={`lpo-change ${combinedOppChange > 0 ? 'up' : 'down'}`}>
                                      {combinedOppChange > 0 ? '↗' : '↘'}
                                      {Math.abs(combinedOppChange)}
                                    </span>
                                  </>
                                ) : null}
                                {showDeltaVsPrior && !combineArabsWithOpposition && oppChange !== null && oppChange !== 0 ? (
                                  <>
                                    <span className="lpo-vote-change-spacer" aria-hidden>{'\u0020'}</span>
                                    <span className={`lpo-change ${oppChange > 0 ? 'up' : 'down'}`}>
                                      {oppChange > 0 ? '↗' : '↘'}
                                      {Math.abs(oppChange)}
                                    </span>
                                  </>
                                ) : null}
                              </span>
                            </span>
                            <span className="lpo-total coalition">
                              <span className="lpo-total-label">{t.coalition}</span>
                              <span className="lpo-total-figures"><strong>{poll.coalitionTotal}</strong>{showDeltaVsPrior && coalChange !== null && coalChange !== 0 ? <><span className="lpo-vote-change-spacer" aria-hidden>{'\u0020'}</span><span className={`lpo-change ${coalChange > 0 ? 'up' : 'down'}`}>{coalChange > 0 ? '↗' : '↘'}{Math.abs(coalChange)}</span></> : null}</span>
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="lpo-total coalition">
                              <span className="lpo-total-label">{t.coalition}</span>
                              <span className="lpo-total-figures"><strong>{poll.coalitionTotal}</strong>{showDeltaVsPrior && coalChange !== null && coalChange !== 0 ? <><span className="lpo-vote-change-spacer" aria-hidden>{'\u0020'}</span><span className={`lpo-change ${coalChange > 0 ? 'up' : 'down'}`}>{coalChange > 0 ? '↗' : '↘'}{Math.abs(coalChange)}</span></> : null}</span>
                            </span>
                            <span className="lpo-total opposition">
                              <span className="lpo-total-label">
                                {t.opposition}
                              </span>
                              <span className="lpo-total-figures">
                                <strong>{combineArabsWithOpposition ? oppPlusArabs : poll.oppositionTotal}</strong>
                                {showDeltaVsPrior && combineArabsWithOpposition && combinedOppChange !== null && combinedOppChange !== 0 ? (
                                  <>
                                    <span className="lpo-vote-change-spacer" aria-hidden>{'\u0020'}</span>
                                    <span className={`lpo-change ${combinedOppChange > 0 ? 'up' : 'down'}`}>
                                      {combinedOppChange > 0 ? '↗' : '↘'}
                                      {Math.abs(combinedOppChange)}
                                    </span>
                                  </>
                                ) : null}
                                {showDeltaVsPrior && !combineArabsWithOpposition && oppChange !== null && oppChange !== 0 ? (
                                  <>
                                    <span className="lpo-vote-change-spacer" aria-hidden>{'\u0020'}</span>
                                    <span className={`lpo-change ${oppChange > 0 ? 'up' : 'down'}`}>
                                      {oppChange > 0 ? '↗' : '↘'}
                                      {Math.abs(oppChange)}
                                    </span>
                                  </>
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
                                ...(combineArabsWithOpposition
                                  ? { background: SEGMENT_COLORS.Opposition }
                                  : {}),
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
                              style={{
                                width: `${(poll.arabsTotal / 120) * 100}%`,
                                left: `${(poll.coalitionTotal / 120) * 100}%`,
                                ...(combineArabsWithOpposition
                                  ? { background: SEGMENT_COLORS.Opposition }
                                  : {}),
                              }}
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
              </div>
            </div>
          </div>

          {showSparklines && sparklineFocusedParty ? (
            <div className="lpo-party-focus-banner">
              <button
                type="button"
                className="lpo-party-focus-back"
                onClick={() => setSparklineFocusedParty(null)}
              >
                {t.backToAllParties}
              </button>
              <span className="lpo-party-focus-current">{displayParty(sparklineFocusedParty)}</span>
            </div>
          ) : null}

          {/* Party rows with event line overlay in sparkline mode */}
          <div
            ref={lpoBodyHScrollRef}
            className="lpo-body-hscroll"
            onScroll={(e) => setLpoHScrollLeft(e.currentTarget.scrollLeft)}
          >
            <div ref={rowsRef} className="lpo-rows-container" style={{ position: 'relative' }}>
            {showSparklines && overlayPos && showEventLabels && (() => {
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
            {displayedParties.map((partyInfo, rowIdx) => (
              <div key={partyInfo.party} style={{ display: 'contents' }}>
                <div
                  className={`lpo-party-row${rowIdx % 2 === 1 ? ' lpo-party-row--alt' : ''}${showSparklines && !sparklineFocusedParty ? ' lpo-party-row--sparkline-selectable' : ''}`}
                  role={showSparklines && !sparklineFocusedParty ? 'button' : undefined}
                  tabIndex={showSparklines && !sparklineFocusedParty ? 0 : undefined}
                  aria-label={showSparklines && !sparklineFocusedParty ? `${t.sparklineRowFocusAria}: ${displayParty(partyInfo.party)}` : undefined}
                  onClick={
                    showSparklines && !sparklineFocusedParty
                      ? () => setSparklineFocusedParty(partyInfo.party)
                      : undefined
                  }
                  onKeyDown={
                    showSparklines && !sparklineFocusedParty
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setSparklineFocusedParty(partyInfo.party)
                          }
                        }
                      : undefined
                  }
                >
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
                  const change = hasPriorPollInSeries(poll)
                    ? getChange(poll.mediaOutlet, partyInfo.party, votes)
                    : null

                  const partyHistory = showSparklines ? sparklineData.history.get(partyInfo.party) : undefined
                  const barPct = maxVotes > 0 ? (votes / maxVotes) * 100 : 0
                  const partyBarColor = segmentDisplayColor(segment, combineArabsWithOpposition)

                  return (
                    <div key={poll.pollId} className={`lpo-party-cell${showSparklines ? ' lpo-has-sparkline' : ''}`}>
                      <div className="lpo-bar-row">
                        <div className="lpo-bar-track">
                          <div
                            className="lpo-bar-fill"
                            style={{
                              width: `${barPct}%`,
                              background: partyBarColor,
                            }}
                          />
                          <div
                            className="lpo-bar-end-meta"
                            style={{ left: `${barPct}%` }}
                          ><strong className="lpo-votes" style={{ color: partyBarColor }}>{votes}</strong>{change ? <><span className="lpo-vote-change-spacer" aria-hidden>{'\u0020'}</span><span className={`lpo-change-badge ${change.direction}`}>{change.direction === 'up' ? '↗' : '↘'}{change.value}</span></> : null}</div>
                        </div>
                      </div>
                    {showSparklines && partyHistory && partyHistory.length >= 2 && (
                      <Sparkline
                        data={partyHistory}
                        eventDates={showEventLabels ? sparklineData.eventDates : []}
                        color={partyBarColor}
                        globalMinT={sparklineData.timeRange.minT}
                        globalMaxT={sparklineData.timeRange.maxT}
                        seatsLabel={t.seats}
                      />
                    )}
                    </div>
                  )
                })}
                </div>
                {showSparklines && sparklineFocusedParty === partyInfo.party ? (
                  <div className="lpo-party-focus-hint-row">
                    <p className="lpo-party-focus-hint">{t.sparklineFocusPollHint}</p>
                  </div>
                ) : null}
              </div>
            ))}
            </div>
          </div>
        </div>
      )}

      {!showPollSummary ? (
        <div className="pagination-controls" style={{ marginTop: '1rem' }}>
          <button
            type="button"
            className="icon-pagination-btn icon-pagination-btn--footer"
            disabled={safePage === 0}
            aria-label={t.previousBtn}
            onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
          >
            <PaginationChevronIcon direction="prev" />
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
            <PaginationChevronIcon direction="next" />
          </button>
        </div>
      ) : null}
    </section>
  )
}
