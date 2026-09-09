import { useEffect, useMemo, useState, type RefObject } from 'react'
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

function formatChipNum(n: number): string {
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
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

export function PollSummaryHeroPartiesChartButton({
  onClick,
  ariaLabel,
  label,
}: {
  onClick: () => void
  ariaLabel: string
  label?: string
}) {
  return (
    <div className="lpo-ps-toolbar-micro-label-wrap">
      {label ? (
        <span className="lpo-ps-toolbar-micro-label" aria-hidden>
          {label}
        </span>
      ) : null}
      <button
        type="button"
        className="lpo-ps-hero-parties-chart-btn lpo-ps-outlet-filter-btn"
        onClick={onClick}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
      >
      <svg
        className="lpo-ps-hero-parties-chart-btn-icon"
        width="14"
        height="14"
        viewBox="0 0 16 16"
        aria-hidden
      >
        <rect x="1.5" y="2.5" width="13" height="2.5" rx="0.55" fill="currentColor" />
        <rect x="1.5" y="6.75" width="9" height="2.5" rx="0.55" fill="currentColor" />
        <rect x="1.5" y="11" width="5.5" height="2.5" rx="0.55" fill="currentColor" />
      </svg>
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

    const applyOverlayTop = () => {
      if (!syncGrid) {
        document.documentElement.style.setProperty(
          '--lpo-ps-hero-chart-overlay-top',
          '5.5rem',
        )
        return
      }
      const bottom = syncGrid.getBoundingClientRect().bottom
      document.documentElement.style.setProperty(
        '--lpo-ps-hero-chart-overlay-top',
        `${Math.ceil(bottom)}px`,
      )
    }

    applyOverlayTop()
    document.body.classList.add('lpo-ps-hero-chart-open')
    window.addEventListener('resize', applyOverlayTop)
    window.addEventListener('scroll', applyOverlayTop, true)

    return () => {
      document.body.classList.remove('lpo-ps-hero-chart-open')
      document.documentElement.style.removeProperty('--lpo-ps-hero-chart-overlay-top')
      window.removeEventListener('resize', applyOverlayTop)
      window.removeEventListener('scroll', applyOverlayTop, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

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
    <div
      className="lpo-ps-hero-chart-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="lpo-ps-hero-chart-dialog"
        role="dialog"
        aria-modal="false"
        aria-label={`${t.pollSummaryHeroPartiesChartTitle}${windowSuffix}`}
        dir={locale === 'he' ? 'rtl' : 'ltr'}
        onClick={(e) => e.stopPropagation()}
      >
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
      </div>
    </div>,
    document.body,
  )
}
