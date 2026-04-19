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
  summaryFromRollingRows,
} from '../lib/pollRollingWindow'
import { generatePollSummaryTrendBullets } from '../lib/generatePollSummaryTrendBullets'
import { resolvePollSummaryNarrativeAsOfDisplay } from '../content/pickPollSummaryNarrative'
import { IconWithFallback } from './IconWithFallback'
import { narrativeHtmlWithBlocHighlights } from './pollNarrativeHtml'
import { PollSummaryNarrativeBulletLi } from './PollSummaryNarrativeBullet'

const KNESSET = 120
const MAJ_SEATS = 60

/** Party column = max label width + pad so short names don’t leave a huge gutter before deltas. */
const NARRATIVE_PARTY_LABEL_PAD_PX = 10

function syncNarrativePartyLabelColumnWidth(ul: HTMLUListElement) {
  const labels = ul.querySelectorAll<HTMLElement>('.lpo-ps-narrative-party-label')
  if (labels.length === 0) {
    ul.style.removeProperty('--lpo-ps-narrative-party-label-w')
    return
  }
  const probe = document.createElement('span')
  probe.className = 'lpo-ps-narrative-party-label'
  probe.setAttribute('aria-hidden', 'true')
  probe.style.cssText =
    'position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;white-space:nowrap;width:max-content;max-width:none;box-sizing:border-box'
  ul.appendChild(probe)
  let maxW = 0
  labels.forEach((label) => {
    probe.innerHTML = label.innerHTML
    maxW = Math.max(maxW, probe.scrollWidth)
  })
  ul.removeChild(probe)
  ul.style.setProperty(
    '--lpo-ps-narrative-party-label-w',
    `${Math.ceil(maxW + NARRATIVE_PARTY_LABEL_PAD_PX)}px`,
  )
}

function PsSegmentBar({
  coalition,
  opposition,
  arabs,
  mergeArabsWithOpposition,
  showMajLine,
  mini,
  className = '',
}: {
  coalition: number
  opposition: number
  arabs: number
  mergeArabsWithOpposition: boolean
  showMajLine: boolean
  mini: boolean
  className?: string
}) {
  const c = Math.max(0, coalition)
  const aRaw = Math.max(0, arabs)
  const oRaw = Math.max(0, opposition)
  const o = mergeArabsWithOpposition ? oRaw + aRaw : oRaw
  const a = mergeArabsWithOpposition ? 0 : aRaw
  const sum = c + o + a
  const denom = sum > 0 ? sum : 1
  const wa = (a / denom) * 100
  const wo = (o / denom) * 100

  const majLeftPct = (MAJ_SEATS / KNESSET) * 100

  return (
    <div
      className={`lpo-ps-segbar${mini ? ' lpo-ps-segbar--mini' : ''} ${className}`.trim()}
      role="img"
      aria-label={`Coalition ${c}, opposition ${mergeArabsWithOpposition ? o : oRaw}, ${mergeArabsWithOpposition ? '' : `Arabs ${aRaw}, `}total ${sum}`}
    >
      <div className="lpo-ps-bar-slot">
        <div className="lpo-ps-bar-track">
          {/* Same order as party breakdown multi-poll threshold: Opposition → Arabs → Coalition */}
          <div className="lpo-ps-seg lpo-ps-seg--opp" style={{ flex: `0 0 ${wo}%` }} />
          {!mergeArabsWithOpposition && a > 0 ? (
            <div className="lpo-ps-seg lpo-ps-seg--arabs" style={{ flex: `0 0 ${wa}%` }} />
          ) : null}
          {/* flex-grow absorbs subpixel remainder so the track stays full and the rounded cap is not clipped */}
          <div className="lpo-ps-seg lpo-ps-seg--coal" style={{ flex: '1 1 0' }} />
        </div>
        {showMajLine ? (
          <div
            className="lpo-ps-maj-line"
            style={{ left: `${majLeftPct}%` }}
            aria-hidden
            title="60"
          />
        ) : null}
      </div>
    </div>
  )
}

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) return null
  const up = delta > 0
  return (
    <span className={`lpo-ps-delta ${up ? 'up' : 'down'}`}>
      {up ? '+' : '-'}
      {Math.abs(delta)}
    </span>
  )
}

type PollSummaryPanelProps = {
  rows: RollingWindowRow[]
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

function OutletFilterDropdown({
  allOutlets,
  excludedOutlets,
  onToggle,
  onClear,
  locale,
  displayMediaOutlet,
}: {
  allOutlets: string[]
  excludedOutlets: Set<string>
  onToggle: (outlet: string) => void
  onClear: () => void
  locale: AppLocale
  displayMediaOutlet: (outlet: string) => string
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

function PollSummaryChipsStrip({
  changedParties,
  t,
  combineArabsWithOpposition,
  displayParty,
}: {
  changedParties: ChangedParty[]
  t: UiStrings
  combineArabsWithOpposition: boolean
  displayParty: (partyKey: string) => string
}) {
  if (changedParties.length === 0) {
    return <div className="lpo-ps-combo-chips-placeholder" aria-hidden />
  }
  return (
    <ul className="lpo-ps-chips">
      {changedParties.map((cp) => {
        const tip = `${displayParty(cp.party)} · ${cp.currentVotes} ${t.seats}`
        return (
          <li key={cp.party} className="lpo-ps-chip" title={tip}>
            <div
              className="lpo-ps-chip-ring"
              style={{
                boxShadow: `inset 0 0 0 2px ${segmentRingColorForSummary(cp.segment, combineArabsWithOpposition)}`,
              }}
            >
              <IconWithFallback
                src={PARTY_ICON_MAP[cp.party]}
                label={displayParty(cp.party)}
              />
            </div>
            <span className={`lpo-ps-chip-delta ${cp.delta > 0 ? 'up' : 'down'}`}>
              {cp.delta > 0 ? '+' : '-'}
              {Math.abs(cp.delta)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

export function PollSummaryPanel({
  rows,
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

  const [excludedOutlets, setExcludedOutlets] = useState<Set<string>>(() => new Set())
  const allOutletKeys = useMemo(() => rows.map((r) => r.current.mediaOutlet), [rows])
  const visibleRows = useMemo(
    () =>
      excludedOutlets.size === 0
        ? rows
        : rows.filter((r) => !excludedOutlets.has(r.current.mediaOutlet)),
    [rows, excludedOutlets],
  )
  const toggleOutlet = useCallback((outlet: string) => {
    setExcludedOutlets((prev) => {
      const next = new Set(prev)
      if (next.has(outlet)) next.delete(outlet)
      else next.add(outlet)
      return next
    })
  }, [])
  const clearExcluded = useCallback(() => setExcludedOutlets(new Set()), [])

  const summary = useMemo(() => summaryFromRollingRows(visibleRows), [visibleRows])
  const trendBullets = useMemo(
    () =>
      generatePollSummaryTrendBullets(visibleRows, summary, {
        locale,
        windowDays: maxStaleDays,
        displayMediaOutlet,
        displayParty,
      }),
    [visibleRows, summary, locale, maxStaleDays, displayMediaOutlet, displayParty],
  )
  const narrativeAsOfDisplay = useMemo(() => {
    if (visibleRows.length === 0) return undefined
    return resolvePollSummaryNarrativeAsOfDisplay(visibleRows, locale)
  }, [visibleRows, locale])

  const hasPrior = summary.nWithPrior > 0
  const hasNarrativeTop = Boolean(narrativeAsOfDisplay) || Boolean(bgText)
  const hasNarrativeTrends = trendBullets.length > 0
  const trendBulletsKey = trendBullets.join('\n')

  const hasAnyChips = visibleRows.some((r) => r.changedParties.length > 0)
  const chipRowIdsKey = visibleRows.map((r) => r.current.pollId).join(',')
  const unifiedSplitRef = useRef<HTMLDivElement | null>(null)
  const narrativeTrendsListRef = useRef<HTMLUListElement | null>(null)
  const leftRowByPollId = useRef<Map<number, HTMLDivElement | null>>(new Map())
  const partyLineByPollId = useRef<Map<number, HTMLDivElement | null>>(new Map())

  useLayoutEffect(() => {
    if (!hasAnyChips) return

    const split = unifiedSplitRef.current
    if (!split) return

    const syncRowHeightsAndZebra = () => {
      for (const r of visibleRows) {
        const id = r.current.pollId
        const left = leftRowByPollId.current.get(id)
        const line = partyLineByPollId.current.get(id)
        if (left && line) {
          left.style.minHeight = ''
          line.style.minHeight = ''
        }
      }

      const heightPxByPollId = new Map<number, number>()
      for (const r of visibleRows) {
        const id = r.current.pollId
        const left = leftRowByPollId.current.get(id)
        const line = partyLineByPollId.current.get(id)
        if (left && line) {
          const h = Math.max(
            Math.ceil(left.getBoundingClientRect().height),
            Math.ceil(line.getBoundingClientRect().height),
          )
          heightPxByPollId.set(id, h)
          const px = `${h}px`
          left.style.minHeight = px
          line.style.minHeight = px
        }
      }

      let acc = 0
      const parts: string[] = []
      for (let i = 0; i < visibleRows.length; i++) {
        const id = visibleRows[i].current.pollId
        const h = heightPxByPollId.get(id) ?? 0
        if (h <= 0) continue
        const color = i % 2 === 1 ? '#1a222e' : 'transparent'
        parts.push(`${color} ${acc}px`, `${color} ${acc + h}px`)
        acc += h
      }
      split.style.backgroundImage =
        parts.length > 0 ? `linear-gradient(to bottom, ${parts.join(', ')})` : ''
    }

    syncRowHeightsAndZebra()
    const ro = new ResizeObserver(() => {
      syncRowHeightsAndZebra()
    })
    ro.observe(split)
    for (const r of visibleRows) {
      const left = leftRowByPollId.current.get(r.current.pollId)
      const line = partyLineByPollId.current.get(r.current.pollId)
      if (left) ro.observe(left)
      if (line) ro.observe(line)
    }
    return () => {
      ro.disconnect()
      split.style.backgroundImage = ''
      for (const r of visibleRows) {
        const id = r.current.pollId
        const left = leftRowByPollId.current.get(id)
        const line = partyLineByPollId.current.get(id)
        if (left) left.style.minHeight = ''
        if (line) line.style.minHeight = ''
      }
    }
  }, [hasAnyChips, chipRowIdsKey])

  useLayoutEffect(() => {
    if (!hasNarrativeTrends) return
    const list = narrativeTrendsListRef.current
    if (!list) return

    const run = () => {
      syncNarrativePartyLabelColumnWidth(list)
    }
    run()
    const ro = new ResizeObserver(() => {
      run()
    })
    ro.observe(list)
    return () => {
      ro.disconnect()
      list.style.removeProperty('--lpo-ps-narrative-party-label-w')
    }
  }, [hasNarrativeTrends, trendBulletsKey, locale])

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

  return (
    <div className="lpo-ps-wrap">
      <section className="lpo-ps-hero" aria-label={t.pollSummaryHeroAria}>
        <div className="lpo-ps-hero-bar-stack lpo-ps-bar-ltr">
          <div className="lpo-ps-blocs-nums-band">
            <div className="lpo-ps-hero-nums-between" dir="ltr">
              <div className="lpo-ps-hero-side lpo-ps-hero-side--opp">
                <span className="lpo-ps-hero-lbl lpo-ps-hero-lbl--opp">{t.opposition}</span>
                <span className="lpo-ps-hero-num lpo-ps-hero-num--opp">
                  {combineArabsWithOpposition ? summary.avgOppositionPlusArabs : summary.avgOpposition}
                </span>
                {hasPrior ? (
                  <DeltaBadge
                    delta={
                      combineArabsWithOpposition
                        ? summary.deltaOppositionPlusArabs
                        : summary.deltaOpposition
                    }
                  />
                ) : null}
              </div>
              <div className="lpo-ps-hero-side lpo-ps-hero-side--coal">
                <span className="lpo-ps-hero-lbl lpo-ps-hero-lbl--coal">{t.coalition}</span>
                <span className="lpo-ps-hero-num lpo-ps-hero-num--coal">{summary.avgCoalition}</span>
                {hasPrior ? <DeltaBadge delta={summary.deltaCoalition} /> : null}
              </div>
            </div>
            <span className="lpo-ps-maj-label-fly lpo-ps-maj-label-fly--12" aria-hidden>
              60
            </span>
          </div>
          <PsSegmentBar
            coalition={summary.avgCoalition}
            opposition={summary.avgOpposition}
            arabs={summary.avgArabs}
            mergeArabsWithOpposition={combineArabsWithOpposition}
            showMajLine
            mini={false}
            className="lpo-ps-hero-bar"
          />
        </div>
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
      </section>

      <div className="lpo-ps-subtitle-bar" dir="ltr">
        <OutletFilterDropdown
          allOutlets={allOutletKeys}
          excludedOutlets={excludedOutlets}
          onToggle={toggleOutlet}
          onClear={clearExcluded}
          locale={locale}
          displayMediaOutlet={displayMediaOutlet}
        />
        <p
          className="lpo-ps-subtitle lpo-ps-subtitle--under-page-title lpo-ps-subtitle--outlets-breakdown"
          dir={locale === 'he' ? 'rtl' : 'ltr'}
        >
          <strong>{t.pollSummaryOutletsBreakdownLead}</strong>
          {t.pollSummaryOutletsBreakdownTail}
        </p>
      </div>

      <div className="lpo-ps-rows-unified">
        {showEmptyFilterMsg ? (
          <p className="lpo-ps-empty" style={{ textAlign: 'center', margin: '1.5rem 0' }}>
            {locale === 'he' ? 'לא נבחרו ערוצים' : 'No outlets selected'}
          </p>
        ) : hasAnyChips ? (
          <div
            ref={unifiedSplitRef}
            className="lpo-ps-unified-split"
            dir="ltr"
            aria-label={t.pollSummaryRowsAria}
          >
            <div className="lpo-ps-unified-fixed" role="presentation">
              {visibleRows.map(({ current, previous }, rowIdx) => (
                <div
                  key={current.pollId}
                  ref={(el) => {
                    const id = current.pollId
                    if (el) leftRowByPollId.current.set(id, el)
                    else leftRowByPollId.current.delete(id)
                  }}
                  className={`lpo-ps-unified-fixed-row${rowIdx % 2 === 1 ? ' lpo-ps-unified-fixed-row--alt' : ''}`}
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
              ))}
            </div>
            <div
              className="lpo-ps-unified-parties-wrap"
              role="region"
              tabIndex={0}
              aria-label={t.pollSummaryChangedPartiesAria}
            >
              <div className="lpo-ps-unified-parties-scroll">
                <div className="lpo-ps-unified-parties-track">
                  {visibleRows.map(({ current, changedParties }, rowIdx) => (
                    <div
                      key={current.pollId}
                      ref={(el) => {
                        const id = current.pollId
                        if (el) partyLineByPollId.current.set(id, el)
                        else partyLineByPollId.current.delete(id)
                      }}
                      className={`lpo-ps-unified-parties-line${rowIdx % 2 === 1 ? ' lpo-ps-unified-parties-line--alt' : ''}`}
                    >
                      <PollSummaryChipsStrip
                        changedParties={changedParties}
                        t={t}
                        combineArabsWithOpposition={combineArabsWithOpposition}
                        displayParty={displayParty}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
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

      {hasNarrativeTrends ? (
        <section
          className="lpo-ps-narrative-trends"
          dir={locale === 'he' ? 'rtl' : 'ltr'}
          aria-label={t.pollSummaryNarrativeTrendsAria}
        >
          <ul ref={narrativeTrendsListRef} className="lpo-ps-narrative-trends-list">
            {trendBullets.map((html, i) => (
              <PollSummaryNarrativeBulletLi
                key={i}
                html={html}
                displayParty={displayParty}
                index={i}
                mergeArabsWithOpposition={combineArabsWithOpposition}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
