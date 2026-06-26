import dayjs from 'dayjs'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { AppLocale } from '../i18n/localeContext'
import type { UiStrings } from '../i18n/strings'
import { PARTY_ICON_MAP } from '../config/mappings'
import type { PartyTrendPoint } from '../lib/partyOutletTrendSeries'
import { IconWithFallback } from './IconWithFallback'

export type PartyTrendLine = {
  party: string
  partyDisplay: string
  color: string
  data: PartyTrendPoint[]
}

type ChartLine = PartyTrendLine & {
  ts: number[]
  vals: number[]
  pathD: string
  latestExtrema: {
    maxV: number
    maxIdx: number
    recentIdx: number
    recentV: number
    flat: boolean
  } | null
}

function MultiPartyOutletTrendChart({
  lines,
  dateFmt,
  seatsLabel,
  maxLabel,
  recentLabel,
}: {
  lines: PartyTrendLine[]
  dateFmt: string
  seatsLabel: string
  maxLabel: string
  recentLabel: string
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<{ x: number; y: number; cursorT: number } | null>(null)

  const W = 420
  const H = 72
  const pad = { t: 16, b: 8, l: 6, r: 6 }
  const cw = W - pad.l - pad.r
  const ch = H - pad.t - pad.b

  const { minT, maxT, minV, maxV, chartLines, minDateLabel, maxDateLabel } = useMemo(() => {
    const allTs = lines.flatMap((l) => l.data.map((d) => new Date(d.date).getTime()))
    const allVals = lines.flatMap((l) => l.data.map((d) => d.votes))
    const minT = allTs.length ? Math.min(...allTs) : 0
    const maxT = allTs.length ? Math.max(...allTs) : 1
    const minV = allVals.length ? Math.min(...allVals) : 0
    const maxV = allVals.length ? Math.max(...allVals) : 1
    const rangeT = maxT - minT || 1
    const vPad = 1
    const fullRange = maxV + vPad - (minV - vPad) || 1

    const toX = (t: number) => pad.l + ((t - minT) / rangeT) * cw
    const toY = (v: number) => pad.t + ch - ((v - (minV - vPad)) / fullRange) * ch

    const chartLines: ChartLine[] = lines.map((line) => {
      const ts = line.data.map((d) => new Date(d.date).getTime())
      const vals = line.data.map((d) => d.votes)
      let pathD = ''
      for (let i = 0; i < line.data.length; i++) {
        const px = toX(ts[i]!)
        const py = toY(vals[i]!)
        pathD += i === 0 ? `M${px},${py}` : `H${px}V${py}`
      }

      let latestExtrema: ChartLine['latestExtrema'] = null
      if (vals.length >= 1) {
        const lineMax = Math.max(...vals)
        const lineMin = Math.min(...vals)
        let maxIdx = 0
        for (let i = vals.length - 1; i >= 0; i--) {
          if (vals[i] === lineMax) {
            maxIdx = i
            break
          }
        }
        const recentIdx = vals.length - 1
        latestExtrema = {
          maxV: lineMax,
          maxIdx,
          recentIdx,
          recentV: vals[recentIdx]!,
          flat: lineMax === lineMin,
        }
      }

      return { ...line, ts, vals, pathD, latestExtrema }
    })

    const sortedDates = [...new Set(lines.flatMap((l) => l.data.map((d) => d.date)))].sort()
    const minDateLabel = sortedDates[0]
      ? dayjs(sortedDates[0]).format(dateFmt)
      : ''
    const maxDateLabel = sortedDates[sortedDates.length - 1]
      ? dayjs(sortedDates[sortedDates.length - 1]).format(dateFmt)
      : ''

    return { minT, maxT, minV, maxV, chartLines, minDateLabel, maxDateLabel }
  }, [lines, dateFmt, cw, ch, pad.l, pad.t, pad.b])

  const rangeT = maxT - minT || 1
  const vPad = 1
  const fullRange = maxV + vPad - (minV - vPad) || 1

  const toX = useCallback(
    (t: number) => pad.l + ((t - minT) / rangeT) * cw,
    [minT, rangeT, cw, pad.l],
  )
  const toY = useCallback(
    (v: number) => pad.t + ch - ((v - (minV - vPad)) / fullRange) * ch,
    [minV, vPad, fullRange, ch, pad.t],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const ratio = (e.clientX - rect.left) / rect.width
      const cursorT = minT + ratio * rangeT
      setHover({ x: e.clientX, y: e.clientY, cursorT })
    },
    [minT, rangeT],
  )

  const handleMouseLeave = useCallback(() => setHover(null), [])

  const hoverSnap = useMemo(() => {
    if (!hover) return null
    const { cursorT } = hover
    let bestDist = Infinity
    let snapT = cursorT
    for (const line of chartLines) {
      for (const t of line.ts) {
        const dist = Math.abs(t - cursorT)
        if (dist < bestDist) {
          bestDist = dist
          snapT = t
        }
      }
    }
    const entries = chartLines
      .map((line) => {
        let best = 0
        let bestDist = Infinity
        for (let i = 0; i < line.ts.length; i++) {
          const dist = Math.abs(line.ts[i]! - snapT)
          if (dist < bestDist) {
            bestDist = dist
            best = i
          }
        }
        if (bestDist > rangeT * 0.08) return null
        return {
          partyDisplay: line.partyDisplay,
          color: line.color,
          votes: line.vals[best]!,
          date: line.data[best]!.date,
          vx: toX(line.ts[best]!),
          vy: toY(line.vals[best]!),
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
    if (entries.length === 0) return null
    return { snapT, entries, x: hover.x, y: hover.y }
  }, [hover, chartLines, rangeT, toX, toY])

  const hasMultiPointLine = chartLines.some((l) => l.data.length >= 2)
  const showStartIcons = chartLines.length > 1

  /** Multi-party: only the highest recent seat count gets the end label (avoids stack at max date). */
  const recentLabelParty = useMemo(() => {
    if (chartLines.length <= 1) return null
    let bestParty: string | null = null
    let bestV = -Infinity
    for (const line of chartLines) {
      const v = line.latestExtrema?.recentV
      if (v === undefined) continue
      if (
        bestParty === null ||
        v > bestV ||
        (v === bestV && line.party.localeCompare(bestParty) < 0)
      ) {
        bestV = v
        bestParty = line.party
      }
    }
    return bestParty
  }, [chartLines])

  const showRecentLabel = useCallback(
    (party: string) => chartLines.length <= 1 || party === recentLabelParty,
    [chartLines.length, recentLabelParty],
  )

  return (
    <div className="lpo-ps-trend-chart">
      <div
        ref={wrapRef}
        className="lpo-ps-trend-chart-plot"
        onMouseMove={hasMultiPointLine ? handleMouseMove : undefined}
        onMouseLeave={hasMultiPointLine ? handleMouseLeave : undefined}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          overflow="visible"
          className="lpo-ps-trend-chart-svg"
          aria-hidden
        >
          {chartLines.map((line) =>
            line.data.length >= 2 ? (
              <path
                key={line.party}
                d={line.pathD}
                fill="none"
                stroke={line.color}
                strokeWidth={1.2}
                vectorEffect="non-scaling-stroke"
              />
            ) : null,
          )}
          {hoverSnap ? (
            <line
              x1={toX(hoverSnap.snapT)}
              y1={pad.t}
              x2={toX(hoverSnap.snapT)}
              y2={H - pad.b}
              stroke="rgba(255,255,255,0.35)"
              strokeWidth={0.8}
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
        </svg>
        {showStartIcons
          ? chartLines.map((line) => {
              if (line.data.length === 0) return null
              const singlePoint = line.data.length === 1
              const cx = singlePoint ? pad.l + cw / 2 : toX(line.ts[0]!)
              const cy = toY(line.vals[0]!)
              return (
                <span
                  key={`start-icon-${line.party}`}
                  className="lpo-ps-trend-line-start-icon"
                  style={{
                    left: `${(cx / W) * 100}%`,
                    top: `${(cy / H) * 100}%`,
                    '--lpo-ps-trend-line-color': line.color,
                  } as React.CSSProperties}
                  title={line.partyDisplay}
                  aria-hidden
                >
                  <IconWithFallback
                    src={PARTY_ICON_MAP[line.party]}
                    label={line.partyDisplay}
                  />
                </span>
              )
            })
          : null}
        {chartLines.map((line) => {
          if (line.data.length === 0) return null
          const i = line.data.length - 1
          const singlePoint = line.data.length === 1
          return (
            <span
              key={`dot-${line.party}`}
              className="lpo-ps-trend-latest-dot"
              style={{
                left: `${((singlePoint ? pad.l + cw / 2 : toX(line.ts[i]!)) / W) * 100}%`,
                top: `${(toY(line.vals[i]!) / H) * 100}%`,
                backgroundColor: line.color,
              }}
              aria-hidden
            />
          )
        })}
        {hoverSnap?.entries.map((e) => (
          <span
            key={e.partyDisplay}
            className="lpo-ps-trend-hover-dot"
            style={{
              left: `${(e.vx / W) * 100}%`,
              top: `${(e.vy / H) * 100}%`,
            }}
            aria-hidden
          />
        ))}
        {chartLines.map((line) => {
          if (!line.latestExtrema || line.data.length === 0) return null
          const { latestExtrema } = line
          return (
            <span key={`labels-${line.party}`}>
              {!latestExtrema.flat &&
              latestExtrema.maxIdx !== latestExtrema.recentIdx ? (
                <span
                  className="lpo-ps-trend-vote-label lpo-ps-trend-vote-label--max"
                  style={{
                    left: `${(toX(line.ts[latestExtrema.maxIdx]!) / W) * 100}%`,
                    top: `${(toY(line.vals[latestExtrema.maxIdx]!) / H) * 100}%`,
                    color: line.color,
                  }}
                  title={`${line.data[latestExtrema.maxIdx]!.date} · ${line.partyDisplay} · ${maxLabel} ${latestExtrema.maxV} ${seatsLabel}`}
                >
                  <span className="lpo-ps-trend-vote-label-tag">{maxLabel}</span>
                  {latestExtrema.maxV}
                </span>
              ) : null}
              {showRecentLabel(line.party) ? (
                <span
                  className="lpo-ps-trend-vote-label lpo-ps-trend-vote-label--recent"
                  style={{
                    left: `${(toX(line.ts[latestExtrema.recentIdx]!) / W) * 100}%`,
                    top: `${(toY(line.vals[latestExtrema.recentIdx]!) / H) * 100}%`,
                    color: line.color,
                  }}
                  title={`${line.data[latestExtrema.recentIdx]!.date} · ${line.partyDisplay} · ${recentLabel} ${latestExtrema.recentV} ${seatsLabel}`}
                >
                  {latestExtrema.maxIdx === latestExtrema.recentIdx &&
                  !latestExtrema.flat ? (
                    <span className="lpo-ps-trend-vote-label-tag">{maxLabel}</span>
                  ) : (
                    <span className="lpo-ps-trend-vote-label-tag">{recentLabel}</span>
                  )}
                  {latestExtrema.recentV}
                </span>
              ) : null}
            </span>
          )
        })}
        {hoverSnap &&
          createPortal(
            <div
              className="lpo-sparkline-tooltip lpo-ps-trend-hover-tooltip"
              style={{ left: hoverSnap.x, top: hoverSnap.y }}
            >
              {hoverSnap.entries.map((e) => (
                <div key={e.partyDisplay} className="lpo-ps-trend-hover-row">
                  <strong style={{ color: e.color }}>{e.votes}</strong>{' '}
                  {e.partyDisplay}
                </div>
              ))}
              <span className="lpo-sparkline-tooltip-date">
                {dayjs(hoverSnap.entries[0]!.date).format(dateFmt)}
              </span>
            </div>,
            document.body,
          )}
      </div>
      <div className="lpo-ps-trend-chart-axis" dir="ltr">
        <span>{minDateLabel}</span>
        <span>{maxDateLabel}</span>
      </div>
    </div>
  )
}

export function PartyOutletTrendPanel({
  open,
  onClose,
  outletDisplay,
  lines,
  locale,
  t,
  noDataMessage,
}: {
  open: boolean
  onClose: () => void
  outletDisplay: string
  lines: PartyTrendLine[]
  locale: AppLocale
  t: UiStrings
  noDataMessage?: string
}) {
  const panelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const partyNames = lines.map((l) => l.partyDisplay).join(', ')
  const ariaTitle = t.pollSummaryPartyTrendPanelAria
    .replace(/\{outlet\}/g, outletDisplay)
    .replace(/\{parties\}/g, partyNames)

  const hasData = lines.some((l) => l.data.length > 0)

  return (
    <section
      ref={panelRef}
      className="lpo-ps-trend-panel"
      aria-label={ariaTitle}
    >
      <header className="lpo-ps-trend-panel-header">
        <div className="lpo-ps-trend-panel-titles">
          <h2 className="lpo-ps-trend-panel-outlet">{outletDisplay}</h2>
          <p className="lpo-ps-trend-panel-hint">{t.pollSummaryPartyTrendPanelHint}</p>
        </div>
        <button
          type="button"
          className="lpo-ps-trend-panel-back"
          onClick={onClose}
          aria-label={t.pollSummaryPartyTrendBackAria}
        >
          {t.pollSummaryPartyTrendBackBtn}
        </button>
      </header>
      {lines.length > 0 ? (
        <ul className="lpo-ps-trend-panel-legend" aria-label={t.pollSummaryPartyTrendLegendAria}>
          {lines.map((line) => (
            <li key={line.party} className="lpo-ps-trend-panel-legend-item">
              <span
                className="lpo-ps-trend-panel-legend-ring"
                style={{ boxShadow: `inset 0 0 0 2px ${line.color}` }}
              >
                <IconWithFallback src={PARTY_ICON_MAP[line.party]} label={line.partyDisplay} />
              </span>
              <span className="lpo-ps-trend-panel-legend-name">{line.partyDisplay}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {!hasData ? (
        <p className="lpo-ps-trend-popup-empty">
          {noDataMessage ?? t.pollSummaryPartyTrendNoData}
        </p>
      ) : (
        <MultiPartyOutletTrendChart
          lines={lines.filter((l) => l.data.length > 0)}
          dateFmt={locale === 'he' ? 'DD/MM/YYYY' : 'M/D/YYYY'}
          seatsLabel={t.seats}
          maxLabel={t.pollSummaryPartyTrendMaxLabel}
          recentLabel={t.pollSummaryPartyTrendRecentLabel}
        />
      )}
    </section>
  )
}

/** @deprecated use PartyOutletTrendPanel — kept for import stability during migration */
export const PartyOutletTrendPopup = PartyOutletTrendPanel
