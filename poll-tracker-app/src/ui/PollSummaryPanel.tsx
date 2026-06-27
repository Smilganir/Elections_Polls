import dayjs from 'dayjs'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { AppLocale } from '../i18n/localeContext'
import type { UiStrings } from '../i18n/strings'
import {
  MEDIA_ICON_MAP,
  PARTY_ICON_MAP,
  SEGMENT_COLORS,
  segmentRingColorForSummary,
} from '../config/mappings'
import {
  type ChangedParty,
  type RollingPoll,
  type RollingWindowRow,
  buildCrossOutletAverageChipRow,
  evaluatePartySeatColumnOutlier,
  partyColumnSeatStats,
  summaryFromRollingRows,
} from '../lib/pollRollingWindow'
import type { Segment } from '../types/data'
import { buildPartyOutletTrendSeries } from '../lib/partyOutletTrendSeries'
import { blocTrendLineColors, segmentForPartyKey } from '../lib/partyTrendLineColors'
import {
  generatePollSummaryOutlierBullet,
} from '../lib/generatePollSummaryTrendBullets'
import { resolvePollSummaryNarrativeAsOfDisplay } from '../content/pickPollSummaryNarrative'
import { IconWithFallback } from './IconWithFallback'
import { narrativeHtmlWithBlocHighlights } from './pollNarrativeHtml'
import { PartyOutletTrendPanel } from './PartyOutletTrendPopup'
import {
  PollSummaryHeroPartiesChartButton,
  PollSummaryHeroPartiesChartPopup,
} from './PollSummaryHeroPartiesChartPopup'
import { mediaBiasAppUrl } from '../utils/publicUrl'
import { DeltaBadge, PollSummaryHeroBlocBar, PsSegmentBar } from './PollSummaryBlocBar'

type TrendFocus = { outlet: string; parties: string[] }

/** Minimum width reserved for the horizontally scrollable party columns. */
const UNIFIED_PARTIES_COL_MIN_PX = 112

function cappedUnifiedFixedWidthPx(measuredWidth: number, containerWidth: number): number {
  if (containerWidth <= 0) return measuredWidth
  const maxFixed = Math.max(168, containerWidth - UNIFIED_PARTIES_COL_MIN_PX)
  return Math.min(measuredWidth, maxFixed)
}

function applyUnifiedFixedMeasuredWidth(
  measureEl: HTMLElement,
  wrap: HTMLElement,
  psWrap: HTMLElement | null | undefined,
): void {
  const containerW = wrap.clientWidth || psWrap?.clientWidth || 0
  const w = cappedUnifiedFixedWidthPx(measureEl.offsetWidth, containerW)
  const px = `${w}px`
  wrap.style.setProperty('--lpo-ps-unified-fixed-measured-w', px)
  psWrap?.style.setProperty('--lpo-ps-unified-fixed-measured-w', px)
}

function formatChipNum(n: number): string {
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

/** Hero average Δ — one decimal when needed (matches seat averages). */
function formatChipSeatDeltaMagnitude(delta: number): string {
  return formatChipNum(Math.abs(delta))
}

function formatDeltaSigned(delta: number): string {
  const sign = delta > 0 ? '+' : delta < 0 ? '-' : ''
  return `${sign}${formatChipNum(Math.abs(delta))}`
}

/** Force a plain title tooltip line to render right-to-left (mean left, stdev right). */
function tooltipRtlLine(text: string): string {
  return `\u2067${text}\u2069`
}

/** Force a plain title tooltip line to render left-to-right. */
function tooltipLtrLine(text: string): string {
  return `\u2066${text}\u2069`
}

function formatStdevTooltipLine(
  t: UiStrings,
  locale: AppLocale,
  stdevOutlier: ReturnType<typeof evaluatePartySeatColumnOutlier>,
): string {
  const sigmaStr = formatChipNum(stdevOutlier.sigmaMultiple)
  const meanStr = formatChipNum(stdevOutlier.mean)
  const high = stdevOutlier.direction === 'high'

  if (locale === 'he') {
    const verb = high ? 'מעל' : 'מתחת'
    return tooltipRtlLine(
      `${sigmaStr} סטיית תקן ${verb} ממוצע הערוצים (${meanStr})`,
    )
  }

  return (high ? t.pollSummaryCellStdevAboveMean : t.pollSummaryCellStdevBelowMean)
    .replace(/\{sigma\}/g, sigmaStr)
    .replace(/\{mean\}/g, meanStr)
}

function buildValuesOnlyCellTitle(
  t: UiStrings,
  locale: AppLocale,
  partyKey: string,
  partyLabel: string,
  seats: number,
  previous: RollingPoll | null | undefined,
  stdevOutlier: ReturnType<typeof evaluatePartySeatColumnOutlier> | null,
): string {
  const hasPrior = previous != null
  const priorVotes = hasPrior
    ? (previous.parties.find((pr) => pr.party === partyKey)?.votes ?? 0)
    : 0

  const line1 = hasPrior
    ? t.pollSummaryCellTooltipLine1
        .replace(/\{party\}/g, partyLabel)
        .replace(/\{seats\}/g, formatChipNum(seats))
        .replace(/\{prior\}/g, formatChipNum(priorVotes))
    : t.pollSummaryCellTooltipNoPrior
        .replace(/\{party\}/g, partyLabel)
        .replace(/\{seats\}/g, formatChipNum(seats))

  let line2: string | null = null
  if (hasPrior) {
    const delta = seats - priorVotes
    if (locale === 'he') {
      line2 =
        delta !== 0
          ? tooltipLtrLine(`${formatDeltaSigned(delta)} מול סקר קודם`)
          : tooltipLtrLine(t.pollSummaryCellTooltipVsPriorUnchanged)
    } else {
      line2 =
        delta !== 0
          ? t.pollSummaryCellTooltipVsPriorDelta.replace(
              /\{delta\}/g,
              formatDeltaSigned(delta),
            )
          : t.pollSummaryCellTooltipVsPriorUnchanged
    }
  }

  let line3: string | null = null
  if (stdevOutlier && stdevOutlier.tier > 0) {
    line3 = formatStdevTooltipLine(t, locale, stdevOutlier)
  }

  return [line1, line2, line3].filter((line): line is string => line != null).join('\n')
}

type PollSummaryPanelProps = {
  rows: RollingWindowRow[]
  /** Full deduped poll history for per-outlet party trend popups */
  pollHistory?: RollingPoll[]
  locale: AppLocale
  t: UiStrings
  maxStaleDays: number
  combineArabsWithOpposition: boolean
  displayMediaOutlet: (outlet: string) => string
  displayParty: (partyKey: string) => string
  /** From poll-summary-narrative.json: general line below hero; HTML bullets below rows */
  narrativeBackground?: string
}

function FilterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M1.5 4h13M4 8h8M6.5 12h3"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function OutletFilterDropdown({
  allOutlets,
  excludedOutlets,
  onToggle,
  onClear,
  locale,
  displayMediaOutlet,
  filterButtonRef,
}: {
  allOutlets: string[]
  excludedOutlets: Set<string>
  onToggle: (outlet: string) => void
  onClear: () => void
  locale: AppLocale
  displayMediaOutlet: (outlet: string) => string
  filterButtonRef?: React.RefObject<HTMLButtonElement | null>
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const hiddenCount = excludedOutlets.size

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="lpo-ps-outlet-filter" ref={wrapRef}>
      <button
        ref={filterButtonRef}
        className={`lpo-ps-outlet-filter-btn${hiddenCount > 0 ? ' lpo-ps-outlet-filter-btn--active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        title={locale === 'he' ? 'סנן ערוצים' : 'Filter outlets'}
      >
        <FilterIcon />
        {hiddenCount > 0 && (
          <span className="lpo-ps-outlet-filter-badge">{hiddenCount}</span>
        )}
      </button>
      {open && (
        <div className="lpo-ps-outlet-filter-panel">
          {hiddenCount > 0 && (
            <button className="lpo-ps-outlet-filter-all" onClick={onClear}>
              {locale === 'he' ? 'הצג הכל' : 'Show all'}
            </button>
          )}
          {allOutlets.map((outlet) => {
            const included = !excludedOutlets.has(outlet)
            return (
              <label key={outlet} className="lpo-ps-outlet-filter-item">
                <input
                  type="checkbox"
                  checked={included}
                  onChange={() => onToggle(outlet)}
                />
                <span className="lpo-ps-outlet-filter-ico">
                  <IconWithFallback
                    src={MEDIA_ICON_MAP[outlet]}
                    label={displayMediaOutlet(outlet)}
                  />
                </span>
                <span className="lpo-ps-outlet-filter-name">{displayMediaOutlet(outlet)}</span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PollSummaryRowMain({
  current,
  previous,
  locale,
  t,
  dateFmt,
  combineArabsWithOpposition,
  displayMediaOutlet,
}: {
  current: RollingPoll
  previous: RollingPoll | null
  locale: AppLocale
  t: UiStrings
  dateFmt: string
  combineArabsWithOpposition: boolean
  displayMediaOutlet: (outlet: string) => string
}) {
  const dCoal =
    previous !== null ? current.coalitionTotal - previous.coalitionTotal : null
  const oppDisplay = combineArabsWithOpposition
    ? current.oppositionTotal + current.arabsTotal
    : current.oppositionTotal
  const prevOppDisplay =
    previous !== null
      ? combineArabsWithOpposition
        ? previous.oppositionTotal + previous.arabsTotal
        : previous.oppositionTotal
      : null
  const dOppDisplay =
    previous !== null && prevOppDisplay !== null ? oppDisplay - prevOppDisplay : null

  return (
    <div className="lpo-ps-row-main" dir="ltr">
      <div className="lpo-ps-row-media">
        <div className="lpo-ps-row-ico">
          <IconWithFallback
            src={MEDIA_ICON_MAP[current.mediaOutlet]}
            label={displayMediaOutlet(current.mediaOutlet)}
          />
        </div>
        <div className="lpo-ps-row-meta" dir={locale === 'he' ? 'rtl' : 'ltr'}>
          <span className="lpo-ps-row-name">{displayMediaOutlet(current.mediaOutlet)}</span>
          <div className="lpo-ps-row-dates">
            <span className="lpo-ps-row-date lpo-ps-row-date--latest">
              {t.latestPrefix}{' '}
              <strong>{dayjs(current.date).format(dateFmt)}</strong>
            </span>
            {previous ? (
              <span className="lpo-ps-row-date lpo-ps-row-date--prev">
                {t.previousDate} {dayjs(previous.date).format(dateFmt)}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div
        className="lpo-ps-row-bar-stack lpo-ps-bar-ltr"
        aria-label={`${t.opposition} ${oppDisplay}, ${t.coalition} ${current.coalitionTotal}`}
      >
        <div className="lpo-ps-row-bar-aligned">
          <div className="lpo-ps-blocs-nums-band">
            <div className="lpo-ps-row-nums-between">
              <span className="lpo-ps-row-bloc lpo-ps-row-bloc--opp">
                <span className="lpo-ps-row-bloc-num" style={{ color: SEGMENT_COLORS.Opposition }}>
                  {oppDisplay}
                </span>
                {dOppDisplay !== null && dOppDisplay !== 0 ? (
                  <DeltaBadge delta={dOppDisplay} />
                ) : null}
              </span>
              <span className="lpo-ps-row-bloc lpo-ps-row-bloc--coal">
                <span className="lpo-ps-row-bloc-num" style={{ color: SEGMENT_COLORS.Coalition }}>
                  {current.coalitionTotal}
                </span>
                {dCoal !== null && dCoal !== 0 ? <DeltaBadge delta={dCoal} /> : null}
              </span>
            </div>
            <span className="lpo-ps-maj-label-fly lpo-ps-maj-label-fly--10" aria-hidden>
              60
            </span>
          </div>
          <PsSegmentBar
            coalition={current.coalitionTotal}
            opposition={current.oppositionTotal}
            arabs={current.arabsTotal}
            mergeArabsWithOpposition={combineArabsWithOpposition}
            showMajLine
            mini
          />
        </div>
      </div>
    </div>
  )
}

function UnifiedPartyNamesGrid({
  partyOrder,
  locale,
  displayParty,
  ariaLabel,
  showIcons = false,
  segmentByParty,
  combineArabsWithOpposition,
}: {
  partyOrder: readonly string[]
  locale: AppLocale
  displayParty: (partyKey: string) => string
  ariaLabel: string
  /** Sticky outlet-table header: party icon below each name column. */
  showIcons?: boolean
  segmentByParty?: ReadonlyMap<string, Segment>
  combineArabsWithOpposition?: boolean
}) {
  if (partyOrder.length === 0) return null

  return (
    <ul
      className={`lpo-ps-unified-party-names lpo-ps-chips--unified-grid${showIcons ? ' lpo-ps-unified-party-names--with-icons' : ''}`}
      style={
        {
          '--lpo-ps-unified-party-cols': partyOrder.length,
        } as React.CSSProperties
      }
      aria-label={ariaLabel}
    >
      {partyOrder.map((party) => {
        const segment = segmentByParty?.get(party)
        const ringColor =
          segment !== undefined && combineArabsWithOpposition !== undefined
            ? segmentRingColorForSummary(segment, combineArabsWithOpposition)
            : undefined
        return (
          <li
            key={party}
            className="lpo-ps-unified-party-header-col"
            title={displayParty(party)}
          >
            <span
              className="lpo-ps-unified-party-name"
              dir={locale === 'he' ? 'rtl' : 'ltr'}
            >
              {displayParty(party)}
            </span>
            {showIcons ? (
              <div
                className="lpo-ps-chip-ring lpo-ps-unified-party-header-icon"
                style={
                  ringColor
                    ? ({ '--lpo-ps-chip-segment': ringColor } as React.CSSProperties)
                    : undefined
                }
              >
                <IconWithFallback
                  src={PARTY_ICON_MAP[party]}
                  label={displayParty(party)}
                />
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

function PollSummaryChipsStrip({
  current,
  previous,
  changedParties,
  t,
  combineArabsWithOpposition,
  displayParty,
  displayMediaOutlet,
  onPartyTrendClick,
  trendContext = 'outlet',
  trendOutletForAria,
  selectedTrendParties,
  trendLineColorsByParty,
  showDeltaOutletCount = false,
  partyOrder,
  valuesOnly = false,
  partyColumnSeatStats: partyColumnSeatStatsProp,
  locale,
}: {
  current: RollingPoll
  previous?: RollingPoll | null
  changedParties: ChangedParty[]
  t: UiStrings
  locale: AppLocale
  combineArabsWithOpposition: boolean
  displayParty: (partyKey: string) => string
  displayMediaOutlet: (outlet: string) => string
  onPartyTrendClick?: (party: string) => void
  /** Hero chips use cross-outlet average trend; per-outlet rows use outlet trend. */
  trendContext?: 'outlet' | 'average'
  /** When `current.mediaOutlet` is empty (e.g. hero averages), used in trend button aria. */
  trendOutletForAria?: string
  selectedTrendParties?: ReadonlySet<string>
  trendLineColorsByParty?: ReadonlyMap<string, string>
  /** Hero average chips: show (n) below Δ = outlets with a seat change. */
  showDeltaOutletCount?: boolean
  /** When set, columns follow this order (avg rank) with empty slots for missing parties. */
  partyOrder?: readonly string[]
  /** Outlet unified grid: seats + Δ only (icons live in sticky header). */
  valuesOnly?: boolean
  /** Cross-outlet column mean/stdev for per-cell outlier highlighting. */
  partyColumnSeatStats?: ReadonlyMap<
    string,
    { mean: number; stdev: number; n: number }
  >
}) {
  const changedByParty = useMemo(
    () => new Map(changedParties.map((cp) => [cp.party, cp])),
    [changedParties],
  )

  const partiesWithSeats = useMemo(() => {
    const byParty = new Map(current.parties.map((p) => [p.party, p]))
    if (partyOrder?.length) {
      return partyOrder.map((party) => {
        const row = byParty.get(party)
        return {
          party,
          votes: row?.votes ?? 0,
          segment: row?.segment ?? 'Opposition',
          partyId: row?.partyId ?? 0,
        }
      })
    }
    return [...current.parties]
      .filter((p) => p.votes > 0)
      .sort((a, b) => b.votes - a.votes || a.party.localeCompare(b.party))
  }, [current.parties, partyOrder])

  const unifiedGrid =
    partyOrder !== undefined && partyOrder.length > 0 ? partyOrder.length : undefined

  if (partiesWithSeats.length === 0) {
    return <div className="lpo-ps-combo-chips-placeholder" aria-hidden />
  }

  return (
    <ul
      className={`lpo-ps-chips${showDeltaOutletCount ? ' lpo-ps-chips--with-outlet-count' : ''}${unifiedGrid ? ' lpo-ps-chips--unified-grid' : ''}${valuesOnly ? ' lpo-ps-chips--values-only' : ''}`}
      style={
        unifiedGrid
          ? ({
              '--lpo-ps-unified-party-cols': unifiedGrid,
            } as React.CSSProperties)
          : undefined
      }
    >
      {partiesWithSeats.map((p) => {
        if (p.votes <= 0 && unifiedGrid) {
          return (
            <li
              key={p.party}
              className={`lpo-ps-chip lpo-ps-chip--empty${valuesOnly ? ' lpo-ps-chip--values-only' : ''}`}
              aria-hidden
            >
              {!valuesOnly ? (
                <div className="lpo-ps-chip-ring lpo-ps-chip-ring--empty" />
              ) : null}
              <span className="lpo-ps-chip-votes" dir="ltr">
                {'\u00a0'}
              </span>
              <span className="lpo-ps-chip-delta lpo-ps-chip-delta--spacer" aria-hidden />
              {valuesOnly ? (
                <span className="lpo-ps-chip-stdev-dots" aria-hidden />
              ) : null}
            </li>
          )
        }
        if (p.votes <= 0) return null

        const cp = changedByParty.get(p.party)
        const isChanged = cp !== undefined
        const outletCount =
          showDeltaOutletCount && cp && cp.deltaOutletCount && cp.deltaOutletCount > 0
            ? cp.deltaOutletCount
            : null
        const outletCountTitle =
          outletCount !== null
            ? t.pollSummaryChipDeltaOutletCountTitle.replace(/\{n\}/g, String(outletCount))
            : undefined
        const ringColor =
          trendLineColorsByParty?.get(p.party) ??
          segmentRingColorForSummary(p.segment, combineArabsWithOpposition)
        const trendAria = onPartyTrendClick
          ? trendContext === 'average'
            ? t.pollSummaryHeroPartyTrendOpenAria.replace(
                /\{party\}/g,
                displayParty(p.party),
              )
            : t.pollSummaryPartyTrendOpenAria
                .replace(/\{party\}/g, displayParty(p.party))
                .replace(
                  /\{outlet\}/g,
                  displayMediaOutlet(trendOutletForAria ?? current.mediaOutlet),
                )
          : undefined
        const isTrendSelected = selectedTrendParties?.has(p.party) ?? false
        const stdevOutlier =
          valuesOnly && partyColumnSeatStatsProp !== undefined
            ? evaluatePartySeatColumnOutlier(p.party, p.votes, partyColumnSeatStatsProp)
            : null
        const stdevOutlierTier = stdevOutlier?.tier ?? 0
        const cellTitle = valuesOnly
          ? buildValuesOnlyCellTitle(
              t,
              locale,
              p.party,
              displayParty(p.party),
              p.votes,
              previous,
              stdevOutlier,
            )
          : isChanged
            ? outletCountTitle
              ? `${displayParty(p.party)} · ${cp!.currentVotes} ${t.seats} (${cp!.delta > 0 ? '+' : ''}${cp!.delta}) · ${outletCountTitle}`
              : `${displayParty(p.party)} · ${cp!.currentVotes} ${t.seats} (${cp!.delta > 0 ? '+' : ''}${cp!.delta})`
            : `${displayParty(p.party)} · ${p.votes} ${t.seats}`
        const chipStyle = {
          '--lpo-ps-chip-segment': ringColor,
          ...(isTrendSelected && !valuesOnly
            ? { '--lpo-ps-chip-trend-dash': ringColor }
            : {}),
        } as React.CSSProperties
        const deltaBlock = (() => {
          if (!isChanged || !cp) {
            return (
              <span className="lpo-ps-chip-delta lpo-ps-chip-delta--spacer" aria-hidden />
            )
          }
          const deltaMagnitude = showDeltaOutletCount
            ? formatChipSeatDeltaMagnitude(cp.delta)
            : formatChipNum(Math.abs(cp.delta))
          return (
            <span
              className="lpo-ps-chip-delta-stack"
              title={outletCountTitle}
              aria-label={
                outletCountTitle
                  ? `${cp.delta > 0 ? '+' : '-'}${deltaMagnitude} · ${outletCountTitle}`
                  : undefined
              }
            >
              <span
                className={`lpo-ps-chip-delta ${cp.delta > 0 ? 'up' : 'down'}`}
                dir="ltr"
              >
                {cp.delta > 0 ? '+' : '-'}
                {deltaMagnitude}
              </span>
              {outletCount !== null ? (
                <span className="lpo-ps-chip-delta-outlets" dir="ltr" aria-hidden>
                  ({outletCount})
                </span>
              ) : null}
            </span>
          )
        })()
        const stdevDotsBlock = valuesOnly ? (
          <span className="lpo-ps-chip-stdev-dots" aria-hidden>
            {stdevOutlierTier >= 1 ? <span className="lpo-ps-chip-stdev-dot" /> : null}
            {stdevOutlierTier >= 2 ? <span className="lpo-ps-chip-stdev-dot" /> : null}
          </span>
        ) : null

        return (
          <li
            key={p.party}
            className={`lpo-ps-chip${isTrendSelected ? ' lpo-ps-chip--trend-active' : ''}${valuesOnly ? ' lpo-ps-chip--values-only' : ''}`}
            title={cellTitle}
            style={chipStyle}
          >
            {valuesOnly && onPartyTrendClick ? (
              <button
                type="button"
                className="lpo-ps-chip-values-btn"
                aria-label={trendAria}
                onClick={() => onPartyTrendClick(p.party)}
              >
                <span className="lpo-ps-chip-votes" dir="ltr">
                  {formatChipNum(p.votes)}
                </span>
                {deltaBlock}
                {stdevDotsBlock}
              </button>
            ) : (
              <>
                {!valuesOnly ? (
                  onPartyTrendClick ? (
                    <button
                      type="button"
                      className="lpo-ps-chip-icon-btn"
                      aria-label={trendAria}
                      onClick={() => onPartyTrendClick(p.party)}
                    >
                      <div className="lpo-ps-chip-ring">
                        <IconWithFallback
                          src={PARTY_ICON_MAP[p.party]}
                          label={displayParty(p.party)}
                        />
                      </div>
                    </button>
                  ) : (
                    <div className="lpo-ps-chip-ring">
                      <IconWithFallback
                        src={PARTY_ICON_MAP[p.party]}
                        label={displayParty(p.party)}
                      />
                    </div>
                  )
                ) : null}
                <span className="lpo-ps-chip-votes" dir="ltr">
                  {formatChipNum(p.votes)}
                </span>
                {deltaBlock}
                {valuesOnly ? stdevDotsBlock : null}
              </>
            )}
            {isTrendSelected && !valuesOnly ? (
              <span className="lpo-ps-chip-trend-dash" aria-hidden />
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

export function PollSummaryPanel({
  rows,
  pollHistory,
  locale,
  t,
  maxStaleDays,
  combineArabsWithOpposition,
  displayMediaOutlet,
  displayParty,
  narrativeBackground = '',
}: PollSummaryPanelProps) {
  const dateFmt = locale === 'he' ? 'DD/MM/YYYY' : 'M/D/YYYY'
  const bgText = narrativeBackground.trim()

  const [trendFocus, setTrendFocus] = useState<TrendFocus | null>(null)
  const [heroPartiesChartOpen, setHeroPartiesChartOpen] = useState(false)

  const [excludedOutlets, setExcludedOutlets] = useState<Set<string>>(() => new Set())
  const allOutletKeys = useMemo(() => rows.map((r) => r.current.mediaOutlet), [rows])
  const filteredRows = useMemo(
    () =>
      excludedOutlets.size === 0
        ? rows
        : rows.filter((r) => !excludedOutlets.has(r.current.mediaOutlet)),
    [rows, excludedOutlets],
  )
  const heroAvgChips = useMemo(
    () => buildCrossOutletAverageChipRow(filteredRows),
    [filteredRows],
  )
  /** Cross-outlet column order: hero average seat rank (high → low). */
  const unifiedPartyOrder = useMemo(
    () => heroAvgChips?.current.parties.map((p) => p.party) ?? [],
    [heroAvgChips],
  )
  const unifiedHeaderSegmentByParty = useMemo(() => {
    if (!heroAvgChips) return undefined
    return new Map(heroAvgChips.current.parties.map((p) => [p.party, p.segment]))
  }, [heroAvgChips])
  const partyColumnSeatStatsMap = useMemo(
    () => partyColumnSeatStats(filteredRows, unifiedPartyOrder),
    [filteredRows, unifiedPartyOrder],
  )

  const segmentForPartyAtOutlet = useCallback(
    (outlet: string, party: string) => {
      const row = rows
        .find((r) => r.current.mediaOutlet === outlet)
        ?.current.parties.find((p) => p.party === party)
      return segmentForPartyKey(party, row?.segment)
    },
    [rows],
  )

  const segmentForTrendParty = useCallback(
    (party: string) => {
      if (trendFocus) {
        return segmentForPartyAtOutlet(trendFocus.outlet, party)
      }
      return segmentForPartyKey(party, undefined)
    },
    [trendFocus, segmentForPartyAtOutlet],
  )

  const trendLineColorByParty = useMemo(() => {
    if (!trendFocus) return new Map<string, string>()
    return blocTrendLineColors(
      trendFocus.parties,
      segmentForTrendParty,
      combineArabsWithOpposition,
    )
  }, [trendFocus, segmentForTrendParty, combineArabsWithOpposition])

  const handlePartyTrendClick = useCallback((outlet: string, party: string) => {
    setTrendFocus((prev) => {
      if (!prev || prev.outlet !== outlet) {
        return { outlet, parties: [party] }
      }
      if (prev.parties.includes(party)) {
        const next = prev.parties.filter((p) => p !== party)
        return next.length === 0 ? null : { outlet, parties: next }
      }
      return { outlet, parties: [...prev.parties, party] }
    })
  }, [])

  const closePartyTrend = useCallback(() => setTrendFocus(null), [])

  const trendLines = useMemo(() => {
    if (!trendFocus || !pollHistory?.length) return []
    return trendFocus.parties.map((party) => ({
      party,
      partyDisplay: displayParty(party),
      color:
        trendLineColorByParty.get(party) ??
        segmentRingColorForSummary(segmentForTrendParty(party), combineArabsWithOpposition),
      data: buildPartyOutletTrendSeries(pollHistory, trendFocus.outlet, party),
    }))
  }, [
    trendFocus,
    pollHistory,
    displayParty,
    trendLineColorByParty,
    segmentForTrendParty,
    combineArabsWithOpposition,
  ])

  const selectedTrendParties = useMemo(
    () => (trendFocus ? new Set(trendFocus.parties) : undefined),
    [trendFocus],
  )

  const visibleRows = useMemo(() => {
    if (!trendFocus) return filteredRows
    return filteredRows.filter((r) => r.current.mediaOutlet === trendFocus.outlet)
  }, [filteredRows, trendFocus])
  const toggleOutlet = useCallback((outlet: string) => {
    setExcludedOutlets((prev) => {
      const next = new Set(prev)
      if (next.has(outlet)) next.delete(outlet)
      else next.add(outlet)
      return next
    })
  }, [])
  const clearExcluded = useCallback(() => setExcludedOutlets(new Set()), [])

  const summary = useMemo(() => summaryFromRollingRows(filteredRows), [filteredRows])
  const trendPanelTitle = useMemo(() => {
    if (!trendFocus) return ''
    return displayMediaOutlet(trendFocus.outlet)
  }, [trendFocus, displayMediaOutlet])
  const trendPanelNoData = t.pollSummaryPartyTrendNoData
  const trendBulletOpts = useMemo(
    () => ({
      locale,
      windowDays: maxStaleDays,
      displayMediaOutlet,
      displayParty,
    }),
    [locale, maxStaleDays, displayMediaOutlet, displayParty],
  )
  const outlierBullet = useMemo(
    () => generatePollSummaryOutlierBullet(filteredRows, summary, trendBulletOpts),
    [filteredRows, summary, trendBulletOpts],
  )
  const narrativeAsOfDisplay = useMemo(() => {
    if (filteredRows.length === 0) return undefined
    return resolvePollSummaryNarrativeAsOfDisplay(filteredRows, locale)
  }, [filteredRows, locale])

  const hasPrior = summary.nWithPrior > 0
  const hasNarrativeTop = Boolean(narrativeAsOfDisplay) || Boolean(bgText)

  const hasUnifiedPartyRows = visibleRows.some((r) =>
    r.current.parties.some((p) => p.votes > 0),
  )
  const partiesScrollSyncRef = useRef(false)
  const unifiedPartiesScrollRef = useRef<HTMLDivElement | null>(null)
  const partyHeaderTrackRef = useRef<HTMLDivElement | null>(null)
  const fixedHeaderSpacerRef = useRef<HTMLDivElement | null>(null)
  const heroPartyNamesScrollRef = useRef<HTMLDivElement | null>(null)
  const heroPartiesScrollRef = useRef<HTMLDivElement | null>(null)
  const unifiedFixedWidthRef = useRef<HTMLDivElement | null>(null)
  const unifiedSplitWrapRef = useRef<HTMLDivElement | null>(null)
  const psWrapRef = useRef<HTMLDivElement | null>(null)
  const heroPartiesWrapRef = useRef<HTMLDivElement | null>(null)
  const heroChartSideColRef = useRef<HTMLDivElement | null>(null)
  const outletFilterBtnRef = useRef<HTMLButtonElement | null>(null)
  const colGuidesTrackRef = useRef<HTMLDivElement | null>(null)

  const syncColGuidesScroll = useCallback((scrollLeft: number) => {
    const track = colGuidesTrackRef.current
    if (!track) return
    track.style.transform = `translate3d(${-scrollLeft}px, 0, 0)`
  }, [])

  useLayoutEffect(() => {
    if (!hasUnifiedPartyRows) return
    const measureEl = unifiedFixedWidthRef.current
    const wrap = unifiedSplitWrapRef.current
    const heroPartiesEl = heroPartiesWrapRef.current
    if (!measureEl || !wrap) return
    const apply = () => {
      applyUnifiedFixedMeasuredWidth(measureEl, wrap, psWrapRef.current)
      const tableEl = unifiedPartiesScrollRef.current
      if (tableEl) {
        tableEl.style.setProperty(
          '--lpo-ps-unified-table-visible-w',
          `${tableEl.clientWidth}px`,
        )
      }
      if (heroPartiesEl && wrap) {
        const heroChartSideCol = heroChartSideColRef.current
        const filterBtn = outletFilterBtnRef.current
        const heroChartBtn = heroChartSideCol?.querySelector<HTMLElement>(
          '.lpo-ps-hero-parties-chart-btn',
        )
        if (heroChartSideCol && filterBtn && heroChartBtn) {
          const chartCell = heroChartSideCol.querySelector<HTMLElement>(
            '.lpo-ps-hero-parties-chart-cell',
          )
          heroChartSideCol.style.marginInlineStart = '0px'
          if (chartCell) chartCell.style.marginTop = '0px'

          const naturalBtnLeft = heroChartBtn.getBoundingClientRect().left
          const filterLeft = filterBtn.getBoundingClientRect().left
          const targetLeft = Math.max(filterLeft, naturalBtnLeft)
          const dx = targetLeft - naturalBtnLeft
          if (Math.abs(dx) > 0.5) {
            heroChartSideCol.style.marginInlineStart = `${dx}px`
          }

          const chipIcon = heroPartiesScrollRef.current?.querySelector<HTMLElement>(
            '.lpo-ps-chip:not(.lpo-ps-chip--empty) .lpo-ps-chip-ring .mapped-icon',
          )
          if (chartCell && chipIcon) {
            const iconRect = chipIcon.getBoundingClientRect()
            const btnRect = heroChartBtn.getBoundingClientRect()
            const dy =
              iconRect.top + iconRect.height / 2 - (btnRect.top + btnRect.height / 2)
            if (Math.abs(dy) > 0.5) {
              chartCell.style.marginTop = `${dy}px`
            }
          }
        } else if (heroChartSideCol) {
          heroChartSideCol.style.marginInlineStart = ''
          const chartCell = heroChartSideCol.querySelector<HTMLElement>(
            '.lpo-ps-hero-parties-chart-cell',
          )
          if (chartCell) chartCell.style.marginTop = ''
        }
        heroPartiesEl.style.marginInlineStart = ''
        heroPartiesEl.style.removeProperty('--lpo-ps-hero-parties-center-offset')
      }
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(measureEl)
    if (heroPartiesEl) ro.observe(heroPartiesEl)
    if (heroChartSideColRef.current) ro.observe(heroChartSideColRef.current)
    if (outletFilterBtnRef.current) ro.observe(outletFilterBtnRef.current)
    if (heroPartiesScrollRef.current) ro.observe(heroPartiesScrollRef.current)
    ro.observe(wrap)
    if (psWrapRef.current) ro.observe(psWrapRef.current)
    window.addEventListener('resize', apply)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', apply)
    }
  }, [hasUnifiedPartyRows, visibleRows.length, trendFocus, unifiedPartyOrder.length])

  useLayoutEffect(() => {
    if (!hasUnifiedPartyRows) return
    const scrollLeft = unifiedPartiesScrollRef.current?.scrollLeft ?? 0
    syncColGuidesScroll(scrollLeft)
  }, [hasUnifiedPartyRows, unifiedPartyOrder.length, visibleRows.length, syncColGuidesScroll])

  useLayoutEffect(() => {
    if (!hasUnifiedPartyRows || unifiedPartyOrder.length === 0) return
    const headerEl = partyHeaderTrackRef.current
    const spacerEl = fixedHeaderSpacerRef.current
    const wrap = unifiedSplitWrapRef.current
    if (!headerEl || !spacerEl || !wrap) return
    const syncHeaderHeight = () => {
      const h = headerEl.offsetHeight
      spacerEl.style.height = `${h}px`
      wrap.style.setProperty('--lpo-ps-unified-party-header-h', `${h}px`)
    }
    syncHeaderHeight()
    const ro = new ResizeObserver(syncHeaderHeight)
    ro.observe(headerEl)
    return () => ro.disconnect()
  }, [hasUnifiedPartyRows, unifiedPartyOrder.length, visibleRows.length, combineArabsWithOpposition])

  useLayoutEffect(() => {
    if (!hasUnifiedPartyRows || unifiedPartyOrder.length === 0) return
    const wrap = unifiedSplitWrapRef.current
    if (!wrap) return
    const syncRowHeights = () => {
      requestAnimationFrame(() => {
        const fixedRows = wrap.querySelectorAll<HTMLElement>('.lpo-ps-unified-fixed-row')
        const partyLines = wrap.querySelectorAll<HTMLElement>('.lpo-ps-unified-parties-line')
        fixedRows.forEach((row, idx) => {
          const line = partyLines[idx]
          if (!line) return
          const h = row.offsetHeight
          if (h > 0) {
            line.style.height = `${h}px`
            line.style.minHeight = `${h}px`
            line.style.maxHeight = `${h}px`
          }
        })
      })
    }
    syncRowHeights()
    const ro = new ResizeObserver(syncRowHeights)
    ro.observe(wrap)
    wrap.querySelectorAll('.lpo-ps-unified-fixed-row').forEach((el) => ro.observe(el))
    wrap.querySelectorAll('.lpo-ps-unified-parties-line').forEach((el) => ro.observe(el))
    window.addEventListener('resize', syncRowHeights)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', syncRowHeights)
      wrap.querySelectorAll<HTMLElement>('.lpo-ps-unified-parties-line').forEach((line) => {
        line.style.height = ''
        line.style.minHeight = ''
        line.style.maxHeight = ''
      })
    }
  }, [
    hasUnifiedPartyRows,
    unifiedPartyOrder.length,
    visibleRows.length,
    trendFocus,
    combineArabsWithOpposition,
    locale,
  ])

  const handleHeroPartiesScroll = useCallback((source: 'names' | 'chips') => {
    if (partiesScrollSyncRef.current) return
    const sourceEl =
      source === 'names' ? heroPartyNamesScrollRef.current : heroPartiesScrollRef.current
    if (!sourceEl) return
    partiesScrollSyncRef.current = true
    const { scrollLeft } = sourceEl
    if (heroPartyNamesScrollRef.current && source !== 'names') {
      heroPartyNamesScrollRef.current.scrollLeft = scrollLeft
    }
    if (heroPartiesScrollRef.current && source !== 'chips') {
      heroPartiesScrollRef.current.scrollLeft = scrollLeft
    }
    partiesScrollSyncRef.current = false
  }, [])

  const trendPanel =
    trendFocus && pollHistory?.length ? (
      <PartyOutletTrendPanel
        open
        onClose={closePartyTrend}
        outletDisplay={trendPanelTitle}
        lines={trendLines}
        locale={locale}
        t={t}
        noDataMessage={trendPanelNoData}
      />
    ) : null

  if (rows.length === 0) {
    return (
      <div className="lpo-ps-wrap">
        <p className="lpo-ps-empty">
          {t.pollSummaryNoOutlets.replace(/\{n\}/g, String(maxStaleDays))}
        </p>
      </div>
    )
  }

  const showEmptyFilterMsg = visibleRows.length === 0

  const showFilterInTableHeader =
    hasUnifiedPartyRows && unifiedPartyOrder.length > 0

  const outletFilterControl = trendFocus ? null : (
    <OutletFilterDropdown
      allOutlets={allOutletKeys}
      excludedOutlets={excludedOutlets}
      onToggle={toggleOutlet}
      onClear={clearExcluded}
      locale={locale}
      displayMediaOutlet={displayMediaOutlet}
      filterButtonRef={outletFilterBtnRef}
    />
  )

  const outletFilterSubtitle =
    trendFocus ? null : (
    <div className="lpo-ps-outlets-intro">
      <div
        className={`lpo-ps-subtitle-bar${showFilterInTableHeader ? ' lpo-ps-subtitle-bar--filter-in-table' : ''}`}
        dir="ltr"
      >
        {!showFilterInTableHeader ? outletFilterControl : null}
        <p
          className="lpo-ps-subtitle lpo-ps-subtitle--under-page-title lpo-ps-subtitle--outlets-breakdown"
          dir={locale === 'he' ? 'rtl' : 'ltr'}
        >
          <strong>{t.pollSummaryOutletsBreakdownLead}</strong>
          {t.pollSummaryOutletsBreakdownTail}
        </p>
      </div>
      {outlierBullet ? (
        <p
          className="lpo-ps-outliers-note"
          dir={locale === 'he' ? 'rtl' : 'ltr'}
          dangerouslySetInnerHTML={{
            __html: narrativeHtmlWithBlocHighlights(outlierBullet),
          }}
        />
      ) : null}
      <p
        className="lpo-ps-subtitle lpo-ps-subtitle--outlets-trend-hint"
        dir={locale === 'he' ? 'rtl' : 'ltr'}
      >
        {t.pollSummaryOutletsBreakdownTrendHint}
      </p>
    </div>
  )

  return (
    <div className="lpo-ps-wrap" ref={psWrapRef}>
      <section className="lpo-ps-hero" aria-label={t.pollSummaryHeroAria}>
        {hasNarrativeTop ? (
          <div
            className="lpo-ps-narrative-top"
            dir={locale === 'he' ? 'rtl' : 'ltr'}
            aria-label={t.pollSummaryNarrativeBackgroundAria}
          >
            {narrativeAsOfDisplay ? (
              <p className="lpo-ps-narrative-asof">
                {t.pollSummaryNarrativeAsOf.replace(/\{date\}/g, narrativeAsOfDisplay)}
              </p>
            ) : null}
            {bgText ? (
              <p
                className="lpo-ps-narrative-bg"
                dangerouslySetInnerHTML={{ __html: narrativeHtmlWithBlocHighlights(bgText) }}
              />
            ) : null}
          </div>
        ) : null}
        <div className="lpo-ps-hero-summary-row">
          <PollSummaryHeroBlocBar
            t={t}
            combineArabsWithOpposition={combineArabsWithOpposition}
            hasPrior={hasPrior}
            avgCoalition={summary.avgCoalition}
            avgOpposition={summary.avgOpposition}
            avgArabs={summary.avgArabs}
            avgOppositionPlusArabs={summary.avgOppositionPlusArabs}
            deltaCoalition={summary.deltaCoalition}
            deltaOpposition={summary.deltaOpposition}
            deltaOppositionPlusArabs={summary.deltaOppositionPlusArabs}
          />
          {heroAvgChips && unifiedPartyOrder.length > 0 ? (
            <div className="lpo-ps-hero-parties-outer">
              <div
                ref={heroChartSideColRef}
                className="lpo-ps-hero-parties-side-col"
              >
                <div className="lpo-ps-hero-parties-chart-cell">
                  <PollSummaryHeroPartiesChartButton
                    onClick={() => setHeroPartiesChartOpen(true)}
                    ariaLabel={t.pollSummaryHeroPartiesChartOpenAria}
                  />
                </div>
              </div>
              <div
                ref={heroPartiesWrapRef}
                className="lpo-ps-hero-parties-wrap lpo-ps-hero-parties-wrap--hero-centered"
                role="region"
                aria-label={t.pollSummaryHeroAvgPartiesAria}
              >
                <div className="lpo-ps-hero-parties-track">
                  <div
                    className="lpo-ps-hero-parties-names-scroll"
                    ref={heroPartyNamesScrollRef}
                    onScroll={() => handleHeroPartiesScroll('names')}
                  >
                    <UnifiedPartyNamesGrid
                      partyOrder={unifiedPartyOrder}
                      locale={locale}
                      displayParty={displayParty}
                      ariaLabel={t.pollSummaryUnifiedPartyNamesAria}
                    />
                  </div>
                  <div
                    className="lpo-ps-hero-parties-scroll"
                    ref={heroPartiesScrollRef}
                    onScroll={() => handleHeroPartiesScroll('chips')}
                  >
                    <PollSummaryChipsStrip
                      current={heroAvgChips.current}
                      changedParties={heroAvgChips.changedParties}
                      t={t}
                      locale={locale}
                      combineArabsWithOpposition={combineArabsWithOpposition}
                      displayParty={displayParty}
                      displayMediaOutlet={displayMediaOutlet}
                      partyOrder={unifiedPartyOrder}
                      showDeltaOutletCount
                    />
                  </div>
                  {hasPrior && heroAvgChips.changedParties.length > 0 ? (
                    <p
                      className="lpo-ps-hero-chip-outlet-legend lpo-ps-chip-delta-outlets"
                      dir={locale === 'he' ? 'rtl' : 'ltr'}
                    >
                      {t.pollSummaryHeroChipOutletCountLegend}
                      {' · '}
                      {t.pollSummaryHeroChipDeltaColorLegend}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : heroAvgChips ? (
            <div
              className="lpo-ps-hero-parties-wrap"
              role="region"
              aria-label={t.pollSummaryHeroAvgPartiesAria}
            >
              <div className="lpo-ps-hero-parties-align-row" dir="ltr">
                <PollSummaryHeroPartiesChartButton
                  onClick={() => setHeroPartiesChartOpen(true)}
                  ariaLabel={t.pollSummaryHeroPartiesChartOpenAria}
                />
                <div className="lpo-ps-hero-parties-scroll">
                  <PollSummaryChipsStrip
                    current={heroAvgChips.current}
                    changedParties={heroAvgChips.changedParties}
                    t={t}
                    locale={locale}
                    combineArabsWithOpposition={combineArabsWithOpposition}
                    displayParty={displayParty}
                    displayMediaOutlet={displayMediaOutlet}
                    showDeltaOutletCount
                  />
                </div>
              </div>
              {hasPrior && heroAvgChips.changedParties.length > 0 ? (
                <p
                  className="lpo-ps-hero-chip-outlet-legend lpo-ps-chip-delta-outlets"
                  dir={locale === 'he' ? 'rtl' : 'ltr'}
                >
                  {t.pollSummaryHeroChipOutletCountLegend}
                  {' · '}
                  {t.pollSummaryHeroChipDeltaColorLegend}
                </p>
              ) : null}
            </div>
          ) : null}
          {heroAvgChips ? (
            <PollSummaryHeroPartiesChartPopup
              open={heroPartiesChartOpen}
              onClose={() => setHeroPartiesChartOpen(false)}
              current={heroAvgChips.current}
              changedParties={heroAvgChips.changedParties}
              partyOrder={unifiedPartyOrder}
              combineArabsWithOpposition={combineArabsWithOpposition}
              displayParty={displayParty}
              displayMediaOutlet={displayMediaOutlet}
              locale={locale}
              t={t}
              hasPrior={hasPrior}
              windowDays={maxStaleDays}
              allOutlets={allOutletKeys}
              excludedOutlets={excludedOutlets}
              onToggleOutlet={toggleOutlet}
              avgCoalition={summary.avgCoalition}
              avgOpposition={summary.avgOpposition}
              avgArabs={summary.avgArabs}
              avgOppositionPlusArabs={summary.avgOppositionPlusArabs}
              deltaCoalition={summary.deltaCoalition}
              deltaOpposition={summary.deltaOpposition}
              deltaOppositionPlusArabs={summary.deltaOppositionPlusArabs}
            />
          ) : null}
        </div>
      </section>

      {hasUnifiedPartyRows ? (
        <div
          ref={unifiedSplitWrapRef}
          className="lpo-ps-rows-unified lpo-ps-rows-unified--with-unified-split"
          style={
            unifiedPartyOrder.length > 0
              ? ({
                  '--lpo-ps-unified-party-cols': unifiedPartyOrder.length,
                } as React.CSSProperties)
              : undefined
          }
        >
          {outletFilterSubtitle}
          <div className="lpo-ps-unified-table-with-guides" ref={unifiedPartiesScrollRef}>
            <div className="lpo-ps-unified-outlets-with-guides">
              {unifiedPartyOrder.length > 0 ? (
                <div className="lpo-ps-unified-col-guides" aria-hidden>
                  <div ref={colGuidesTrackRef} className="lpo-ps-unified-col-guides-track" />
                </div>
              ) : null}
              <div
                className="lpo-ps-unified-body lpo-ps-unified-split-grid"
                dir="ltr"
                aria-label={t.pollSummaryRowsAria}
              >
                <div className="lpo-ps-unified-fixed-column">
                  {unifiedPartyOrder.length > 0 ? (
                    <div
                      ref={fixedHeaderSpacerRef}
                      className="lpo-ps-unified-split-grid-corner lpo-ps-unified-fixed-header-spacer"
                    >
                      {outletFilterControl ? (
                        <div className="lpo-ps-unified-fixed-header-filter" dir="ltr">
                          {outletFilterControl}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {visibleRows.map(({ current, previous }, rowIdx) => {
                    const isTrendOutlet = trendFocus?.outlet === current.mediaOutlet
                    return (
                      <div
                        key={current.pollId}
                        className={`lpo-ps-unified-outlet-block${isTrendOutlet ? ' lpo-ps-unified-outlet-block--trend-open' : ''}`}
                      >
                        <div
                          className={`lpo-ps-unified-fixed-row${rowIdx % 2 === 1 ? ' lpo-ps-unified-fixed-row--alt' : ''}`}
                          ref={(el) => {
                            if (rowIdx === 0) {
                              unifiedFixedWidthRef.current = el
                              if (el && unifiedSplitWrapRef.current) {
                                applyUnifiedFixedMeasuredWidth(
                                  el,
                                  unifiedSplitWrapRef.current,
                                  psWrapRef.current,
                                )
                              }
                            }
                          }}
                        >
                          <PollSummaryRowMain
                            current={current}
                            previous={previous}
                            locale={locale}
                            t={t}
                            dateFmt={dateFmt}
                            combineArabsWithOpposition={combineArabsWithOpposition}
                            displayMediaOutlet={displayMediaOutlet}
                          />
                        </div>
                        {isTrendOutlet ? trendPanel : null}
                      </div>
                    )
                  })}
                </div>
                {unifiedPartyOrder.length > 0 ? (
                  <div
                    className="lpo-ps-unified-parties-wrap"
                    role="region"
                    tabIndex={0}
                    aria-label={t.pollSummaryChangedPartiesAria}
                  >
                    <div
                      className="lpo-ps-unified-parties-scroll"
                    >
                      <div className="lpo-ps-unified-parties-track">
                        <div
                          ref={partyHeaderTrackRef}
                          className="lpo-ps-unified-parties-header-row"
                        >
                          <UnifiedPartyNamesGrid
                            partyOrder={unifiedPartyOrder}
                            locale={locale}
                            displayParty={displayParty}
                            ariaLabel={t.pollSummaryUnifiedPartyNamesAria}
                            showIcons
                            segmentByParty={unifiedHeaderSegmentByParty}
                            combineArabsWithOpposition={combineArabsWithOpposition}
                          />
                        </div>
                        {visibleRows.map(
                          ({ current, previous, changedParties }, rowIdx) => {
                            const isTrendOutlet = trendFocus?.outlet === current.mediaOutlet
                            return (
                              <div
                                key={current.pollId}
                                className={`lpo-ps-unified-parties-line${rowIdx % 2 === 1 ? ' lpo-ps-unified-parties-line--alt' : ''}`}
                              >
                                <PollSummaryChipsStrip
                                  current={current}
                                  previous={previous}
                                  changedParties={changedParties}
                                  t={t}
                                  locale={locale}
                                  combineArabsWithOpposition={combineArabsWithOpposition}
                                  displayParty={displayParty}
                                  displayMediaOutlet={displayMediaOutlet}
                                  partyOrder={unifiedPartyOrder}
                                  valuesOnly
                                  partyColumnSeatStats={partyColumnSeatStatsMap}
                                  onPartyTrendClick={
                                    pollHistory?.length
                                      ? (party) =>
                                          handlePartyTrendClick(current.mediaOutlet, party)
                                      : undefined
                                  }
                                  selectedTrendParties={
                                    isTrendOutlet ? selectedTrendParties : undefined
                                  }
                                  trendLineColorsByParty={
                                    isTrendOutlet ? trendLineColorByParty : undefined
                                  }
                                />
                              </div>
                            )
                          },
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {outletFilterSubtitle}
          <div className="lpo-ps-rows-unified">
            {showEmptyFilterMsg ? (
              <p className="lpo-ps-empty" style={{ textAlign: 'center', margin: '1.5rem 0' }}>
                {locale === 'he' ? 'לא נבחרו ערוצים' : 'No outlets selected'}
              </p>
            ) : (
              <ul className="lpo-ps-rows" aria-label={t.pollSummaryRowsAria}>
                {visibleRows.map(({ current, previous }, rowIdx) => (
                  <li
                    key={current.pollId}
                    className={`lpo-ps-row${rowIdx % 2 === 1 ? ' lpo-ps-row--alt' : ''}`}
                  >
                    <PollSummaryRowMain
                      current={current}
                      previous={previous}
                      locale={locale}
                      t={t}
                      dateFmt={dateFmt}
                      combineArabsWithOpposition={combineArabsWithOpposition}
                      displayMediaOutlet={displayMediaOutlet}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <div className="lpo-ps-narrative-trends-link-wrap">
        <a
          className="lpo-ps-nav-btn"
          href={mediaBiasAppUrl()}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t.mediaBiasNarrativeLinkAria}
        >
          {t.mediaBiasOpenBtn}
        </a>
      </div>
    </div>
  )
}
