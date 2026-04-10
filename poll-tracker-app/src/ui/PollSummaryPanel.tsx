import dayjs from 'dayjs'
import { useLayoutEffect, useRef } from 'react'
import type { AppLocale } from '../i18n/localeContext'
import type { UiStrings } from '../i18n/strings'
import { MEDIA_ICON_MAP, PARTY_ICON_MAP, SEGMENT_COLORS } from '../config/mappings'
import type { Segment } from '../types/data'
import type {
  ChangedParty,
  RollingPoll,
  RollingWindowRow,
  RollingWindowSummary,
} from '../lib/pollRollingWindow'
import { IconWithFallback } from './IconWithFallback'

const KNESSET = 120
const MAJ_SEATS = 61

function partySummaryRingColor(segment: Segment, mergeArabsWithOpposition: boolean): string {
  if (segment === 'Arabs')
    return mergeArabsWithOpposition ? SEGMENT_COLORS.Opposition : SEGMENT_COLORS.Arabs
  if (segment === 'Coalition') return SEGMENT_COLORS.Coalition
  return SEGMENT_COLORS.Opposition
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
  const wc = (c / denom) * 100
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
          <div className="lpo-ps-seg lpo-ps-seg--opp" style={{ width: `${wo}%` }} />
          {!mergeArabsWithOpposition && a > 0 ? (
            <div className="lpo-ps-seg lpo-ps-seg--arabs" style={{ width: `${wa}%` }} />
          ) : null}
          <div className="lpo-ps-seg lpo-ps-seg--coal" style={{ width: `${wc}%` }} />
        </div>
        {showMajLine ? (
          <div
            className="lpo-ps-maj-line"
            style={{ left: `${majLeftPct}%` }}
            aria-hidden
            title="61"
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
      {up ? '↗' : '↘'}
      {Math.abs(delta)}
    </span>
  )
}

type PollSummaryPanelProps = {
  rows: RollingWindowRow[]
  summary: RollingWindowSummary
  locale: AppLocale
  t: UiStrings
  maxStaleDays: number
  combineArabsWithOpposition: boolean
  displayMediaOutlet: (outlet: string) => string
  displayParty: (partyKey: string) => string
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
                borderColor: partySummaryRingColor(cp.segment, combineArabsWithOpposition),
              }}
            >
              <IconWithFallback
                src={PARTY_ICON_MAP[cp.party]}
                label={displayParty(cp.party)}
              />
            </div>
            <span className={`lpo-ps-chip-delta ${cp.delta > 0 ? 'up' : 'down'}`}>
              {cp.delta > 0 ? '↗' : '↘'}
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
  summary,
  locale,
  t,
  maxStaleDays,
  combineArabsWithOpposition,
  displayMediaOutlet,
  displayParty,
}: PollSummaryPanelProps) {
  const dateFmt = locale === 'he' ? 'DD/MM/YYYY' : 'M/D/YYYY'
  const hasPrior = summary.nWithPrior > 0
  const hasAnyChips = rows.some((r) => r.changedParties.length > 0)
  const chipRowIdsKey = rows.map((r) => r.current.pollId).join(',')
  const leftRowByPollId = useRef<Map<number, HTMLDivElement | null>>(new Map())
  const partyLineByPollId = useRef<Map<number, HTMLDivElement | null>>(new Map())

  useLayoutEffect(() => {
    if (!hasAnyChips) return

    const matchRowHeights = () => {
      for (const r of rows) {
        const id = r.current.pollId
        const left = leftRowByPollId.current.get(id)
        const line = partyLineByPollId.current.get(id)
        if (left && line) {
          left.style.minHeight = ''
          line.style.minHeight = ''
        }
      }
      for (const r of rows) {
        const id = r.current.pollId
        const left = leftRowByPollId.current.get(id)
        const line = partyLineByPollId.current.get(id)
        if (left && line) {
          const h = Math.max(left.offsetHeight, line.offsetHeight)
          const px = `${h}px`
          left.style.minHeight = px
          line.style.minHeight = px
        }
      }
    }

    matchRowHeights()
    const ro = new ResizeObserver(() => {
      matchRowHeights()
    })
    for (const r of rows) {
      const left = leftRowByPollId.current.get(r.current.pollId)
      const line = partyLineByPollId.current.get(r.current.pollId)
      if (left) ro.observe(left)
      if (line) ro.observe(line)
    }
    return () => {
      ro.disconnect()
      for (const r of rows) {
        const id = r.current.pollId
        const left = leftRowByPollId.current.get(id)
        const line = partyLineByPollId.current.get(id)
        if (left) left.style.minHeight = ''
        if (line) line.style.minHeight = ''
      }
    }
  }, [hasAnyChips, chipRowIdsKey])

  if (rows.length === 0) {
    return (
      <div className="lpo-ps-wrap">
        <p className="lpo-ps-empty">
          {t.pollSummaryNoOutlets.replace(/\{n\}/g, String(maxStaleDays))}
        </p>
      </div>
    )
  }

  return (
    <div className="lpo-ps-wrap">
      <section className="lpo-ps-hero" aria-label={t.pollSummaryHeroAria}>
        <div className="lpo-ps-hero-bar-stack lpo-ps-bar-ltr">
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
        <p className="lpo-ps-hero-foot">
          {t.pollSummaryOutletsCount.replace(/\{n\}/g, String(summary.n))}
          {hasPrior ? ` · ${t.pollSummaryVsPriorNote.replace(/\{n\}/g, String(summary.nWithPrior))}` : null}
        </p>
      </section>

      <div className="lpo-ps-rows-unified">
        {hasAnyChips ? (
          <div
            className="lpo-ps-unified-split"
            dir="ltr"
            aria-label={t.pollSummaryRowsAria}
          >
            <div className="lpo-ps-unified-fixed" role="presentation">
              {rows.map(({ current, previous }, rowIdx) => (
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
                  {rows.map(({ current, changedParties }, rowIdx) => (
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
            {rows.map(({ current, previous }, rowIdx) => (
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
    </div>
  )
}
