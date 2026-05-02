import { useMemo, useState, useCallback, useRef, useEffect, useLayoutEffect, useId, type ReactNode } from 'react'
import type { UnpivotRow, ResidualRow, PartyDimRow, MediaOutletDimRow, HouseEffectCell } from '@shared/types/data'
import type { HistoricalAccuracyResult } from '@shared/types/data'
import {
  computeResiduals,
  computeHouseEffects,
  computeBlocTilt,
  computeOutletAnomalies,
  listResidualDiagnostics,
  ARAB_COMBINED,
} from '@shared/lib/mediaBiasAnalysis'
import { KNESSET25_COALITION_BLOC_SEATS_ACTUAL } from '@shared/lib/historicalPolls2022'
import {
  PARTY_ICON_MAP,
  MEDIA_ICON_MAP,
  ENGLISH_MEDIA_NAMES,
  ENGLISH_PARTY_DISPLAY_OVERRIDES,
  HEBREW_PARTY_DISPLAY_OVERRIDES,
} from '@shared/config/mappings'
import { sharedPublicUrl } from '../utils/sharedPublicUrl'
import type { MediaBiasData } from '../hooks/useMediaBiasData'
import { useLocale } from '../i18n/useLocale'
import { MB, type MbUiStrings } from '../i18n/strings'
import { MbCsvExportMenu } from './MbCsvExportMenu'
import { downloadHarmonizedCsv } from '../utils/exportHarmonizedCsv'
import { downloadResidualDiagnosticsCsv } from '../utils/exportResidualDiagnosticsCsv'

/** Benjamini–Hochberg FDR threshold — must match gold border on heatmap cells. */
const MB_FDR_ALPHA = 0.05

/** Faint cell labels when |mean raw residual| is tiny — keep in sync with legend copy in `strings.ts`. */
const MB_NEAR_ZERO_TEXT_RESID_THRESHOLD = 0.5

function isHouseEffectFdrSignificant(c: HouseEffectCell): boolean {
  return c.pAdj !== null && c.pAdj < MB_FDR_ALPHA
}

// ─── Latest-poll party seats (same poll ordering as LatestPollsOverviewPage) ─

/** Newest survey in the data (date desc, then pollId desc). Per-party seat lines. */
function getLatestPollPartySeats(harmonized: UnpivotRow[]): Map<string, number> {
  const byPoll = new Map<number, { date: string; votes: Map<string, number> }>()
  for (const r of harmonized) {
    if (!r.date) continue
    if (!byPoll.has(r.pollId)) {
      byPoll.set(r.pollId, { date: r.date, votes: new Map() })
    }
    byPoll.get(r.pollId)!.votes.set(r.party, r.votes)
  }
  const entries = [...byPoll.entries()]
  if (!entries.length) return new Map()
  entries.sort((a, b) => {
    const d = b[1].date.localeCompare(a[1].date)
    if (d !== 0) return d
    return b[0] - a[0]
  })
  return entries[0]![1].votes
}

// ─── Locale-aware name helpers ────────────────────────────────────────────────

/** Returns a function that maps an English party key to its locale display name. */
function usePartyLabel(partiesDim: PartyDimRow[], t: MbUiStrings, locale: string) {
  return useMemo(() => {
    const hebMap = new Map<string, string>()
    for (const p of partiesDim) if (p.partyHeb) hebMap.set(p.party, p.partyHeb)
    return (party: string) => {
      if (locale === 'he') {
        if (party === ARAB_COMBINED) return t.arabCombinedHe
        const heOverride = HEBREW_PARTY_DISPLAY_OVERRIDES[party]
        if (heOverride) return heOverride
        return hebMap.get(party) ?? party
      }
      return ENGLISH_PARTY_DISPLAY_OVERRIDES[party] ?? party
    }
  }, [partiesDim, locale, t])
}

/** Returns a function that maps a Hebrew outlet key to its locale display name.
 *  Uses ENGLISH_MEDIA_NAMES (same source as poll-tracker-app) for EN; falls
 *  back to the Hebrew key unchanged for HE or unknown outlets. */
function useOutletLabel(_mediaOutletsDim: MediaOutletDimRow[], locale: string) {
  return useMemo(
    () => (outlet: string) => locale === 'en' ? (ENGLISH_MEDIA_NAMES[outlet] ?? outlet) : outlet,
    [locale],
  )
}

// ─── Outlet filter dropdown ───────────────────────────────────────────────────

/** Feather-style cog (stroke) — reads as a gear at small size */
function SettingsGearIcon() {
  return (
    <svg className="lpo-mb-settings-gear-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
      />
    </svg>
  )
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

function OutletFilterDropdown({
  allOutlets,
  excludedOutlets,
  onToggle,
  onClear,
  locale,
  outletLabel,
}: {
  allOutlets: string[]
  excludedOutlets: Set<string>
  onToggle: (outlet: string) => void
  onClear: () => void
  locale: string
  outletLabel: (o: string) => string
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const hiddenCount = allOutlets.filter(o => excludedOutlets.has(o)).length

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
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
        className={`lpo-ps-outlet-filter-btn${hiddenCount > 0 ? ' lpo-ps-outlet-filter-btn--active' : ''}`}
        onClick={() => setOpen(v => !v)}
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
          {allOutlets.map(outlet => {
            const included = !excludedOutlets.has(outlet)
            return (
              <label key={outlet} className="lpo-ps-outlet-filter-item">
                <input
                  type="checkbox"
                  checked={included}
                  onChange={() => onToggle(outlet)}
                />
                <span className="lpo-ps-outlet-filter-ico">
                  <img src={sharedPublicUrl(MEDIA_ICON_MAP[outlet] ?? '')} alt={outlet} />
                </span>
                <span className="lpo-ps-outlet-filter-name">{outletLabel(outlet)}</span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Icon helpers ─────────────────────────────────────────────────────────────

function IconBadge({
  src,
  label,
  size = 22,
  ringColor,
}: {
  src?: string
  label: string
  size?: number
  /** CSS colour for the circular border ring (e.g. bloc colour). */
  ringColor?: string
}) {
  const [broken, setBroken] = useState(false)
  const base = { width: size, height: size, borderRadius: '50%', flexShrink: 0 } as const
  const style = ringColor
    ? { ...base, border: `2.5px solid ${ringColor}` }
    : base

  if (!src || broken) {
    return (
      <span className="lpo-mb-icon-fallback" style={style}>
        {label.slice(0, 2)}
      </span>
    )
  }
  return (
    <img
      src={sharedPublicUrl(src)}
      alt={label}
      className="lpo-mb-icon"
      style={style}
      onError={() => setBroken(true)}
    />
  )
}

// ─── Color helpers ────────────────────────────────────────────────────────────

/**
 * Cyan-Magenta diverging scale (matches the attached palette swatch):
 *   positive (over-reports coalition) → turquoise  rgb(0, 196, 180)
 *   negative (over-reports opposition) → hot pink   rgb(224, 102, 160)
 * Near-zero cells stay at the dark surface (#1a2236 ≈ rgb 26, 34, 54).
 * Both endpoint colours are bright enough to need dark text at high magnitudes.
 */
function residualColor(resid: number, maxAbs = 6): string {
  const t = Math.max(-maxAbs, Math.min(maxAbs, resid)) / maxAbs
  const abs = Math.abs(t)
  if (t >= 0) {
    // base → turquoise (0, 196, 180)
    const r = Math.round(26 + (0   - 26) * abs)
    const g = Math.round(34 + (196 - 34) * abs)
    const b = Math.round(54 + (180 - 54) * abs)
    return `rgb(${r},${g},${b})`
  } else {
    // base → hot pink (224, 102, 160)
    const r = Math.round(26 + (224 - 26) * abs)
    const g = Math.round(34 + (102 - 34) * abs)
    const b = Math.round(54 + (160 - 54) * abs)
    return `rgb(${r},${g},${b})`
  }
}

function cellTextColor(resid: number): string {
  if (Math.abs(resid) < MB_NEAR_ZERO_TEXT_RESID_THRESHOLD) return 'rgba(180,200,230,0.35)'
  // Both turquoise and pink get bright at high magnitudes → dark text for readability.
  if (Math.abs(resid) > 3.5) return '#0f1520'
  return '#ffffff'
}

function fmtSigned(v: number, decimals = 2): string {
  const s = v.toFixed(decimals)
  return v >= 0 ? `+${s}` : s
}

function fmtP(v: number): string {
  return v.toFixed(3)
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

type TooltipState = {
  cell: HouseEffectCell
  x: number
  y: number
}

function CellTooltip({
  tip,
  t,
  partyLabel,
}: {
  tip: TooltipState
  t: MbUiStrings
  partyLabel: (party: string) => string
}) {
  const { cell } = tip
  const pAdjText = cell.pAdj !== null ? fmtP(cell.pAdj) : t.tooltipPAdjExcluded

  const left = Math.min(tip.x + 12, (typeof window !== 'undefined' ? window.innerWidth : 800) - 230)
  const top = tip.y - 8

  return (
    <div
      className="lpo-mb-tooltip"
      style={{ position: 'fixed', left, top, transform: 'translateY(-100%)' }}
    >
      <div className="lpo-mb-tooltip-header">
        {cell.outlet}&nbsp;&nbsp;·&nbsp;&nbsp;{partyLabel(cell.party)}
      </div>
      <div className="lpo-mb-tooltip-rule" />
      <div className="lpo-mb-tooltip-row">
        <span>{t.tooltipN}</span><span>{cell.n}</span>
      </div>
      <div className="lpo-mb-tooltip-row">
        <span>{t.tooltipRawMean}</span><span>{fmtSigned(cell.meanRawResid)} seats</span>
      </div>
      <div className="lpo-mb-tooltip-row">
        <span>{t.tooltipDampenedMean}</span><span>{fmtSigned(cell.meanStatResid)}</span>
      </div>
      <div className="lpo-mb-tooltip-row">
        <span>{t.tooltipPValue}</span><span>{fmtP(cell.p)}</span>
      </div>
      <div className={`lpo-mb-tooltip-row ${cell.pAdj === null ? 'lpo-mb-tooltip-row--muted' : ''}`}>
        <span>{t.tooltipPAdj}</span><span>{pAdjText}</span>
      </div>
    </div>
  )
}

// ─── Total cell ───────────────────────────────────────────────────────────────

function TotalCell({ value, isGrand = false }: { value: number | null; isGrand?: boolean }) {
  if (value === null) return <td className="lpo-mb-cell lpo-mb-cell--empty" />
  const bg = residualColor(value)
  const color = cellTextColor(value)
  return (
    <td
      className={`lpo-mb-cell lpo-mb-cell--total ${isGrand ? 'lpo-mb-cell--grand' : ''}`}
      style={{ background: bg, color }}
    >
      {fmtSigned(value, 1)}
    </td>
  )
}

// ─── Section 1: Heatmap ───────────────────────────────────────────────────────

function HeatmapSection({
  houseEffects,
  harmonized,
  partiesDim,
  mediaOutletsDim,
  outletOrder,
  eligibleOutlets,
  excludedOutlets,
  onToggleOutlet,
  onClearOutlets,
  t,
}: {
  houseEffects: HouseEffectCell[]
  harmonized: UnpivotRow[]
  partiesDim: PartyDimRow[]
  mediaOutletsDim: MediaOutletDimRow[]
  outletOrder: string[]
  eligibleOutlets: string[]
  excludedOutlets: Set<string>
  onToggleOutlet: (outlet: string) => void
  onClearOutlets: () => void
  t: MbUiStrings
}) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [partySortBy, setPartySortBy] = useState<'seats' | 'bias'>('bias')

  const heatmapSplitRef = useRef<HTMLDivElement>(null)
  const frozenTheadRowRef = useRef<HTMLTableRowElement>(null)
  const scrollTheadRowRef = useRef<HTMLTableRowElement>(null)
  const scrollFirstBodyRowRef = useRef<HTMLTableRowElement>(null)

  const { locale } = useLocale()
  const partyLabel = usePartyLabel(partiesDim, t, locale)
  const outletLabel = useOutletLabel(mediaOutletsDim, locale)

  const segMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of partiesDim) m.set(p.party, p.segment)
    m.set(ARAB_COMBINED, 'Opposition')
    return m
  }, [partiesDim])

  const latestPollSeats = useMemo(() => getLatestPollPartySeats(harmonized), [harmonized])

  const partyIdByParty = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of partiesDim) m.set(p.party, p.partyId)
    return m
  }, [partiesDim])

  const cellMap = useMemo(() => {
    const m = new Map<string, HouseEffectCell>()
    for (const c of houseEffects) m.set(`${c.outlet}\x00${c.party}`, c)
    return m
  }, [houseEffects])

  // Sum of raw mean residuals for FDR-significant outlet cells in this party's row only
  const partySignificantResidualSum = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of houseEffects) {
      if (!isHouseEffectFdrSignificant(c)) continue
      const prev = m.get(c.party) ?? 0
      m.set(c.party, prev + c.meanRawResid)
    }
    return m
  }, [houseEffects])

  const { allParties, coalitionParties, oppositionParties } = useMemo(() => {
    const inHeatmap = new Set(houseEffects.map(c => c.party))
    const sortFn =
      partySortBy === 'bias'
        ? (a: string, b: string) =>
            Math.abs(partySignificantResidualSum.get(b) ?? 0) -
            Math.abs(partySignificantResidualSum.get(a) ?? 0)
        : (a: string, b: string) => {
            const sb = latestPollSeats.get(b) ?? 0
            const sa = latestPollSeats.get(a) ?? 0
            if (sb !== sa) return sb - sa
            return (partyIdByParty.get(a) ?? 0) - (partyIdByParty.get(b) ?? 0)
          }

    const all = [...inHeatmap].sort(sortFn)
    const coalition = all.filter(p => segMap.get(p) === 'Coalition')
    const opposition = all.filter(p => segMap.get(p) === 'Opposition' || segMap.get(p) === 'Arabs')
    return { allParties: all, coalitionParties: coalition, oppositionParties: opposition }
  }, [houseEffects, segMap, latestPollSeats, partyIdByParty, partySignificantResidualSum, partySortBy])

  // Per-outlet sum of meanRawResid across coalition parties
  const outletCoalitionSum = useMemo(() => {
    const m = new Map<string, number>()
    for (const outlet of outletOrder) {
      const vals = coalitionParties
        .map(p => cellMap.get(`${outlet}\x00${p}`)?.meanRawResid)
        .filter((v): v is number => v !== undefined)
      if (vals.length) m.set(outlet, vals.reduce((s, v) => s + v, 0))
    }
    return m
  }, [coalitionParties, outletOrder, cellMap])

  // Per-outlet sum of meanRawResid across opposition parties
  const outletOppositionSum = useMemo(() => {
    const m = new Map<string, number>()
    for (const outlet of outletOrder) {
      const vals = oppositionParties
        .map(p => cellMap.get(`${outlet}\x00${p}`)?.meanRawResid)
        .filter((v): v is number => v !== undefined)
      if (vals.length) m.set(outlet, vals.reduce((s, v) => s + v, 0))
    }
    return m
  }, [oppositionParties, outletOrder, cellMap])

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent, cell: HouseEffectCell) => {
      setTooltip({ cell, x: e.clientX, y: e.clientY })
    },
    [],
  )
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      setTooltip(t => (t ? { ...t, x: e.clientX, y: e.clientY } : null))
    },
    [],
  )
  const handleMouseLeave = useCallback(() => setTooltip(null), [])

  const heatmapLayoutSyncKey = `${partySortBy}\t${locale}\t${outletOrder.join('\0')}\t${allParties.join('\0')}\t${[...excludedOutlets].sort().join('\0')}`

  useLayoutEffect(() => {
    if (outletOrder.length === 0 || allParties.length === 0) return
    const split = heatmapSplitRef.current
    const frozenTh = frozenTheadRowRef.current
    const scrollTh = scrollTheadRowRef.current
    const scrollRow0 = scrollFirstBodyRowRef.current
    if (!split || !scrollTh) return

    const apply = () => {
      const theadH = scrollTh.getBoundingClientRect().height
      if (frozenTh) frozenTh.style.height = `${Math.round(theadH * 1000) / 1000}px`
      if (scrollRow0) {
        const rh = scrollRow0.getBoundingClientRect().height
        split.style.setProperty('--mb-heatmap-data-row', `${Math.round(rh * 1000) / 1000}px`)
      } else {
        split.style.removeProperty('--mb-heatmap-data-row')
      }
    }

    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(scrollTh)
    if (scrollRow0) ro.observe(scrollRow0)
    window.addEventListener('resize', apply)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', apply)
      if (frozenTh) frozenTh.style.height = ''
      split.style.removeProperty('--mb-heatmap-data-row')
    }
  }, [heatmapLayoutSyncKey, outletOrder.length, allParties.length])

  if (outletOrder.length === 0 || allParties.length === 0) {
    return <p className="lpo-mb-empty">{t.noData}</p>
  }

  const outletHeaderCells = outletOrder.map(outlet => {
    const cs = outletCoalitionSum.get(outlet)
    const os = outletOppositionSum.get(outlet)
    return (
      <th key={outlet} className="lpo-mb-th-party" title={ENGLISH_MEDIA_NAMES[outlet]}>
        <div className="lpo-mb-th-party-inner">
          <IconBadge src={MEDIA_ICON_MAP[outlet]} label={outlet} size={35} />
          <span className="lpo-mb-th-party-abbr">{outletLabel(outlet)}</span>
          <div className="lpo-mb-outlet-score-pills">
            {cs !== undefined && (
              <span
                className="lpo-mb-outlet-pill"
                style={{ background: residualColor(cs), color: cellTextColor(cs) }}
                title={`Coalition Σ: ${fmtSigned(cs, 1)}`}
              >
                C {fmtSigned(cs, 1)}
              </span>
            )}
            {os !== undefined && (
              <span
                className="lpo-mb-outlet-pill"
                style={{ background: residualColor(os), color: cellTextColor(os) }}
                title={`Opposition Σ: ${fmtSigned(os, 1)}`}
              >
                O {fmtSigned(os, 1)}
              </span>
            )}
          </div>
        </div>
      </th>
    )
  })

  return (
    <div className="lpo-mb-heatmap-wrap">
        {tooltip && <CellTooltip tip={tooltip} t={t} partyLabel={partyLabel} />}
      <div className="lpo-mb-heatmap-split-outer">
        <div ref={heatmapSplitRef} className="lpo-mb-heatmap-split" dir="ltr">
        {/* Left: frozen party column + corner (PollSummaryPanel-style split) */}
        <div className="lpo-mb-heatmap-frozen" role="presentation">
          <table className="lpo-mb-heatmap-frozen-table">
            <thead>
              <tr ref={frozenTheadRowRef}>
                <th className="lpo-mb-th-outlet">
                  <div className="lpo-mb-th-outlet-inner">
                    <OutletFilterDropdown
                      allOutlets={eligibleOutlets}
                      excludedOutlets={excludedOutlets}
                      onToggle={onToggleOutlet}
                      onClear={onClearOutlets}
                      locale={locale}
                      outletLabel={outletLabel}
                    />
                    <div className="lpo-mb-bloc-legend">
                      <span className="lpo-mb-bloc-legend-label lpo-mb-bloc-legend-label--coalition">{t.coalition}</span>
                      <span className="lpo-mb-bloc-legend-label lpo-mb-bloc-legend-label--opposition">{t.opposition}</span>
                    </div>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {allParties.map(party => {
                const isCoalition = segMap.get(party) === 'Coalition'
                return (
                  <tr key={party}>
                    <td
                      className={`lpo-mb-td-outlet ${isCoalition ? 'lpo-mb-td-outlet--coalition' : 'lpo-mb-td-outlet--opposition'}`}
                      title={party}
                    >
                      <div className="lpo-mb-td-outlet-inner">
                        <IconBadge
                          src={PARTY_ICON_MAP[party]}
                          label={party}
                          size={35}
                          ringColor={isCoalition ? '#0166DF' : '#e8ecf2'}
                        />
                        <span className="lpo-mb-td-outlet-name">{partyLabel(party)}</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {/* Right: horizontally scrollable outlet + bias columns */}
        <div className="lpo-mb-heatmap-scroll-wrap" role="region" tabIndex={0} aria-label={t.tabHeatmap}>
          <div className="lpo-mb-heatmap-scroll-x">
            <table className="lpo-mb-heatmap-scroll-table">
              <thead>
                <tr ref={scrollTheadRowRef}>
                  {outletHeaderCells}
                  <th
                    className="lpo-mb-th-party lpo-mb-th-bias-col"
                    title={t.biasColHeaderTooltip}
                  >
                    <div className="lpo-mb-bias-sort-wrap" dir={locale === 'he' ? 'rtl' : 'ltr'}>
                      <span className="lpo-mb-bias-sort-caption">{t.sortByCaption}</span>
                      <div
                        className="locale-toggle locale-toggle--vertical"
                        role="group"
                        aria-label={t.sortToggleAria}
                      >
                        <button
                          type="button"
                          className={`locale-toggle-btn${partySortBy === 'bias' ? ' active' : ''}`}
                          onClick={() => setPartySortBy('bias')}
                        >
                          {t.sortToggleBias}
                        </button>
                        <button
                          type="button"
                          className={`locale-toggle-btn${partySortBy === 'seats' ? ' active' : ''}`}
                          onClick={() => setPartySortBy('seats')}
                        >
                          {t.sortToggleSeats}
                        </button>
                      </div>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {allParties.map((party, partyRowIdx) => (
                  <tr key={party} ref={partyRowIdx === 0 ? scrollFirstBodyRowRef : undefined}>
                    {outletOrder.map(outlet => {
                      const cell = cellMap.get(`${outlet}\x00${party}`)
                      return (
                        <HeatmapCell
                          key={outlet}
                          cell={cell ?? null}
                          onMouseEnter={handleMouseEnter}
                          onMouseMove={handleMouseMove}
                          onMouseLeave={handleMouseLeave}
                        />
                      )
                    })}
                    <TotalCell value={partySignificantResidualSum.get(party) ?? null} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="lpo-mb-heatmap-legend">
            {/* Diverging color bar: under-reports ← 0 → over-reports */}
            {(() => {
              const vals = houseEffects.filter(c => c.pAdj !== null).map(c => c.meanRawResid)
              const minR = vals.length ? Math.min(...vals) : -6
              const maxR = vals.length ? Math.max(...vals) : 6
              return (
                <span className="lpo-mb-legend-bar-wrap">
                  <span className="lpo-mb-legend-bar-end lpo-mb-legend-bar-end--under">
                    <span className="lpo-mb-legend-bar-endval">{fmtSigned(minR, 1)}</span>
                    <span className="lpo-mb-legend-bar-endlabel">{t.legendUnder}</span>
                  </span>
                  <span className="lpo-mb-legend-bar-outer">
                    <span className="lpo-mb-legend-bar" />
                    <span className="lpo-mb-legend-bar-zero">0</span>
                  </span>
                  <span className="lpo-mb-legend-bar-end lpo-mb-legend-bar-end--over">
                    <span className="lpo-mb-legend-bar-endval">{fmtSigned(maxR, 1)}</span>
                    <span className="lpo-mb-legend-bar-endlabel">{t.legendOver}</span>
                  </span>
                </span>
              )
            })()}
            &emsp;
            <span className="lpo-mb-legend-sig-box" /> {t.legendFdr}
            &emsp;
            <span className="lpo-mb-legend-excl">{t.legendFaintDigits}</span>{' '}
            {t.legendFaintDigitsExplain}
          </p>
        </div>
        </div>
      </div>
    </div>
  )
}

function HeatmapCell({
  cell,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
}: {
  cell: HouseEffectCell | null
  onMouseEnter: (e: React.MouseEvent, cell: HouseEffectCell) => void
  onMouseMove: (e: React.MouseEvent) => void
  onMouseLeave: () => void
}) {
  if (!cell) {
    return <td className="lpo-mb-cell lpo-mb-cell--empty" />
  }

  const isExcluded = cell.pAdj === null
  const isSig = !isExcluded && isHouseEffectFdrSignificant(cell)
  const bg = isExcluded ? undefined : residualColor(cell.meanRawResid)
  const textColor = isExcluded ? undefined : cellTextColor(cell.meanRawResid)
  const label = fmtSigned(cell.meanRawResid, 1)

  return (
    <td
      className={[
        'lpo-mb-cell',
        isExcluded ? 'lpo-mb-cell--excluded' : '',
        isSig ? 'lpo-mb-cell--sig' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ background: bg, color: textColor }}
      onMouseEnter={e => onMouseEnter(e, cell)}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      {label}
    </td>
  )
}

// ─── Section 2: Bloc Tilt ─────────────────────────────────────────────────────

function BlocTiltSection({
  houseEffects,
  outletOrder,
  accuracy,
  mediaOutletsDim,
  t,
}: {
  houseEffects: HouseEffectCell[]
  outletOrder: string[]
  accuracy: Record<string, HistoricalAccuracyResult>
  mediaOutletsDim: MediaOutletDimRow[]
  t: MbUiStrings
}) {
  const blocTilt = useMemo(() => computeBlocTilt(houseEffects), [houseEffects])

  const tiltByOutlet = useMemo(() => {
    const m = new Map(blocTilt.map(b => [b.outlet, b]))
    return m
  }, [blocTilt])

  const maxAbsTilt = Math.max(
    1,
    ...outletOrder.map(o => Math.abs(tiltByOutlet.get(o)?.tilt ?? 0)),
  )

  const coalitionScaleMax = useMemo(() => {
    let m = KNESSET25_COALITION_BLOC_SEATS_ACTUAL
    for (const o of outletOrder) {
      const r = accuracy[o]
      if (r && r.hasData) m = Math.max(m, r.coalitionPred)
    }
    return Math.max(68, Math.ceil(m / 4) * 4 + 4)
  }, [outletOrder, accuracy])

  const biasNote = useMemo(() => {
    const m = new Map<string, string>()
    for (const o of mediaOutletsDim) if (o.biasNote) m.set(o.mediaOutlet, o.biasNote)
    return m
  }, [mediaOutletsDim])

  const { locale } = useLocale()
  const outletLabel = useOutletLabel(mediaOutletsDim, locale)

  const actualPct = Math.min(
    100,
    (KNESSET25_COALITION_BLOC_SEATS_ACTUAL / coalitionScaleMax) * 100,
  )

  if (outletOrder.length === 0) return null

  return (
    <div className="lpo-mb-tilt-section">
      <div className="lpo-mb-tilt-axis-labels">
        <div aria-hidden className="lpo-mb-tilt-axis-corner" />
        <div className="lpo-mb-tilt-axis-tilt-span">
          <span className="lpo-mb-tilt-label--opp">{t.tiltLabelOpposition}</span>
          <span className="lpo-mb-tilt-label--coal">{t.tiltLabelCoalition}</span>
        </div>
        <div aria-hidden className="lpo-mb-tilt-axis-num-spacer" />
        <div className="lpo-mb-tilt-axis-coal-head">
          <span className="lpo-mb-coal-chart-col-caption">{t.tiltCoalPollVsActualCaption}</span>
          <span className="lpo-mb-coal-chart-col-legend" aria-hidden>
            {t.tiltCoalGaugeLegendBlurb}
          </span>
        </div>
        <div aria-hidden className="lpo-mb-tilt-axis-tr-head" />
      </div>
      {outletOrder.map(outlet => {
        const b = tiltByOutlet.get(outlet)
        const tilt = b?.tilt ?? 0
        const barPct = (Math.abs(tilt) / maxAbsTilt) * 48
        const acc = accuracy[outlet]
        const en = ENGLISH_MEDIA_NAMES[outlet] ?? outlet
        const note = biasNote.get(outlet)

        let coalBody: ReactNode
        if (acc && acc.hasData) {
          const pollSeats = acc.coalitionPred
          const predPct = Math.min(100, (pollSeats / coalitionScaleMax) * 100)
          coalBody = (
            <div
              className="lpo-mb-coal-gauge-wrap"
              dir="ltr"
              role="group"
              aria-label={t.tiltCoalPollGaugeAria(
                Math.round(pollSeats),
                KNESSET25_COALITION_BLOC_SEATS_ACTUAL,
              )}
            >
              <div className="lpo-mb-coal-gauge-track">
                <div className="lpo-mb-coal-gauge-fill" style={{ width: `${predPct}%` }} />
                <div className="lpo-mb-coal-gauge-target" style={{ left: `${actualPct}%` }}>
                  <span className="lpo-mb-coal-gauge-target-pin" aria-hidden />
                </div>
              </div>
              <div className="lpo-mb-coal-gauge-stats">
                <span className="lpo-mb-coal-gauge-pred">{Math.round(pollSeats)}</span>
                <span className="lpo-mb-coal-gauge-sep" aria-hidden>
                  /
                </span>
                <span className="lpo-mb-coal-gauge-actual-num">
                  {KNESSET25_COALITION_BLOC_SEATS_ACTUAL}
                </span>
              </div>
            </div>
          )
        } else {
          coalBody = <span className="lpo-mb-coal-gauge-na">—</span>
        }

        return (
          <div key={outlet} className="lpo-mb-tilt-row">
            <div className="lpo-mb-tilt-outlet-col">
              <div className="lpo-mb-tilt-outlet-name-row">
                <IconBadge src={MEDIA_ICON_MAP[outlet]} label={outlet} size={28} />
                <div className="lpo-mb-tilt-outlet-labels">
                  <span className="lpo-mb-tilt-outlet-name">{outletLabel(outlet)}</span>
                  {locale === 'he' && en !== outlet && (
                    <span className="lpo-mb-tilt-outlet-en">{en}</span>
                  )}
                </div>
              </div>
              {note && <span className="lpo-mb-tilt-bias-note">{note}</span>}
            </div>

            <div className="lpo-mb-tilt-bar-area">
              <div className="lpo-mb-tilt-center-rule" />
              {tilt !== 0 && (
                <div
                  className={`lpo-mb-tilt-bar ${tilt > 0 ? 'lpo-mb-tilt-bar--coalition' : 'lpo-mb-tilt-bar--opposition'}`}
                  style={{
                    width: `${barPct}%`,
                    ...(tilt > 0
                      ? { left: '50%' }
                      : { right: '50%' }),
                  }}
                />
              )}
            </div>

            <div className="lpo-mb-tilt-value-col">
              <span
                className={`lpo-mb-tilt-value ${tilt > 0 ? 'lpo-mb-tilt-value--pos' : tilt < 0 ? 'lpo-mb-tilt-value--neg' : ''}`}
              >
                {fmtSigned(tilt, 1)}
              </span>
            </div>

            <div className="lpo-mb-coal-chart-cell">{coalBody}</div>

            <div className="lpo-mb-track-record">
              {acc && acc.hasData ? (
                <>
                  <span className="lpo-mb-tr-label">{t.trackRecord2022}</span>
                  {' '}
                  <span className="lpo-mb-tr-mae">{t.trackRecordMae} {acc.mae.toFixed(1)}</span>
                  {' · '}
                  <span
                    className={`lpo-mb-tr-bloc ${acc.coalitionBlocError > 0 ? 'lpo-mb-tr-bloc--pos' : acc.coalitionBlocError < 0 ? 'lpo-mb-tr-bloc--neg' : ''}`}
                  >
                    {t.trackRecordBlocError} {acc.coalitionBlocError > 0 ? '+' : ''}{acc.coalitionBlocError}
                  </span>
                </>
              ) : (
                <span className="lpo-mb-tr-na">{t.trackRecordNoData}</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Section 3: Anomaly List ──────────────────────────────────────────────────

function AnomalySection({
  residuals,
  partiesDim,
  mediaOutletsDim,
  t,
}: {
  residuals: ResidualRow[]
  partiesDim: PartyDimRow[]
  mediaOutletsDim: MediaOutletDimRow[]
  t: MbUiStrings
}) {
  const [zThreshold, setZThreshold] = useState(2.5)
  const [minN, setMinN] = useState(6)
  const [selectedOutlet, setSelectedOutlet] = useState('')

  const { locale } = useLocale()
  const partyLabel = usePartyLabel(partiesDim, t, locale)
  const outletLabel = useOutletLabel(mediaOutletsDim, locale)

  const allOutlets = useMemo(
    () => [...new Set(residuals.map(r => r.mediaOutlet))].sort(),
    [residuals],
  )

  const anomalies = useMemo(
    () => computeOutletAnomalies(residuals, { zThreshold, minN }),
    [residuals, zThreshold, minN],
  )

  const filtered = useMemo(() => {
    const base = selectedOutlet
      ? anomalies.filter(a => a.outlet === selectedOutlet)
      : anomalies
    return base.sort((a, b) => Math.abs(b.z) - Math.abs(a.z))
  }, [anomalies, selectedOutlet])

  return (
    <div className="lpo-mb-anomaly-section">
      <div className="lpo-mb-anomaly-controls">
        <label className="lpo-mb-control-label">
          {t.anomalyOutletLabel}
          <select
            className="lpo-mb-select"
            value={selectedOutlet}
            onChange={e => setSelectedOutlet(e.target.value)}
          >
            <option value="">{t.anomalyAllOutlets}</option>
            {allOutlets.map(o => (
              <option key={o} value={o}>{outletLabel(o)}</option>
            ))}
          </select>
        </label>

        <label className="lpo-mb-control-label">
          {t.anomalyZLabel}<strong>{zThreshold.toFixed(1)}</strong>
          <input
            type="range"
            className="lpo-mb-slider"
            min="2.0"
            max="3.0"
            step="0.1"
            value={zThreshold}
            onChange={e => setZThreshold(Number(e.target.value))}
          />
        </label>

        <label className="lpo-mb-control-label">
          {t.anomalyMinPollsLabel}
          <input
            type="number"
            className="lpo-mb-number"
            min={3}
            max={20}
            value={minN}
            onChange={e => setMinN(Math.min(20, Math.max(3, Number(e.target.value))))}
          />
        </label>

        <span className="lpo-mb-anomaly-count">{filtered.length} {t.anomalyFlagged}</span>
      </div>

      {filtered.length === 0 ? (
        <p className="lpo-mb-empty">{t.noAnomalies}</p>
      ) : (
        <div className="lpo-mb-anomaly-table-wrap">
          <table className="lpo-mb-anomaly-table">
            <thead>
              <tr>
                <th>{t.anomalyColOutlet}</th>
                <th>{t.anomalyColDate}</th>
                <th>{t.anomalyColParty}</th>
                <th className="lpo-mb-th-num">{t.anomalyColSeats}</th>
                <th className="lpo-mb-th-num">{t.anomalyColBaseline}</th>
                <th className="lpo-mb-th-num">{t.anomalyColRawResid}</th>
                <th className="lpo-mb-th-num">{t.anomalyColZ}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => (
                <tr key={i} className={Math.abs(a.z) >= 3 ? 'lpo-mb-anomaly-row--high' : ''}>
                  <td>
                    <div className="lpo-mb-icon-cell">
                      <IconBadge src={MEDIA_ICON_MAP[a.outlet]} label={a.outlet} size={22} />
                      <span>{outletLabel(a.outlet)}</span>
                    </div>
                  </td>
                  <td>{a.date}</td>
                  <td>
                    <div className="lpo-mb-icon-cell">
                      <IconBadge src={PARTY_ICON_MAP[a.party]} label={a.party} size={22} />
                      <span>{partyLabel(a.party)}</span>
                    </div>
                  </td>
                  <td className="lpo-mb-td-num">{a.seats}</td>
                  <td className="lpo-mb-td-num">{a.baseline.toFixed(1)}</td>
                  <td className="lpo-mb-td-num lpo-mb-td-delta">
                    <span
                      className="lpo-mb-delta-dot"
                      style={{ background: residualColor(a.rawResidual) }}
                    />
                    {fmtSigned(a.rawResidual, 1)}
                  </td>
                  <td className="lpo-mb-td-num lpo-mb-td-z">{a.z.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Two-line control label text ──────────────────────────────────────────────

/** Renders a control label as two stacked lines, split on \n. */
function CtrlText({ text }: { text: string }) {
  const [line1, line2] = text.split('\n')
  return (
    <span className="lpo-mb-ctrl-text">
      <span>{line1}</span>
      {line2 !== undefined && <span>{line2}</span>}
    </span>
  )
}

// ─── Info tooltip ─────────────────────────────────────────────────────────────

function InfoTip({
  text,
  title,
  locale,
}: {
  text: string
  title?: string
  locale: string
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const dir = locale === 'he' ? 'rtl' : 'ltr'

  return (
    <div className="lpo-mb-infotip" ref={wrapRef}>
      <button
        className="lpo-mb-infotip-btn"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-label="Info"
      >
        ⓘ
      </button>
      {open && (
        <div className="lpo-mb-infotip-popup" dir={dir}>
          {title && <div className="lpo-mb-infotip-title">{title}</div>}
          {text.split('\n\n').map((para, i) => (
            <p key={i} className="lpo-mb-infotip-para">{para}</p>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

type Props = Omit<MediaBiasData, 'harmonized'> & {
  harmonized: UnpivotRow[]
  windowDays: number
  onWindowDaysChange: (days: number) => void
  combineArabs: boolean
  onCombineArabsChange: (v: boolean) => void
}

export function MediaBiasPanel({
  harmonized,
  partiesDim,
  mediaOutletsDim,
  accuracy,
  windowDays,
  onWindowDaysChange,
  combineArabs,
  onCombineArabsChange,
}: Props) {
  const { locale } = useLocale()
  const t = MB[locale]

  const [fdrMinN, setFdrMinN] = useState(10)
  const [totalPollsMin, setTotalPollsMin] = useState(5)
  const [activeTab, setActiveTab] = useState<'heatmap' | 'tilt' | 'anomaly'>('heatmap')
  const [excludedOutlets, setExcludedOutlets] = useState<Set<string>>(new Set())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsWrapRef = useRef<HTMLDivElement>(null)
  const settingsBaselineSelectId = useId()
  const settingsCombineArabsId = useId()
  const settingsMinPollsId = useId()
  const settingsFdrMinId = useId()

  useEffect(() => {
    if (!settingsOpen) return
    const onDown = (e: MouseEvent) => {
      if (settingsWrapRef.current && !settingsWrapRef.current.contains(e.target as Node)) {
        setSettingsOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSettingsOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [settingsOpen])

  const toggleOutlet = useCallback((outlet: string) => {
    setExcludedOutlets(prev => {
      const next = new Set(prev)
      if (next.has(outlet)) next.delete(outlet)
      else next.add(outlet)
      return next
    })
  }, [])

  const clearExcluded = useCallback(() => setExcludedOutlets(new Set()), [])

  // Step 1: count distinct polls per outlet; keep outlets meeting the threshold,
  // then additionally remove any outlets manually excluded by the user.
  // Filtering BEFORE baseline computation means excluded outlets don't
  // contaminate anyone's LOO baseline.
  const filteredHarmonized = useMemo(() => {
    const pollsPerOutlet = new Map<string, Set<number>>()
    for (const r of harmonized) {
      if (!pollsPerOutlet.has(r.mediaOutlet)) pollsPerOutlet.set(r.mediaOutlet, new Set())
      pollsPerOutlet.get(r.mediaOutlet)!.add(r.pollId)
    }
    return harmonized.filter(r => {
      if ((pollsPerOutlet.get(r.mediaOutlet)?.size ?? 0) < totalPollsMin) return false
      if (excludedOutlets.has(r.mediaOutlet)) return false
      return true
    })
  }, [harmonized, totalPollsMin, excludedOutlets])

  const onExportResidualDiagnostics = useCallback(() => {
    const rows = listResidualDiagnostics(filteredHarmonized, windowDays)
    downloadResidualDiagnosticsCsv(rows, 'residual-diagnostics')
  }, [filteredHarmonized, windowDays])

  const onExportHarmonizedCsv = useCallback(() => {
    if (!harmonized.length) return
    downloadHarmonizedCsv(harmonized, combineArabs ? 'harmonized' : 'harmonized-split-arabs')
  }, [harmonized, combineArabs])

  const harmonizedExportReady = harmonized.length > 0

  // Step 2: compute LOO residuals from the already-filtered rows.
  // windowDays changes re-run this memo cheaply (pure JS, no network).
  const residuals = useMemo(
    () => computeResiduals(filteredHarmonized, windowDays),
    [filteredHarmonized, windowDays],
  )

  const houseEffects = useMemo(
    () => computeHouseEffects(residuals, partiesDim, { minN: fdrMinN }),
    [residuals, partiesDim, fdrMinN],
  )

  // All outlets meeting min poll count — always listed in the filter; unchecked = excluded from analysis.
  const eligibleOutlets = useMemo(() => {
    const pollsPerOutlet = new Map<string, Set<number>>()
    for (const r of harmonized) {
      if (!pollsPerOutlet.has(r.mediaOutlet)) pollsPerOutlet.set(r.mediaOutlet, new Set())
      pollsPerOutlet.get(r.mediaOutlet)!.add(r.pollId)
    }
    return [...pollsPerOutlet.entries()]
      .filter(([, s]) => s.size >= totalPollsMin)
      .map(([o]) => o)
      .sort()
  }, [harmonized, totalPollsMin])

  const blocTilt = useMemo(() => computeBlocTilt(houseEffects), [houseEffects])

  /** Columns for heatmap / tilt: eligible outlets not manually excluded, |bloc tilt| desc (tilt 0 if no coal/opp cells). */
  const outletOrder = useMemo(() => {
    const tiltBy = new Map(blocTilt.map(b => [b.outlet, b.tilt]))
    return eligibleOutlets
      .filter(o => !excludedOutlets.has(o))
      .sort((a, b) => {
        const d = Math.abs(tiltBy.get(b) ?? 0) - Math.abs(tiltBy.get(a) ?? 0)
        if (d !== 0) return d
        return a.localeCompare(b, 'he')
      })
  }, [eligibleOutlets, excludedOutlets, blocTilt])

  return (
    <div className="lpo-mb-panel">
      {/* ── Global controls ── */}
      <div className="lpo-mb-global-controls">
        <div className="lpo-mb-gear-export-cluster">
          <div className="lpo-mb-settings-wrap" ref={settingsWrapRef}>
            <button
              type="button"
              className={`lpo-mb-settings-btn${settingsOpen ? ' lpo-mb-settings-btn--open' : ''}`}
              aria-expanded={settingsOpen}
              aria-haspopup="true"
              aria-controls="lpo-mb-settings-panel"
              id="lpo-mb-settings-trigger"
              title={t.settingsAria}
              onClick={() => setSettingsOpen(v => !v)}
            >
              <SettingsGearIcon />
              <span className="lpo-mb-sr-only">{t.settingsAria}</span>
            </button>
            {settingsOpen && (
              <div
                id="lpo-mb-settings-panel"
                className="lpo-mb-settings-dropdown"
                role="region"
                aria-labelledby="lpo-mb-settings-trigger"
                dir={locale === 'he' ? 'rtl' : 'ltr'}
              >
                <div className="lpo-mb-settings-form">
                  <label className="lpo-mb-settings-form__label" htmlFor={settingsBaselineSelectId}>
                    <CtrlText text={t.windowDaysLabel} />
                  </label>
                  <div className="lpo-mb-settings-form__control">
                    <select
                      id={settingsBaselineSelectId}
                      className="lpo-mb-select lpo-mb-select--settings-field"
                      value={windowDays}
                      onChange={e => onWindowDaysChange(Number(e.target.value))}
                    >
                      <option value={14}>{t.day14}</option>
                      <option value={30}>{t.day30}</option>
                      <option value={60}>{t.day60}</option>
                    </select>
                  </div>
                  <div className="lpo-mb-settings-form__icon-slot">
                    <InfoTip text={t.infoBaselineWindow} locale={locale} />
                  </div>

                  <label className="lpo-mb-settings-form__label" htmlFor={settingsMinPollsId}>
                    <CtrlText text={t.totalPollsLabel} />
                  </label>
                  <div className="lpo-mb-settings-form__control">
                    <input
                      id={settingsMinPollsId}
                      type="number"
                      className="lpo-mb-number lpo-mb-number--settings-field"
                      min={1}
                      max={300}
                      value={totalPollsMin}
                      onChange={e => setTotalPollsMin(Math.max(1, Number(e.target.value)))}
                    />
                  </div>
                  <div className="lpo-mb-settings-form__icon-slot">
                    <InfoTip text={t.infoMinPolls} locale={locale} />
                  </div>

                  <label className="lpo-mb-settings-form__label" htmlFor={settingsFdrMinId}>
                    <CtrlText text={t.fdrMinNLabel} />
                  </label>
                  <div className="lpo-mb-settings-form__control">
                    <input
                      id={settingsFdrMinId}
                      type="number"
                      className="lpo-mb-number lpo-mb-number--settings-field"
                      min={5}
                      max={30}
                      value={fdrMinN}
                      onChange={e => setFdrMinN(Math.min(30, Math.max(5, Number(e.target.value))))}
                    />
                  </div>
                  <div className="lpo-mb-settings-form__icon-slot">
                    <InfoTip text={t.infoFdrMin} locale={locale} />
                  </div>

                  <div className="lpo-mb-settings-form__label">
                    <label htmlFor={settingsCombineArabsId} className="lpo-mb-settings-form__combine-label">
                      <CtrlText text={t.combineArabsLabel} />
                    </label>
                  </div>
                  <div className="lpo-mb-settings-form__control lpo-mb-settings-form__control--checkbox">
                    <input
                      id={settingsCombineArabsId}
                      type="checkbox"
                      checked={combineArabs}
                      onChange={e => onCombineArabsChange(e.target.checked)}
                    />
                  </div>
                  <div className="lpo-mb-settings-form__icon-slot lpo-mb-settings-form__icon-slot--empty" aria-hidden />
                </div>
              </div>
            )}
          </div>
          <MbCsvExportMenu
            t={t}
            locale={locale}
            harmonizedReady={harmonizedExportReady}
            onExportHarmonized={onExportHarmonizedCsv}
            residualDiagExport={onExportResidualDiagnostics}
          />
        </div>

        <span className="lpo-mb-stats-summary" dir={locale === 'he' ? 'rtl' : 'ltr'}>
          <span className="lpo-mb-stats-summary-inner">
            <span className="lpo-mb-stats-summary--sig">
              {houseEffects.filter(c => isHouseEffectFdrSignificant(c)).length} {t.significantCells}
            </span>
            <span className="lpo-mb-stats-summary--sep" aria-hidden>
              &ensp;|&ensp;
            </span>
            <span className="lpo-mb-stats-summary--excl">
              {houseEffects.filter(c => c.pAdj === null).length} {t.excludedLowN}
            </span>
          </span>
        </span>

        {/* Methodology info — pushed to the far right */}
        <span className="lpo-mb-methodology-info">
          <InfoTip text={t.infoMethodology} title={t.infoMethodologyTitle} locale={locale} />
        </span>
      </div>

      {/* ── Section tabs ── */}
      <div className="lpo-mb-tabs" role="tablist">
        {(
          [
            { id: 'heatmap', label: t.tabHeatmap },
            { id: 'tilt', label: t.tabBlocTilt },
            { id: 'anomaly', label: t.tabAnomalies },
          ] as const
        ).map(tab => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`lpo-mb-tab ${activeTab === tab.id ? 'lpo-mb-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Section content ── */}
      <div className="lpo-mb-section-content">
        {activeTab === 'heatmap' && (
          <section className="lpo-mb-section">
            <HeatmapSection
              houseEffects={houseEffects}
              harmonized={harmonized}
              partiesDim={partiesDim}
              mediaOutletsDim={mediaOutletsDim}
              outletOrder={outletOrder}
              eligibleOutlets={eligibleOutlets}
              excludedOutlets={excludedOutlets}
              onToggleOutlet={toggleOutlet}
              onClearOutlets={clearExcluded}
              t={t}
            />
          </section>
        )}

        {activeTab === 'tilt' && (
          <section className="lpo-mb-section">
            <p className="lpo-mb-section-subtitle" dir={locale === 'he' ? 'rtl' : 'ltr'}>{t.blocTiltSubtitle}</p>
            <BlocTiltSection
              houseEffects={houseEffects}
              outletOrder={outletOrder}
              accuracy={accuracy}
              mediaOutletsDim={mediaOutletsDim}
              t={t}
            />
          </section>
        )}

        {activeTab === 'anomaly' && (
          <section className="lpo-mb-section">
            <p className="lpo-mb-section-subtitle" dir={locale === 'he' ? 'rtl' : 'ltr'}>{t.anomalySubtitle}</p>
            <AnomalySection
              residuals={residuals}
              partiesDim={partiesDim}
              mediaOutletsDim={mediaOutletsDim}
              t={t}
            />
          </section>
        )}
      </div>
    </div>
  )
}
