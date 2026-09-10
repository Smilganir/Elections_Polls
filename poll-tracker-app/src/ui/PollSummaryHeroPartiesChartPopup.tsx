import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { AppLocale } from '../i18n/localeContext'
import type { UiStrings } from '../i18n/strings'
import {
  MEDIA_ICON_MAP,
  PARTY_COLOR_MAP,
  SEGMENT_COLORS,
} from '../config/mappings'
import { seatCountsByParty } from '../lib/knessetSeatAllocation'
import {
  filtersInclude,
  toggleMapFilter,
  type KnessetMapFilters,
  type KnessetMapFocusItem,
} from '../lib/knessetSeatDemographics'
import type { ChangedParty, RollingPoll } from '../lib/pollRollingWindow'
import type { Segment } from '../types/data'
import { PollSummaryHeroBlocBar } from './PollSummaryBlocBar'
import { PollSummaryKnessetFiltersPane } from './PollSummaryKnessetFiltersPane'
import { HeroChartPartyMark } from './HeroChartPartyMark'
import { IconWithFallback } from './IconWithFallback'
import { PollSummaryKnessetSeatMap } from './PollSummaryKnessetSeatMap'
import { AppFooter } from './AppFooter'

const HERO_CHART_SCALE_BAND_MIN_PX = 769
const HERO_CHART_SCALE_BAND_MAX_PX = 1439
const HERO_CHART_STAGE_WIDTH_PX = 1440

function useHeroChartScaleBandActive(): boolean {
  const [active, setActive] = useState(() => {
    if (typeof window === 'undefined') return false
    const width = window.innerWidth
    return width >= HERO_CHART_SCALE_BAND_MIN_PX && width <= HERO_CHART_SCALE_BAND_MAX_PX
  })

  useEffect(() => {
    const mediaQuery = window.matchMedia(
      `(min-width: ${HERO_CHART_SCALE_BAND_MIN_PX}px) and (max-width: ${HERO_CHART_SCALE_BAND_MAX_PX}px)`,
    )
    const sync = () => setActive(mediaQuery.matches)
    sync()
    mediaQuery.addEventListener('change', sync)
    return () => mediaQuery.removeEventListener('change', sync)
  }, [])

  return active
}

function HeroChartScaleFitStage({ children }: { children: React.ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const lockedLayoutRef = useRef<{
    viewport: { width: number; height: number }
    naturalHeight: number
    scale: number
  } | null>(null)
  const [scale, setScale] = useState(1)
  const [shellSize, setShellSize] = useState<{ width: number; height: number } | null>(
    null,
  )
  const [lockedViewport, setLockedViewport] = useState<{
    width: number
    height: number
  } | null>(null)

  useEffect(() => {
    const viewport = viewportRef.current
    const stage = stageRef.current
    if (!viewport || !stage) return

    const applyLayout = (
      locked: { width: number; height: number },
      naturalHeight: number,
      nextScale: number,
    ) => {
      lockedLayoutRef.current = {
        viewport: locked,
        naturalHeight,
        scale: nextScale,
      }
      setLockedViewport(locked)
      setScale(nextScale)
      setShellSize({
        width: Math.max(0, Math.ceil(HERO_CHART_STAGE_WIDTH_PX * nextScale)),
        height: Math.max(0, Math.ceil(naturalHeight * nextScale)),
      })
    }

    const measure = () => {
      const cached = lockedLayoutRef.current
      if (cached) {
        applyLayout(cached.viewport, cached.naturalHeight, cached.scale)
        return true
      }

      const width = viewport.clientWidth
      const height = viewport.clientHeight
      const naturalHeight = stage.offsetHeight
      if (width <= 0 || height <= 0 || naturalHeight <= 0) return false

      const locked = { width, height }
      const widthScale = locked.width / HERO_CHART_STAGE_WIDTH_PX
      const heightScale = locked.height / naturalHeight
      const nextScale = Math.min(widthScale, heightScale)
      applyLayout(locked, naturalHeight, nextScale)
      return true
    }

    const onWindowResize = () => {
      lockedLayoutRef.current = null
      setLockedViewport(null)
      requestAnimationFrame(measure)
    }

    let frame = 0
    const settleMeasure = () => {
      if (measure()) return
      frame += 1
      if (frame < 12) requestAnimationFrame(settleMeasure)
    }

    requestAnimationFrame(settleMeasure)
    window.addEventListener('resize', onWindowResize)

    return () => {
      window.removeEventListener('resize', onWindowResize)
    }
  }, [])

  return (
    <div
      ref={viewportRef}
      className={`lpo-ps-hero-chart-scale-viewport${
        lockedViewport ? ' lpo-ps-hero-chart-scale-viewport--locked' : ''
      }`}
      style={
        lockedViewport
          ? { height: lockedViewport.height, maxHeight: lockedViewport.height }
          : undefined
      }
    >
      <div
        className="lpo-ps-hero-chart-scale-shell"
        style={
          shellSize
            ? { width: shellSize.width, height: shellSize.height }
            : undefined
        }
      >
        <div
          ref={stageRef}
          className="lpo-ps-hero-chart-scale-stage"
          style={{
            width: HERO_CHART_STAGE_WIDTH_PX,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            ['--lpo-ps-hero-chart-scale' as string]: String(scale),
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

function HeroChartScaleFit({ children }: { children: React.ReactNode }) {
  const scaleBandActive = useHeroChartScaleBandActive()
  if (!scaleBandActive) return <>{children}</>
  return <HeroChartScaleFitStage>{children}</HeroChartScaleFitStage>
}

function formatChipNum(n: number): string {
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

function HeroChartInfoIcon() {
  return (
    <svg className="lpo-ps-hero-chart-dialog-info-icon" viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="4.25" r="1.35" fill="currentColor" />
      <path
        d="M8 7.5v5.75"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
    </svg>
  )
}

function HeroChartMethodologyInfo({
  locale,
  t,
  windowDays,
}: {
  locale: AppLocale
  t: UiStrings
  windowDays: number
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [pinned, setPinned] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const open = pinned || hovered

  const windowToken = String(windowDays)
  const bullets = [
    t.pollSummaryHeroPartiesChartInfoBulletWindow,
    t.pollSummaryHeroPartiesChartInfoBulletBars,
    t.pollSummaryHeroPartiesChartInfoBulletDelta,
    t.pollSummaryHeroPartiesChartInfoBulletInclusion,
    t.pollSummaryHeroPartiesChartInfoBulletMap,
    t.pollSummaryHeroPartiesChartInfoBulletFilters,
  ].map((line) => line.replace(/\{n\}/g, windowToken))

  useEffect(() => {
    if (!open) setDetailsOpen(false)
  }, [open])

  useEffect(() => {
    if (!pinned) return
    const onDocPointerDown = (e: PointerEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return
      setPinned(false)
    }
    document.addEventListener('pointerdown', onDocPointerDown)
    return () => document.removeEventListener('pointerdown', onDocPointerDown)
  }, [pinned])

  return (
    <div
      ref={wrapRef}
      className="lpo-ps-hero-chart-dialog-info"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        className="lpo-ps-hero-chart-dialog-info-btn"
        aria-label={t.pollSummaryHeroPartiesChartInfoAria}
        aria-expanded={open}
        onClick={() => setPinned((v) => !v)}
      >
        <HeroChartInfoIcon />
      </button>
      {open ? (
        <div
          className="lpo-ps-hero-chart-dialog-info-panel"
          role="tooltip"
          dir={locale === 'he' ? 'rtl' : 'ltr'}
        >
          <p className="lpo-ps-hero-chart-dialog-info-title">
            {t.pollSummaryHeroPartiesChartInfoTitle}
          </p>
          <ul className="lpo-ps-hero-chart-dialog-info-list">
            {bullets.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <button
            type="button"
            className="lpo-ps-hero-chart-dialog-info-details-toggle"
            aria-expanded={detailsOpen}
            onClick={(e) => {
              e.stopPropagation()
              setDetailsOpen((v) => !v)
            }}
          >
            {t.pollSummaryHeroPartiesChartInfoDetailsToggle}
          </button>
          <div
            className={`lpo-ps-hero-chart-dialog-info-details-wrap${
              detailsOpen ? ' lpo-ps-hero-chart-dialog-info-details-wrap--open' : ''
            }`}
          >
            <div className="lpo-ps-hero-chart-dialog-info-details-inner">
              <p className="lpo-ps-hero-chart-dialog-info-details-body">
                {t.pollSummaryHeroPartiesChartInfoDetailsBody}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function segmentDisplayColor(segment: Segment, mergeArabsWithOpposition: boolean): string {
  if (mergeArabsWithOpposition && segment === 'Arabs') return SEGMENT_COLORS.Opposition
  return SEGMENT_COLORS[segment]
}

export function PollSummaryOutletFilterStrip({
  allOutlets,
  excludedOutlets,
  onToggleOutlet,
  displayMediaOutlet,
  t,
  className,
  stripRef,
}: {
  allOutlets: readonly string[]
  excludedOutlets: ReadonlySet<string>
  onToggleOutlet: (outlet: string) => void
  displayMediaOutlet: (outlet: string) => string
  t: UiStrings
  className?: string
  stripRef?: RefObject<HTMLDivElement | null>
}) {
  const includedOutletCount = useMemo(
    () => allOutlets.filter((outlet) => !excludedOutlets.has(outlet)).length,
    [allOutlets, excludedOutlets],
  )

  return (
    <div
      ref={stripRef}
      className={`lpo-ps-hero-chart-outlets${className ? ` ${className}` : ''}`}
      role="group"
      aria-label={t.pollSummaryHeroPartiesChartOutletsAria}
    >
      {allOutlets.map((outlet) => {
        const included = !excludedOutlets.has(outlet)
        const outletLabel = displayMediaOutlet(outlet)
        const toggleAria = (
          included
            ? t.pollSummaryHeroPartiesChartOutletExcludeAria
            : t.pollSummaryHeroPartiesChartOutletIncludeAria
        ).replace(/\{outlet\}/g, outletLabel)
        const disableExclude = included && includedOutletCount <= 1

        return (
          <button
            key={outlet}
            type="button"
            className={`lpo-ps-hero-chart-outlet-btn${included ? '' : ' lpo-ps-hero-chart-outlet-btn--excluded'}`}
            aria-pressed={included}
            aria-label={toggleAria}
            title={outletLabel}
            disabled={disableExclude}
            onClick={() => onToggleOutlet(outlet)}
          >
            <IconWithFallback src={MEDIA_ICON_MAP[outlet]} label={outletLabel} />
          </button>
        )
      })}
    </div>
  )
}

function HeroPartiesChartButtonPreview() {
  return (
    <svg
      className="lpo-ps-hero-parties-chart-btn-preview"
      width="30"
      height="22"
      viewBox="0 0 30 22"
      aria-hidden
    >
      <rect
        className="lpo-ps-hero-parties-chart-btn-preview-panel"
        x="5"
        y="2.5"
        width="20"
        height="17"
        rx="1.6"
      />
      <g className="lpo-ps-hero-parties-chart-btn-preview-bars" fill="currentColor">
        <rect x="7" y="5.5" width="16" height="1.6" rx="0.4" opacity="0.96" />
        <rect x="7" y="8.4" width="12.5" height="1.6" rx="0.4" opacity="0.84" />
        <rect x="7" y="11.3" width="9.5" height="1.6" rx="0.4" opacity="0.72" />
        <rect x="7" y="14.2" width="6.5" height="1.6" rx="0.4" opacity="0.6" />
      </g>
    </svg>
  )
}

export function PollSummaryHeroPartiesChartButton({
  onClick,
  ariaLabel,
  label,
  seatsLabel,
}: {
  onClick: () => void
  ariaLabel: string
  label?: string
  seatsLabel?: string
}) {
  return (
    <div className="lpo-ps-hero-parties-chart-btn-wrap">
      <button
        type="button"
        className="lpo-ps-hero-parties-chart-btn lpo-ps-hero-parties-chart-btn--prominent"
        onClick={onClick}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
      >
        <HeroPartiesChartButtonPreview />
        <span className="lpo-ps-hero-parties-chart-btn-text">
          {label ? <span className="lpo-ps-hero-parties-chart-btn-label">{label}</span> : null}
          {seatsLabel ? (
            <span className="lpo-ps-hero-parties-chart-btn-seats">{seatsLabel}</span>
          ) : null}
        </span>
      </button>
    </div>
  )
}

export function PollSummaryHeroPartiesChartPopup({
  open,
  onClose,
  current,
  changedParties,
  combineArabsWithOpposition,
  displayParty,
  displayMediaOutlet,
  locale,
  t,
  hasPrior,
  windowDays,
  allOutlets,
  excludedOutlets,
  onToggleOutlet,
  avgCoalition,
  avgOpposition,
  avgArabs,
  avgOppositionPlusArabs,
  deltaCoalition,
  deltaOpposition,
  deltaOppositionPlusArabs,
}: {
  open: boolean
  onClose: () => void
  current: RollingPoll
  changedParties: ChangedParty[]
  combineArabsWithOpposition: boolean
  displayParty: (partyKey: string) => string
  displayMediaOutlet: (outlet: string) => string
  locale: AppLocale
  t: UiStrings
  hasPrior: boolean
  windowDays: number
  allOutlets: readonly string[]
  excludedOutlets: ReadonlySet<string>
  onToggleOutlet: (outlet: string) => void
  avgCoalition: number
  avgOpposition: number
  avgArabs: number
  avgOppositionPlusArabs: number
  deltaCoalition: number
  deltaOpposition: number
  deltaOppositionPlusArabs: number
}) {
  useEffect(() => {
    if (!open) return
    const syncGrid = document.querySelector('.dashboard-heading-sync-grid')
    const scrollY = window.scrollY
    const prevHtmlOverflow = document.documentElement.style.overflow
    const prevBodyOverflow = document.body.style.overflow

    const applyLayout = () => {
      const rootFontSize =
        parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      const isMobile = window.matchMedia('(max-width: 768px)').matches
      const insetPx = (isMobile ? 0.3 : 0.5) * rootFontSize
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight
      const overlayTop = syncGrid
        ? Math.ceil(syncGrid.getBoundingClientRect().bottom)
        : Math.ceil(5.5 * rootFontSize)
      const dialogHeight = Math.max(0, Math.floor(viewportHeight - overlayTop - insetPx))

      document.documentElement.style.setProperty(
        '--lpo-ps-hero-chart-overlay-top',
        `${overlayTop}px`,
      )
      document.documentElement.style.setProperty(
        '--lpo-ps-hero-chart-dialog-height',
        `${dialogHeight}px`,
      )
    }

    applyLayout()
    document.documentElement.classList.add('lpo-ps-hero-chart-open')
    document.body.classList.add('lpo-ps-hero-chart-open')
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    window.addEventListener('resize', applyLayout)
    window.visualViewport?.addEventListener('resize', applyLayout)

    return () => {
      document.documentElement.classList.remove('lpo-ps-hero-chart-open')
      document.body.classList.remove('lpo-ps-hero-chart-open')
      document.documentElement.style.overflow = prevHtmlOverflow
      document.body.style.overflow = prevBodyOverflow
      document.documentElement.style.removeProperty('--lpo-ps-hero-chart-overlay-top')
      document.documentElement.style.removeProperty('--lpo-ps-hero-chart-dialog-height')
      window.removeEventListener('resize', applyLayout)
      window.visualViewport?.removeEventListener('resize', applyLayout)
      window.scrollTo(0, scrollY)
    }
  }, [open])

  const changedByParty = useMemo(
    () => new Map(changedParties.map((cp) => [cp.party, cp])),
    [changedParties],
  )

  const [mapFilters, setMapFilters] = useState<KnessetMapFilters>([])
  const [matchingPartyKeys, setMatchingPartyKeys] = useState<ReadonlySet<string> | null>(null)

  useEffect(() => {
    if (!open) {
      setMapFilters([])
      setMatchingPartyKeys(null)
    }
  }, [open])

  const focusedSegment =
    mapFilters.find((f) => f.kind === 'segment')?.segment ?? null

  const handleToggleFilter = (next: KnessetMapFocusItem) => {
    setMapFilters((prev) => toggleMapFilter(prev, next))
  }

  const togglePartyFocus = (partyKey: string) => {
    handleToggleFilter({ kind: 'party', partyKey })
  }

  const toggleSegmentFocus = (segment: 'Coalition' | 'Opposition') => {
    handleToggleFilter({ kind: 'segment', segment })
  }

  const rows = useMemo(
    () =>
      [...current.parties]
        .filter((p) => p.votes > 0)
        .sort((a, b) => b.votes - a.votes || a.party.localeCompare(b.party))
        .map((p) => ({ party: p.party, votes: p.votes, segment: p.segment })),
    [current.parties],
  )

  const maxVotes = useMemo(
    () => rows.reduce((max, row) => Math.max(max, row.votes), 0),
    [rows],
  )

  const seatCounts = useMemo(() => seatCountsByParty(current), [current])

  const windowSuffix = t.pollSummaryHeroPartiesChartWindowSuffix.replace(
    /\{n\}/g,
    String(windowDays),
  )

  if (!open) return null

  return createPortal(
    <div className="lpo-ps-hero-chart-overlay" role="presentation">
      <div
        className="lpo-ps-hero-chart-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`${t.pollSummaryHeroPartiesChartTitle}${windowSuffix}`}
        dir={locale === 'he' ? 'rtl' : 'ltr'}
        onClick={(e) => e.stopPropagation()}
      >
        <HeroChartMethodologyInfo locale={locale} t={t} windowDays={windowDays} />
        <HeroChartScaleFit>
        <header className="lpo-ps-hero-chart-dialog-header">
          <div className="lpo-ps-hero-chart-dialog-heading">
            <h2 className="lpo-ps-hero-chart-dialog-title">
              <span className="lpo-ps-hero-chart-dialog-title-main">
                {t.pollSummaryHeroPartiesChartTitle}
              </span>
              <span className="lpo-ps-hero-chart-dialog-title-window">{windowSuffix}</span>
            </h2>
            {hasPrior && changedParties.length > 0 ? (
              <p
                className="lpo-ps-hero-chip-outlet-legend lpo-ps-chip-delta-outlets lpo-ps-hero-chart-delta-legend"
                dir={locale === 'he' ? 'rtl' : 'ltr'}
              >
                {t.pollSummaryHeroChipOutletCountLegend}
                {' · '}
                {t.pollSummaryHeroChipDeltaColorLegend}
              </p>
            ) : null}
            <p
              className="lpo-ps-subtitle lpo-ps-subtitle--outlets-trend-hint lpo-ps-hero-chart-outlet-hint"
              dir={locale === 'he' ? 'rtl' : 'ltr'}
            >
              {t.pollSummaryHeroPartiesChartOutletHint}
            </p>
            <PollSummaryOutletFilterStrip
              allOutlets={allOutlets}
              excludedOutlets={excludedOutlets}
              onToggleOutlet={onToggleOutlet}
              displayMediaOutlet={displayMediaOutlet}
              t={t}
            />
            <div className="lpo-ps-hero-chart-bloc-summary--header">
              <PollSummaryHeroBlocBar
                t={t}
                combineArabsWithOpposition={combineArabsWithOpposition}
                hasPrior={hasPrior}
                avgCoalition={avgCoalition}
                avgOpposition={avgOpposition}
                avgArabs={avgArabs}
                avgOppositionPlusArabs={avgOppositionPlusArabs}
                deltaCoalition={deltaCoalition}
                deltaOpposition={deltaOpposition}
                deltaOppositionPlusArabs={deltaOppositionPlusArabs}
                focusedSegment={focusedSegment}
                onToggleSegmentFocus={toggleSegmentFocus}
                showRoundedSeatMandates
                className="lpo-ps-hero-chart-bloc-bar"
              />
            </div>
          </div>
          <button
            type="button"
            className="lpo-ps-hero-chart-dialog-close"
            onClick={onClose}
            aria-label={t.pollSummaryHeroPartiesChartCloseAria}
          >
            ×
          </button>
        </header>
        <div className="lpo-ps-hero-chart-body">
          <div className="lpo-ps-hero-chart-hemicycle-wrap">
            <div className="lpo-ps-knesset-filters-slot">
              <PollSummaryKnessetFiltersPane
                filters={mapFilters}
                onToggleFilter={handleToggleFilter}
                onReset={() => setMapFilters([])}
                displayParty={displayParty}
                locale={locale}
                t={t}
              />
            </div>
            <PollSummaryKnessetSeatMap
              poll={current}
              displayParty={displayParty}
              locale={locale}
              t={t}
              mapFilters={mapFilters}
              onMapFiltersChange={setMapFilters}
              onMatchingPartyKeysChange={setMatchingPartyKeys}
              mergeArabsWithOpposition={combineArabsWithOpposition}
              stageOverlay={
                <div className="lpo-ps-hero-chart-center-stack">
                  <div className="lpo-ps-hero-chart-table lpo-ps-hero-chart-table--inset" dir="ltr">
                    {rows.map((row, rowIdx) => {
              const barPct = maxVotes > 0 ? (row.votes / maxVotes) * 100 : 0
              const barColor = segmentDisplayColor(row.segment, combineArabsWithOpposition)
              const markColor = PARTY_COLOR_MAP[row.party] ?? barColor
              const cp = changedByParty.get(row.party)
              const delta =
                hasPrior && cp && cp.delta !== 0 ? formatChipNum(Math.abs(cp.delta)) : null
              const deltaDir = cp && cp.delta > 0 ? 'up' : 'down'
              const rowFocused = filtersInclude(mapFilters, {
                kind: 'party',
                partyKey: row.party,
              })
              const rowDimmed =
                mapFilters.length > 0 && !matchingPartyKeys?.has(row.party)

              return (
                <div
                  key={row.party}
                  role="button"
                  tabIndex={0}
                  className={`lpo-ps-hero-chart-row lpo-party-row lpo-ps-hero-chart-row--selectable${
                    rowIdx % 2 === 1 ? ' lpo-party-row--alt' : ''
                  }${row.party === 'The Democrats' ? ' lpo-ps-hero-chart-row--enlarged-mark' : ''}${rowFocused ? ' lpo-ps-hero-chart-row--focused' : ''}${
                    rowDimmed ? ' lpo-ps-hero-chart-row--dimmed' : ''
                  }`}
                  aria-pressed={rowFocused}
                  onClick={() => togglePartyFocus(row.party)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      togglePartyFocus(row.party)
                    }
                  }}
                >
                  <div className="lpo-party-label-col">
                    <HeroChartPartyMark
                      partyKey={row.party}
                      label={displayParty(row.party)}
                      color={markColor}
                    />
                  </div>
                  <div className="lpo-party-cell">
                    <div className="lpo-bar-row lpo-ps-hero-chart-bar-row">
                      <div className="lpo-bar-track lpo-ps-hero-chart-bar-track">
                        <div
                          className="lpo-bar-fill"
                          style={{
                            width: `${barPct}%`,
                            background: barColor,
                          }}
                        />
                      </div>
                      <div className="lpo-ps-hero-chart-bar-meta">
                        <strong className="lpo-votes" style={{ color: barColor }}>
                          {formatChipNum(row.votes)}
                        </strong>
                        <span className="lpo-ps-hero-chart-seats-line">
                          <span className="lpo-ps-hero-chart-seats" title={t.knessetMapListRank.replace(/\{rank\}/g, '1').replace(/\{total\}/g, String(seatCounts.get(row.party) ?? 0))}>
                            ({seatCounts.get(row.party) ?? 0})
                          </span>
                          <span className="lpo-ps-hero-chart-delta-unit" aria-hidden>
                            {t.seats}
                          </span>
                        </span>
                        {delta !== null ? (
                          <span className="lpo-ps-hero-chart-bar-delta">
                            <span className={`lpo-change-badge ${deltaDir}`}>
                              {deltaDir === 'up' ? '+' : '-'}
                              {delta}
                            </span>
                            {cp?.deltaOutletCount && cp.deltaOutletCount > 0 ? (
                              <span className="lpo-ps-hero-chart-delta-line">
                                <span
                                  className="lpo-ps-chip-delta-outlets"
                                  dir="ltr"
                                  title={t.pollSummaryChipDeltaOutletCountTitle.replace(
                                    /\{n\}/g,
                                    String(cp.deltaOutletCount),
                                  )}
                                >
                                  ({cp.deltaOutletCount})
                                </span>
                                <span className="lpo-ps-hero-chart-delta-unit" aria-hidden>
                                  {t.pollsWord}
                                </span>
                              </span>
                            ) : null}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
                  </div>
                </div>
              }
            />
          </div>
        </div>
        </HeroChartScaleFit>
        <footer className="lpo-ps-hero-chart-dialog-footer">
          <div className="app-footer">
            <AppFooter showVoteSmart />
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
