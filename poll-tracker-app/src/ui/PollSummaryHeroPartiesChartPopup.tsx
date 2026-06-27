import { useEffect, useMemo, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import type { AppLocale } from '../i18n/localeContext'
import type { UiStrings } from '../i18n/strings'
import {
  MEDIA_ICON_MAP,
  PARTY_ICON_MAP,
  SEGMENT_COLORS,
  segmentRingColorForSummary,
} from '../config/mappings'
import type { ChangedParty, RollingPoll } from '../lib/pollRollingWindow'
import type { Segment } from '../types/data'
import { PollSummaryHeroBlocBar } from './PollSummaryBlocBar'
import { IconWithFallback } from './IconWithFallback'

function formatChipNum(n: number): string {
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

function segmentDisplayColor(segment: Segment, mergeArabsWithOpposition: boolean): string {
  if (mergeArabsWithOpposition && segment === 'Arabs') return SEGMENT_COLORS.Opposition
  return SEGMENT_COLORS[segment]
}

export function PollSummaryHeroPartiesChartButton({
  onClick,
  ariaLabel,
}: {
  onClick: () => void
  ariaLabel: string
}) {
  return (
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
  )
}

export function PollSummaryHeroPartiesChartPopup({
  open,
  onClose,
  current,
  changedParties,
  partyOrder,
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
  partyOrder: readonly string[]
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

  const includedOutletCount = useMemo(
    () => allOutlets.filter((outlet) => !excludedOutlets.has(outlet)).length,
    [allOutlets, excludedOutlets],
  )

  const changedByParty = useMemo(
    () => new Map(changedParties.map((cp) => [cp.party, cp])),
    [changedParties],
  )

  const rows = useMemo(() => {
    const byParty = new Map(current.parties.map((p) => [p.party, p]))
    const order =
      partyOrder.length > 0
        ? partyOrder.map((party) => {
            const row = byParty.get(party)
            return {
              party,
              votes: row?.votes ?? 0,
              segment: row?.segment ?? ('Opposition' as Segment),
            }
          })
        : [...current.parties]
            .filter((p) => p.votes > 0)
            .sort((a, b) => b.votes - a.votes || a.party.localeCompare(b.party))
            .map((p) => ({ party: p.party, votes: p.votes, segment: p.segment }))
    return order.filter((p) => p.votes > 0)
  }, [current.parties, partyOrder])

  const maxVotes = useMemo(
    () => rows.reduce((max, row) => Math.max(max, row.votes), 0),
    [rows],
  )

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
            <p
              className="lpo-ps-subtitle lpo-ps-subtitle--outlets-trend-hint lpo-ps-hero-chart-outlet-hint"
              dir={locale === 'he' ? 'rtl' : 'ltr'}
            >
              {t.pollSummaryHeroPartiesChartOutletHint}
            </p>
            <div
              className="lpo-ps-hero-chart-outlets"
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
                    <IconWithFallback
                      src={MEDIA_ICON_MAP[outlet]}
                      label={outletLabel}
                    />
                  </button>
                )
              })}
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
          <div className="lpo-ps-hero-chart-bloc-summary">
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
              className="lpo-ps-hero-chart-bloc-bar"
            />
          </div>
          <div className="lpo-ps-hero-chart-table" dir="ltr">
            {rows.map((row, rowIdx) => {
              const barPct = maxVotes > 0 ? (row.votes / maxVotes) * 100 : 0
              const barColor = segmentDisplayColor(row.segment, combineArabsWithOpposition)
              const ringColor = segmentRingColorForSummary(
                row.segment,
                combineArabsWithOpposition,
              )
              const cp = changedByParty.get(row.party)
              const delta =
                hasPrior && cp && cp.delta !== 0 ? formatChipNum(Math.abs(cp.delta)) : null
              const deltaDir = cp && cp.delta > 0 ? 'up' : 'down'

              return (
                <div
                  key={row.party}
                  className={`lpo-ps-hero-chart-row lpo-party-row${rowIdx % 2 === 1 ? ' lpo-party-row--alt' : ''}`}
                >
                  <div className="lpo-party-label-col">
                    <div
                      className="lpo-ps-chip-ring lpo-ps-hero-chart-party-ring"
                      style={
                        { '--lpo-ps-chip-segment': ringColor } as CSSProperties
                      }
                    >
                      <IconWithFallback
                        src={PARTY_ICON_MAP[row.party]}
                        label={displayParty(row.party)}
                      />
                    </div>
                    <span className="lpo-party-name">{displayParty(row.party)}</span>
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
                        {delta !== null ? (
                          <span className={`lpo-change-badge ${deltaDir}`}>
                            {deltaDir === 'up' ? '+' : '-'}
                            {delta}
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
      </div>
    </div>,
    document.body,
  )
}
