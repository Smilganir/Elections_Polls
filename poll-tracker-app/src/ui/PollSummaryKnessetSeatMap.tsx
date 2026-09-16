import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import type { AppLocale } from '../i18n/localeContext'
import type { UiStrings } from '../i18n/strings'
import { buildKnessetFilledSeats, type KnessetFilledSeat } from '../lib/knessetSeatAllocation'
import { PARTY_COLOR_MAP, SEGMENT_COLORS } from '../config/mappings'
import {
  fetchKnessetMembers,
  consolidateMemberSources,
  memberSourceCategoryLabel,
  memberSourceDisplayName,
  memberSeatImageUrl,
  membersByPartyKey,
  segmentLabel,
  type KnessetMemberRow,
} from '../lib/knessetMembersSheet'
import {
  buildPhotoCreditIndex,
  fetchPhotoCredits,
  photoCreditForMember,
  type PhotoCreditRecord,
} from '../lib/photoCreditsSheet'
import type { RollingPoll } from '../lib/pollRollingWindow'
import { knessetHollowInsetStyle } from '../lib/knessetHollowInsets'
import {
  memberHebrewName,
  memberTooltipFieldValue,
  memberTooltipName,
  resolveMemberEnTooltip,
  type MemberEnTooltipProfile,
} from '../lib/knessetMemberTooltipLocale'
import {
  partyKeysMatchingFilters,
  seatFilterVisualState,
  toggleMapFilter,
  type KnessetMapFilters,
  type KnessetMapFocusItem,
  type KnessetSeatFilterVisualState,
} from '../lib/knessetSeatDemographics'
import { computePartySwingSeats } from '../lib/knessetPartySwingSeats'
import type { Segment } from '../types/data'
import { KnessetStatsLeftStack, KnessetStatsRightStack } from './PollSummaryKnessetDemographics'
import { KnessetSeatEmptyPortraitIcon } from './KnessetSeatEmptyPortraitIcon'
import { PhotoCreditLine } from './PhotoCreditLine'
/**
 * Keep in sync with HERO_CHART_COMPACT_MQ in PollSummaryHeroPartiesChartPopup.tsx and the
 * `@media (max-width: 768px), (max-height: 500px)` blocks in index.css that style
 * `.lpo-ps-hero-chart-*`. Landscape phones (short viewport height, wide width) need the same
 * in-flow mobile treatment as portrait phones — not a duplicate literal import to avoid a
 * circular module dependency between these two files.
 */
const HERO_CHART_COMPACT_MQ = '(max-width: 768px), (max-height: 500px)'

type TooltipPlacement = 'above' | 'below'

type TooltipState = {
  seat: KnessetFilledSeat
  x: number
  y: number
  placement: TooltipPlacement
}

const TOOLTIP_VIEWPORT_MARGIN = 12
const TOOLTIP_TOP_MARGIN = 8
const TOOLTIP_ANCHOR_GAP = 10
const TOOLTIP_MAX_HEIGHT_CAP = 820
/** Matches CSS max-width: min(20rem, 92vw) — used before layout measure. */
const TOOLTIP_LAYOUT_WIDTH_PX = 320
const TOOLTIP_CLOSE_DELAY_MS = 350
const TOOLTIP_SUPPRESS_SEAT_OPEN_MS = 400

type TooltipDetailRow = { label: string; value: string; clamp?: boolean }

type TooltipVerticalLayout = {
  placement: TooltipPlacement
  top: number
  maxHeight?: number
  pinTop?: boolean
}

function viewportWidth(): { left: number; width: number } {
  const vv = window.visualViewport
  return {
    left: vv?.offsetLeft ?? 0,
    width: vv?.width ?? window.innerWidth,
  }
}

function viewportVerticalBounds(): { minTop: number; maxBottom: number } {
  const vv = window.visualViewport
  const offsetTop = vv?.offsetTop ?? 0
  const height = vv?.height ?? window.innerHeight
  return {
    minTop: offsetTop + TOOLTIP_TOP_MARGIN,
    maxBottom: offsetTop + height - TOOLTIP_VIEWPORT_MARGIN,
  }
}

/** Keep the card fully inside the viewport; anchor stays on the seat (translate -50%). */
function clampTooltipX(anchorX: number, tooltipWidth: number): number {
  const vp = viewportWidth()
  const margin = TOOLTIP_VIEWPORT_MARGIN
  const width = Math.max(tooltipWidth, TOOLTIP_LAYOUT_WIDTH_PX)
  const halfW = width / 2
  const minX = vp.left + margin + halfW
  const maxX = vp.left + vp.width - margin - halfW
  if (minX > maxX) return vp.left + vp.width / 2
  return Math.max(minX, Math.min(anchorX, maxX))
}

function tooltipPlacement(clientY: number): TooltipPlacement {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(
    '--lpo-ps-hero-chart-overlay-top',
  )
  const overlayTop = Number.parseFloat(raw) || 88
  if (clientY < overlayTop + 100) return 'below'

  const { minTop, maxBottom } = viewportVerticalBounds()
  const spaceAbove = clientY - minTop - TOOLTIP_ANCHOR_GAP
  const spaceBelow = maxBottom - clientY - TOOLTIP_ANCHOR_GAP
  return spaceAbove >= spaceBelow ? 'above' : 'below'
}

/** After measure: flip below, pin top, or cap height so name/photo never clip. */
function resolveTooltipVerticalLayout(
  anchorY: number,
  preferred: TooltipPlacement,
  cardHeight: number,
): TooltipVerticalLayout {
  const { minTop, maxBottom } = viewportVerticalBounds()
  const gap = TOOLTIP_ANCHOR_GAP
  const spaceAbove = Math.max(0, anchorY - minTop - gap)
  const spaceBelow = Math.max(0, maxBottom - anchorY - gap)

  let placement = preferred
  const fitsAbove = cardHeight <= spaceAbove
  const fitsBelow = cardHeight <= spaceBelow

  if (placement === 'above' && !fitsAbove) {
    placement = fitsBelow || spaceBelow >= spaceAbove ? 'below' : 'above'
  } else if (placement === 'below' && !fitsBelow) {
    placement = fitsAbove || spaceAbove >= spaceBelow ? 'above' : 'below'
  }

  const available = placement === 'above' ? spaceAbove : spaceBelow
  const maxHeight = Math.min(TOOLTIP_MAX_HEIGHT_CAP, available)
  const effectiveHeight = Math.min(cardHeight, maxHeight)

  if (placement === 'above') {
    const cardTop = anchorY - effectiveHeight - gap
    if (cardTop < minTop) {
      const pinnedMaxHeight = Math.min(
        TOOLTIP_MAX_HEIGHT_CAP,
        Math.max(0, anchorY - minTop - gap),
      )
      return {
        placement: 'above',
        top: minTop,
        maxHeight: pinnedMaxHeight > 0 ? pinnedMaxHeight : maxHeight,
        pinTop: true,
      }
    }
  }

  return {
    placement,
    top: anchorY,
    maxHeight: cardHeight > available ? maxHeight : undefined,
  }
}

function genderLabel(
  gender: string,
  locale: AppLocale,
  t: UiStrings,
): string {
  const raw = gender.trim()
  if (!raw) return ''
  if (locale === 'he') return raw
  if (raw === 'זכר') return t.knessetMapGenderMale
  if (raw === 'נקבה') return t.knessetMapGenderFemale
  return raw
}

function knessetYearsLabel(years: string, t: UiStrings): string {
  const n = years.trim()
  if (!n) return ''
  return t.knessetMapKnessetYearsValue.replace(/\{n\}/g, n)
}

function memberTooltipDetailRows(
  member: KnessetMemberRow,
  locale: AppLocale,
  t: UiStrings,
  enProfile: MemberEnTooltipProfile | null,
): TooltipDetailRow[] {
  const rows: TooltipDetailRow[] = []
  if (member.age.trim()) rows.push({ label: t.knessetMapTooltipAge, value: member.age.trim() })
  const gender = genderLabel(member.gender, locale, t)
  if (gender) rows.push({ label: t.knessetMapTooltipGender, value: gender })
  const knessetYears = knessetYearsLabel(member.knessetYears, t)
  if (knessetYears) {
    rows.push({ label: t.knessetMapTooltipKnessetYears, value: knessetYears })
  }
  if (member.sector.trim()) {
    rows.push({
      label: t.knessetMapTooltipSector,
      value:
        locale === 'en'
          ? enProfile?.sector || '…'
          : memberTooltipFieldValue(member.sector, locale, t.knessetMapTooltipNoInfo),
    })
  }
  if (member.city.trim()) {
    rows.push({
      label: t.knessetMapTooltipCity,
      value:
        locale === 'en'
          ? enProfile?.city || '…'
          : memberTooltipFieldValue(member.city, locale, t.knessetMapTooltipNoInfo),
    })
  }
  if (member.subIdentity.trim()) {
    rows.push({
      label: t.knessetMapTooltipSubIdentity,
      value:
        locale === 'en'
          ? enProfile?.subIdentity || '…'
          : memberTooltipFieldValue(member.subIdentity, locale, t.knessetMapTooltipNoInfo),
    })
  }
  if (member.preKnessetRole.trim()) {
    rows.push({
      label: t.knessetMapTooltipPreRole,
      value:
        locale === 'en'
          ? enProfile?.preKnessetRole || '…'
          : memberTooltipFieldValue(member.preKnessetRole, locale, t.knessetMapTooltipNoInfo),
    })
  }
  if (member.professionalExperience.trim()) {
    rows.push({
      label: t.knessetMapTooltipProfessional,
      clamp: true,
      value:
        locale === 'en'
          ? enProfile?.professional || '…'
          : memberTooltipFieldValue(
              member.professionalExperience,
              locale,
              t.knessetMapTooltipNoInfo,
            ),
    })
  }
  if (member.militaryService.trim()) {
    rows.push({
      label: t.knessetMapTooltipMilitary,
      clamp: true,
      value:
        locale === 'en'
          ? enProfile?.military || '…'
          : memberTooltipFieldValue(member.militaryService, locale, t.knessetMapTooltipNoInfo),
    })
  }
  if (member.education.trim()) {
    rows.push({
      label: t.knessetMapTooltipEducation,
      value:
        locale === 'en'
          ? enProfile?.education || '…'
          : memberTooltipFieldValue(member.education, locale, t.knessetMapTooltipNoInfo),
    })
  }
  if (member.funFact.trim()) {
    rows.push({
      label: t.knessetMapTooltipFunFact,
      clamp: true,
      value:
        locale === 'en'
          ? enProfile?.funFact || '…'
          : memberTooltipFieldValue(member.funFact, locale, t.knessetMapTooltipNoInfo),
    })
  }
  return rows
}

function memberSourceCategoryLabels(t: UiStrings) {
  return {
    age: t.knessetMapTooltipAge,
    gender: t.knessetMapTooltipGender,
    knessetYears: t.knessetMapTooltipKnessetYears,
    professional: t.knessetMapTooltipProfessional,
    education: t.knessetMapTooltipEducation,
    military: t.knessetMapTooltipMilitary,
    sector: t.knessetMapTooltipSector,
    city: t.knessetMapTooltipCity,
    subIdentity: t.knessetMapTooltipSubIdentity,
    preRole: t.knessetMapTooltipPreRole,
    funFact: t.knessetMapTooltipFunFact,
    periphery: t.knessetStatsPeripheryLabel,
  }
}

const SENIOR_COMMITTEE_PRIORITY = [
  'ועדת החוץ והביטחון',
  'ועדת הכספים',
  'ועדת החוקה',
  'ועדת הכלכלה',
  'ועדת הפנים',
  'ועדת העבודה והרווחה',
]


function seniorCommitteeClause(value: string): string {
  const clauses = value.split(';').map((part) => part.trim()).filter(Boolean)
  for (const committee of SENIOR_COMMITTEE_PRIORITY) {
    const match = clauses.find((clause) => clause.includes(committee))
    if (match) return match
  }
  return clauses[0] ?? ''
}

/** Fixed, deterministic peek hierarchy. Never tailor the choice to a person. */
function parliamentaryPeek(member: KnessetMemberRow, locale: AppLocale): string {
  const p = member.parliamentary
  const current = seniorCommitteeClause(p.currentCommittees)
  if (current) return locale === 'he' ? `ועדה נוכחית: ${current}` : `Current committee: ${current}`
  const past = seniorCommitteeClause(p.pastCommittees)
  if (past) return locale === 'he' ? `ועדה בעבר: ${past}` : `Past committee: ${past}`
  if (p.billsLead.trim()) {
    return locale === 'he'
      ? `${p.billsLead.trim()} הצעות חוק כיוזם/ת ראשי/ת בכנסת ה-25`
      : `${p.billsLead.trim()} bills as lead initiator in the 25th Knesset`
  }
  if (p.votes.trim()) {
    return locale === 'he'
      ? `${p.votes.trim()} רשומות הצבעה במליאה בכנסת ה-25`
      : `${p.votes.trim()} plenary voting records in the 25th Knesset`
  }
  return ''
}

type ParliamentaryMetric = 'votes' | 'bills'

type ParliamentaryBenchmark = {
  median: number
  values: number[]
}

function parliamentaryNumber(value: string): number | null {
  const parsed = Number(value.replace(/,/g, '').trim())
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function parliamentaryBenchmarks(members: KnessetMemberRow[]): Record<ParliamentaryMetric, ParliamentaryBenchmark> {
  const unique = new Map<string, KnessetMemberRow>()
  members.forEach((member) => {
    if (!unique.has(member.name)) unique.set(member.name, member)
  })
  const valuesFor = (metric: ParliamentaryMetric) => [...unique.values()]
    .map((member) => parliamentaryNumber(
      metric === 'votes' ? member.parliamentary.votes : member.parliamentary.billsTotal,
    ))
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b)
  const benchmarkFor = (values: number[]): ParliamentaryBenchmark => {
    const middle = Math.floor(values.length / 2)
    const median = values.length === 0
      ? 0
      : values.length % 2
        ? values[middle]
        : (values[middle - 1] + values[middle]) / 2
    return { median, values }
  }
  return {
    votes: benchmarkFor(valuesFor('votes')),
    bills: benchmarkFor(valuesFor('bills')),
  }
}

function placementLabel(
  value: number,
  benchmark: ParliamentaryBenchmark,
  locale: AppLocale,
): string {
  const greater = benchmark.values.filter((candidate) => candidate > value).length
  const topShare = benchmark.values.length ? greater / benchmark.values.length : 1
  if (topShare < 1 / 3) return locale === 'he' ? 'שליש עליון' : 'Top third'
  if (value >= benchmark.median) return locale === 'he' ? 'מעל החציון' : 'Above median'
  return locale === 'he' ? 'מתחת לחציון' : 'Below median'
}

function ParliamentaryMetricRow({
  label,
  value,
  benchmark,
  locale,
}: {
  label: string
  value: number
  benchmark: ParliamentaryBenchmark
  locale: AppLocale
}) {
  // The median tick sits at 50%; values at twice the median fill the compact scale.
  const fill = benchmark.median > 0 ? Math.min(100, (value / (benchmark.median * 2)) * 100) : 0
  const formattedMedian = new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-US', {
    maximumFractionDigits: 1,
  }).format(benchmark.median)
  return (
    <div className="lpo-ps-knesset-parliamentary-metric">
      <div className="lpo-ps-knesset-parliamentary-metric-copy">
        <strong>{label}</strong>
        <span>{new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-US').format(value)}</span>
        <span className="lpo-ps-knesset-parliamentary-placement">
          {placementLabel(value, benchmark, locale)}
        </span>
      </div>
      <div className="lpo-ps-knesset-parliamentary-bar" aria-hidden="true">
        <span style={{ width: `${fill}%` }} />
        <i />
      </div>
      <small>{locale === 'he' ? `חציון ח״כי כנסת 25: ${formattedMedian}` : `25th Knesset MK median: ${formattedMedian}`}</small>
    </div>
  )
}

function ParliamentaryActivity({
  member,
  locale,
  benchmarks,
}: {
  member: KnessetMemberRow
  locale: AppLocale
  benchmarks: Record<ParliamentaryMetric, ParliamentaryBenchmark>
}) {
  const [open, setOpen] = useState(false)
  const p = member.parliamentary
  const peek = parliamentaryPeek(member, locale)
  if (!peek) return null
  const labels = locale === 'he'
    ? {
        votes: 'הצבעות במליאה', bills: 'הצעות חוק כמגיש/ה', committees: 'ועדות',
        source: 'מקור: אתר הכנסת', profile: 'לפרופיל באתר הכנסת',
      }
    : {
        votes: 'Plenary votes', bills: 'Bills submitted', committees: 'Committees',
        source: 'Source: Knesset website', profile: 'Knesset profile',
      }
  const votes = parliamentaryNumber(p.votes)
  const bills = parliamentaryNumber(p.billsTotal)
  const committee = seniorCommitteeClause(p.currentCommittees) || seniorCommitteeClause(p.pastCommittees)
  const compactMeta = [p.knessets, p.factions].filter((value) => value.trim()).join(' · ')
  return (
    <div className="lpo-ps-knesset-parliamentary">
      <button
        type="button"
        className="lpo-ps-knesset-parliamentary-peek"
        aria-expanded={open}
        onClick={(event) => { event.stopPropagation(); setOpen((value) => !value) }}
      >
        <span>{peek}</span><span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      {open ? (
        <div className="lpo-ps-knesset-parliamentary-drawer">
          {compactMeta ? <p className="lpo-ps-knesset-parliamentary-meta">{compactMeta}</p> : null}
          {votes !== null ? (
            <ParliamentaryMetricRow label={labels.votes} value={votes} benchmark={benchmarks.votes} locale={locale} />
          ) : null}
          {bills !== null ? (
            <ParliamentaryMetricRow label={labels.bills} value={bills} benchmark={benchmarks.bills} locale={locale} />
          ) : null}
          {committee ? (
            <div className="lpo-ps-knesset-parliamentary-committee">
              <strong>{labels.committees}</strong>
              <p>{committee}</p>
            </div>
          ) : null}
          <p className="lpo-ps-knesset-parliamentary-method">
            {locale === 'he'
              ? 'החציון מחושב מנתוני חברי הכנסת ה-25 המלאים בגיליון.'
              : 'Median calculated from populated 25th Knesset member data in the sheet.'}
          </p>
          <p className="lpo-ps-knesset-parliamentary-source">{labels.source}</p>
          {p.profileUrl ? <a href={p.profileUrl} target="_blank" rel="noreferrer">{labels.profile}</a> : null}
        </div>
      ) : null}
    </div>
  )
}

function MemberTooltipDetails({
  member,
  members,
  locale,
  t,
  enProfile,
}: {
  member: KnessetMemberRow
  members: KnessetMemberRow[]
  locale: AppLocale
  t: UiStrings
  enProfile: MemberEnTooltipProfile | null
}) {
  const detailRows = memberTooltipDetailRows(member, locale, t, enProfile)
  const benchmarks = useMemo(() => parliamentaryBenchmarks(members), [members])
  const sourceGroups = consolidateMemberSources(member.sources)
  const categoryLabels = memberSourceCategoryLabels(t)
  const sourcesPlain = sourceGroups
    .map((group) => {
      const source = memberSourceDisplayName(group.source, locale)
      const categories = group.categories
        .map((category) => memberSourceCategoryLabel(category, locale, categoryLabels))
        .join(', ')
      return `${source}: ${categories}`
    })
    .join(' | ')
  if (!detailRows.length && !sourceGroups.length) return null
  return (
    <>
      {detailRows.length > 0 ? (
        <div className="lpo-ps-knesset-tooltip-details">
          {detailRows.map((row) => (
            <div key={row.label}>
              <p
                className={`lpo-ps-knesset-tooltip-detail-row${
                  row.clamp ? ' lpo-ps-knesset-tooltip-detail-row--clamp' : ''
                }`}
              >
                <span className="lpo-ps-knesset-tooltip-detail-label">{row.label}:</span>
                <span className="lpo-ps-knesset-tooltip-detail-value">{row.value}</span>
              </p>
              {row.label === t.knessetMapTooltipKnessetYears ? (
                <ParliamentaryActivity member={member} locale={locale} benchmarks={benchmarks} />
              ) : null}
            </div>
          ))}
          {!detailRows.some((row) => row.label === t.knessetMapTooltipKnessetYears) ? (
            <ParliamentaryActivity member={member} locale={locale} benchmarks={benchmarks} />
          ) : null}
        </div>
      ) : null}
      {sourceGroups.length ? (
        <div className="lpo-ps-knesset-tooltip-sources" title={sourcesPlain}>
          <span className="lpo-ps-knesset-tooltip-sources-heading">{t.knessetMapTooltipSources}</span>
          <p className="lpo-ps-knesset-tooltip-sources-body">
            {sourceGroups.map((group, index) => (
              <span key={group.source} className="lpo-ps-knesset-tooltip-sources-item">
                {index > 0 ? (
                  <span className="lpo-ps-knesset-tooltip-sources-sep" aria-hidden="true"> | </span>
                ) : null}
                <span className="lpo-ps-knesset-tooltip-sources-src">
                  {memberSourceDisplayName(group.source, locale)}
                </span>
                <span className="lpo-ps-knesset-tooltip-sources-colon">:</span>
                <span className="lpo-ps-knesset-tooltip-sources-cat">
                  {group.categories
                    .map((category) =>
                      memberSourceCategoryLabel(category, locale, categoryLabels),
                    )
                    .join(', ')}
                </span>
                {group.note ? (
                  <span className="lpo-ps-knesset-tooltip-sources-note"> ({group.note})</span>
                ) : null}
              </span>
            ))}
          </p>
        </div>
      ) : null}
    </>
  )
}

function KnessetSeatTooltip({
  tooltip,
  members,
  locale,
  t,
  displayParty,
  rankLabel,
  segLabel,
  photoCredit,
  portalRef,
  onPointerEnter,
  onPointerLeave,
  openLinksInNewTab = false,
}: {
  tooltip: TooltipState
  members: KnessetMemberRow[]
  locale: AppLocale
  t: UiStrings
  displayParty: (partyKey: string) => string
  rankLabel: (seat: KnessetFilledSeat) => string
  segLabel: (segment: Segment) => string
  photoCredit: PhotoCreditRecord | null
  portalRef?: (el: HTMLDivElement | null) => void
  onPointerEnter?: () => void
  onPointerLeave?: () => void
  openLinksInNewTab?: boolean
}) {
  const member = tooltip.seat.kind === 'member' ? tooltip.seat.member : null
  const [enProfile, setEnProfile] = useState<MemberEnTooltipProfile | null>(null)

  useEffect(() => {
    if (!member || locale !== 'en') {
      setEnProfile(null)
      return
    }
    let cancelled = false
    setEnProfile(null)
    resolveMemberEnTooltip(
      member,
      t.knessetMapTooltipNoInfo,
      t.knessetMapTooltipUnknownName,
    ).then((profile) => {
      if (!cancelled) setEnProfile(profile)
    })
    return () => {
      cancelled = true
    }
  }, [member, locale, t.knessetMapTooltipNoInfo, t.knessetMapTooltipUnknownName])

  const memberName =
    tooltip.seat.kind === 'member'
      ? locale === 'en'
        ? enProfile?.name || memberTooltipName(tooltip.seat.member, locale)
        : memberHebrewName(tooltip.seat.member)
      : ''

  const tooltipRef = useRef<HTMLDivElement>(null)
  const [left, setLeft] = useState(tooltip.x)
  const [verticalLayout, setVerticalLayout] = useState<TooltipVerticalLayout>(() => ({
    placement: tooltip.placement,
    top: tooltip.y,
  }))

  useLayoutEffect(() => {
    setLeft(tooltip.x)
    const el = tooltipRef.current
    if (!el) return

    el.style.maxHeight = ''
    const cardHeight = el.scrollHeight
    const nextVertical = resolveTooltipVerticalLayout(
      tooltip.y,
      tooltip.placement,
      cardHeight,
    )
    setVerticalLayout((prev) => {
      if (
        prev.placement === nextVertical.placement &&
        prev.top === nextVertical.top &&
        prev.maxHeight === nextVertical.maxHeight &&
        prev.pinTop === nextVertical.pinTop
      ) {
        return prev
      }
      return nextVertical
    })

    const applyHorizontalClamp = () => {
      const width = Math.max(el.offsetWidth, el.scrollWidth, TOOLTIP_LAYOUT_WIDTH_PX)
      if (width < 120) return
      const next = clampTooltipX(tooltip.x, width)
      setLeft((prev) => (prev === next ? prev : next))
    }

    applyHorizontalClamp()
    const raf = requestAnimationFrame(applyHorizontalClamp)
    return () => cancelAnimationFrame(raf)
  }, [tooltip.x, tooltip.y, tooltip.placement, tooltip.seat, memberName, enProfile, locale, t])

  const placementClass = verticalLayout.pinTop
    ? 'above-pin'
    : verticalLayout.placement

  return (
    <div
      ref={(el) => {
        tooltipRef.current = el
        portalRef?.(el)
      }}
      className={`lpo-ps-knesset-tooltip lpo-ps-knesset-tooltip--${placementClass}${
        locale === 'he' ? ' lpo-ps-knesset-tooltip--rtl' : ' lpo-ps-knesset-tooltip--ltr'
      }`}
      style={{
        left,
        top: verticalLayout.top,
        maxHeight: verticalLayout.maxHeight,
      }}
      dir={locale === 'he' ? 'rtl' : 'ltr'}
      role="tooltip"
      onMouseEnter={onPointerEnter}
      onMouseLeave={onPointerLeave}
    >
      <div className="lpo-ps-knesset-tooltip-header">
        <div className="lpo-ps-knesset-tooltip-main">
          <div className="lpo-ps-knesset-tooltip-header-text">
            {tooltip.seat.kind === 'member' ? (
              <p className="lpo-ps-knesset-tooltip-name">{memberName}</p>
            ) : (
              <p className="lpo-ps-knesset-tooltip-name">{displayParty(tooltip.seat.partyKey)}</p>
            )}
            <p className="lpo-ps-knesset-tooltip-rank">{rankLabel(tooltip.seat)}</p>
            <p className="lpo-ps-knesset-tooltip-meta">
              <span
                className="lpo-ps-knesset-tooltip-segment"
                style={{ color: SEGMENT_COLORS[tooltip.seat.segment] }}
              >
                {segLabel(tooltip.seat.segment)}
              </span>
              <span
                className="lpo-ps-knesset-tooltip-party"
                style={{
                  color: PARTY_COLOR_MAP[tooltip.seat.partyKey] ?? tooltip.seat.ringColor,
                }}
              >
                {displayParty(tooltip.seat.partyKey)}
              </span>
            </p>
          </div>
          {tooltip.seat.kind === 'member' && tooltip.seat.member.portraitImageUrl ? (
            <div className="lpo-ps-knesset-tooltip-portrait-wrap">
              <img
                className="lpo-ps-knesset-tooltip-portrait"
                src={tooltip.seat.member.portraitImageUrl}
                alt=""
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
              />
              <PhotoCreditLine
                credit={photoCredit}
                t={t}
                className="lpo-ps-photo-credit--tooltip"
                openLinksInNewTab={openLinksInNewTab}
              />
            </div>
          ) : null}
          {member ? (
            <MemberTooltipDetails
              member={member}
              members={members}
              locale={locale}
              t={t}
              enProfile={enProfile}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

function clearMobileSwingCoords(target: HTMLElement) {
  target.style.removeProperty('--lpo-ps-knesset-swing-fixed-top')
  target.style.removeProperty('--lpo-ps-knesset-swing-fixed-left')
  target.style.removeProperty('--lpo-ps-knesset-swing-fixed-right')
  target.style.removeProperty('--lpo-ps-knesset-swing-wing-seg-width')
}

/** Mobile portrait: float swing stack over header bloc bar, aligned to opp/coal segments. */
function positionMobileSwingOverBlocBar(
  dialog: HTMLElement,
  portalTarget: HTMLElement,
  partySwing: { side: 'left' | 'right' } | null | undefined,
  faceSize: number,
): boolean {
  const barTrack = dialog.querySelector(
    '.lpo-ps-hero-chart-bloc-bar .lpo-ps-bar-track',
  ) as HTMLElement | null

  clearMobileSwingCoords(portalTarget)

  if (!barTrack || !partySwing) return false

  const portalRect = portalTarget.getBoundingClientRect()
  const swingStack = portalTarget.querySelector(
    '.lpo-ps-knesset-swing-stack',
  ) as HTMLElement | null
  const swingAnchor = portalTarget.querySelector(
    '.lpo-ps-knesset-swing-anchor',
  ) as HTMLElement | null

  const stackH = swingStack?.getBoundingClientRect().height ?? faceSize + 36
  const trackRect = barTrack.getBoundingClientRect()
  const mapStage = dialog.querySelector('.lpo-ps-knesset-map-stage') as HTMLElement | null
  const mapStageTop = mapStage
    ? mapStage.getBoundingClientRect().top - portalRect.top
    : null

  // Sit a bit lower over the bloc bar, but never overlap the hemicycle stage.
  const mapClearancePx = 8
  const extraDropPx = 34
  let top =
    trackRect.top -
    portalRect.top -
    stackH +
    Math.round(trackRect.height * 0.1) +
    extraDropPx
  if (mapStageTop != null) {
    const maxTop = mapStageTop - stackH - mapClearancePx
    top = Math.min(top, maxTop)
  }

  portalTarget.style.setProperty('--lpo-ps-knesset-swing-fixed-top', `${top}px`)

  const anchorW =
    swingAnchor?.getBoundingClientRect().width ??
    Math.min(portalRect.width * 0.34, 7.35 * 16)

  if (partySwing.side === 'right') {
    const coalSeg = dialog.querySelector(
      '.lpo-ps-hero-chart-bloc-bar .lpo-ps-seg--coal',
    ) as HTMLElement | null
    if (!coalSeg) return false
    const segRect = coalSeg.getBoundingClientRect()
    portalTarget.style.setProperty('--lpo-ps-knesset-swing-wing-seg-width', `${segRect.width}px`)
    const centerX = segRect.left + segRect.width * 0.68
    const right = portalRect.right - (centerX + anchorW / 2)
    portalTarget.style.setProperty('--lpo-ps-knesset-swing-fixed-right', `${Math.max(4, right)}px`)
    portalTarget.style.removeProperty('--lpo-ps-knesset-swing-fixed-left')
  } else {
    const oppSeg = dialog.querySelector(
      '.lpo-ps-hero-chart-bloc-bar .lpo-ps-seg--opp',
    ) as HTMLElement | null
    if (!oppSeg) return false
    const segRect = oppSeg.getBoundingClientRect()
    portalTarget.style.setProperty('--lpo-ps-knesset-swing-wing-seg-width', `${segRect.width}px`)
    const centerX = segRect.left + segRect.width * 0.32
    const left = centerX - anchorW / 2 - portalRect.left
    portalTarget.style.setProperty('--lpo-ps-knesset-swing-fixed-left', `${Math.max(4, left)}px`)
    portalTarget.style.removeProperty('--lpo-ps-knesset-swing-fixed-right')
  }

  return true
}

function SeatPortraitMedia({ seat }: { seat: KnessetFilledSeat }) {
  if (seat.kind === 'member') {
    const memberImage = memberSeatImageUrl(seat.member)
    if (memberImage) {
      return (
        <img
          className="lpo-ps-knesset-seat-img"
          src={memberImage}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
        />
      )
    }
  }

  return <KnessetSeatEmptyPortraitIcon />
}

function SwingSeatPortrait({
  seat,
  locale,
  displayParty,
  onPointerEnter,
  onLeave,
  onMove,
  onBlur,
  onPointerDown,
}: {
  seat: KnessetFilledSeat
  locale: AppLocale
  displayParty: (partyKey: string) => string
  onPointerEnter: (e: React.MouseEvent<HTMLButtonElement>) => void
  onLeave: () => void
  onMove: (e: React.MouseEvent<HTMLButtonElement>) => void
  onBlur: (e: React.FocusEvent<HTMLButtonElement>) => void
  onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void
}) {
  const isMember = seat.kind === 'member'
  const isPlaceholder = seat.kind === 'placeholder'
  const ring = seat.ringColor

  return (
    <button
      type="button"
      className={`lpo-ps-knesset-seat lpo-ps-knesset-seat--swing${
        isPlaceholder ? ' lpo-ps-knesset-seat--placeholder' : ''
      }`}
      style={{ '--lpo-ps-knesset-ring': ring } as CSSProperties}
      onMouseEnter={onPointerEnter}
      onMouseLeave={onLeave}
      onFocus={(e) => onPointerEnter(e as unknown as React.MouseEvent<HTMLButtonElement>)}
      onBlur={onBlur}
      onMouseMove={onMove}
      onPointerDown={onPointerDown}
      aria-label={
        isMember ? memberTooltipName(seat.member, locale) : displayParty(seat.partyKey)
      }
    >
      <SeatPortraitMedia seat={seat} />
    </button>
  )
}

function PartySwingSeatsOverlay({
  swing,
  locale,
  t,
  displayParty,
  onPointerEnter,
  onLeave,
  onMove,
  onBlur,
  onPointerDown,
}: {
  swing: NonNullable<ReturnType<typeof computePartySwingSeats>>
  locale: AppLocale
  t: UiStrings
  displayParty: (partyKey: string) => string
  onPointerEnter: (e: React.MouseEvent<HTMLButtonElement>, seat: KnessetFilledSeat) => void
  onLeave: () => void
  onMove: (e: React.MouseEvent<HTMLButtonElement>, seat: KnessetFilledSeat) => void
  onBlur: (e: React.FocusEvent<HTMLButtonElement>, seat: KnessetFilledSeat) => void
  onPointerDown: (e: React.PointerEvent<HTMLButtonElement>, seat: KnessetFilledSeat) => void
}) {
  if (swing.nextOut.length === 0 && swing.atRiskIn.length === 0) return null

  const showOut = swing.nextOut.length > 0
  const showIn = swing.atRiskIn.length > 0

  return (
    <div className={`lpo-ps-knesset-swing-anchor lpo-ps-knesset-swing-anchor--wing-${swing.side}`}>
      <div
        className={`lpo-ps-knesset-swing-panel${
          locale === 'he' ? ' lpo-ps-knesset-swing-panel--he' : ''
        }`}
        dir="ltr"
        aria-label={t.knessetMapSwingTitle}
      >
        <div className="lpo-ps-knesset-swing-stack">
          <p className="lpo-ps-knesset-swing-title">{t.knessetMapSwingTitle}</p>
          <div className="lpo-ps-knesset-swing-groups">
            {showOut ? (
              <div className="lpo-ps-knesset-swing-group" aria-label={t.knessetMapSwingOutAria}>
                <p className="lpo-ps-knesset-swing-group-label">{t.knessetMapSwingOutLabel}</p>
                <div className="lpo-ps-knesset-swing-portraits">
                  {swing.nextOut.map((seat) => (
                    <SwingSeatPortrait
                      key={`out-${seat.kind === 'member' ? seat.member.listRank : seat.slot.id}`}
                      seat={seat}
                      locale={locale}
                      displayParty={displayParty}
                      onPointerEnter={(e) => onPointerEnter(e, seat)}
                      onLeave={onLeave}
                      onMove={(e) => onMove(e, seat)}
                      onBlur={(e) => onBlur(e, seat)}
                      onPointerDown={(e) => onPointerDown(e, seat)}
                    />
                  ))}
                </div>
                <span
                  className="lpo-ps-knesset-swing-arrow lpo-ps-knesset-swing-arrow--out"
                  aria-hidden
                />
              </div>
            ) : null}
            {showOut && showIn ? <div className="lpo-ps-knesset-swing-divider" aria-hidden /> : null}
            {showIn ? (
              <div className="lpo-ps-knesset-swing-group" aria-label={t.knessetMapSwingInAria}>
                <p className="lpo-ps-knesset-swing-group-label">{t.knessetMapSwingInLabel}</p>
                <div className="lpo-ps-knesset-swing-portraits">
                  {swing.atRiskIn.map((seat) => (
                    <SwingSeatPortrait
                      key={`in-${seat.kind === 'member' ? seat.member.listRank : seat.slot.id}`}
                      seat={seat}
                      locale={locale}
                      displayParty={displayParty}
                      onPointerEnter={(e) => onPointerEnter(e, seat)}
                      onLeave={onLeave}
                      onMove={(e) => onMove(e, seat)}
                      onBlur={(e) => onBlur(e, seat)}
                      onPointerDown={(e) => onPointerDown(e, seat)}
                    />
                  ))}
                </div>
                <span
                  className="lpo-ps-knesset-swing-arrow lpo-ps-knesset-swing-arrow--in"
                  aria-hidden
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function SeatPortrait({
  seat,
  visualState,
  locale,
  displayParty,
  onPointerEnter,
  onLeave,
  onMove,
  onBlur,
  onPointerDown,
}: {
  seat: KnessetFilledSeat
  visualState: KnessetSeatFilterVisualState
  locale: AppLocale
  displayParty: (partyKey: string) => string
  onPointerEnter: (e: React.MouseEvent<HTMLButtonElement>) => void
  onLeave: () => void
  onMove: (e: React.MouseEvent<HTMLButtonElement>) => void
  onBlur: (e: React.FocusEvent<HTMLButtonElement>) => void
  onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void
}) {
  const isMember = seat.kind === 'member'
  const isPlaceholder = seat.kind === 'placeholder'
  const ring = seat.ringColor

  return (
    <button
      type="button"
      className={`lpo-ps-knesset-seat${
        isPlaceholder ? ' lpo-ps-knesset-seat--placeholder' : ''
      }${visualState === 'dimmed' ? ' lpo-ps-knesset-seat--dimmed' : ''}${
        visualState === 'milUnknown' ? ' lpo-ps-knesset-seat--mil-unknown' : ''
      }`}
      style={
        {
          left: `${seat.slot.x}%`,
          top: `${seat.slot.y}%`,
          '--lpo-ps-knesset-ring': ring,
        } as CSSProperties
      }
      onMouseEnter={onPointerEnter}
      onMouseLeave={onLeave}
      onFocus={(e) => onPointerEnter(e as unknown as React.MouseEvent<HTMLButtonElement>)}
      onBlur={onBlur}
      onMouseMove={onMove}
      onPointerDown={onPointerDown}
      aria-label={
        isMember ? memberTooltipName(seat.member, locale) : displayParty(seat.partyKey)
      }
    >
      <SeatPortraitMedia seat={seat} />
      {visualState === 'milUnknown' ? (
        <span className="lpo-ps-knesset-seat-mil-unknown-badge" aria-hidden="true">?</span>
      ) : null}
    </button>
  )
}

export function PollSummaryKnessetSeatMap({
  poll,
  displayParty,
  locale,
  t,
  mapFilters,
  onMapFiltersChange,
  onMatchingPartyKeysChange,
  mergeArabsWithOpposition = false,
  stageOverlay,
}: {
  poll: RollingPoll
  displayParty: (partyKey: string) => string
  locale: AppLocale
  t: UiStrings
  mapFilters?: KnessetMapFilters
  onMapFiltersChange?: (filters: KnessetMapFilters) => void
  onMatchingPartyKeysChange?: (keys: ReadonlySet<string> | null) => void
  mergeArabsWithOpposition?: boolean
  /** Rendered inside the map stage (same % coords as seats) — e.g. bloc + party table. */
  stageOverlay?: ReactNode
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [members, setMembers] = useState<KnessetMemberRow[] | null>(null)
  const [photoCredits, setPhotoCredits] = useState<PhotoCreditRecord[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [pinnedSeatId, setPinnedSeatId] = useState<number | null>(null)
  const pinnedSeatIdRef = useRef<number | null>(null)
  const tooltipKeepAliveRef = useRef(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suppressSeatOpenRef = useRef(false)
  const tooltipPortalRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    pinnedSeatIdRef.current = pinnedSeatId
  }, [pinnedSeatId])

  useEffect(() => {
    let cancelled = false
    fetchKnessetMembers()
      .then((rows) => {
        if (!cancelled) setMembers(rows)
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
    fetchPhotoCredits()
      .then((rows) => {
        if (!cancelled) setPhotoCredits(rows)
      })
      .catch(() => {
        /* credits are optional — tooltip/page degrade gracefully */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const photoCreditIndex = useMemo(
    () => (photoCredits ? buildPhotoCreditIndex(photoCredits) : new Map()),
    [photoCredits],
  )

  const tooltipPhotoCredit = useMemo(() => {
    if (!tooltip || tooltip.seat.kind !== 'member') return null
    return photoCreditForMember(tooltip.seat.member, photoCreditIndex)
  }, [tooltip, photoCreditIndex])

  const seats = useMemo(() => {
    if (!members) return []
    const byParty = membersByPartyKey(members)
    return buildKnessetFilledSeats(poll, byParty)
  }, [members, poll])

  const activeFilters = mapFilters ?? []

  const membersByParty = useMemo(
    () => (members ? membersByPartyKey(members) : new Map<string, KnessetMemberRow[]>()),
    [members],
  )

  const focusedPartyKey = activeFilters.find((f) => f.kind === 'party')?.partyKey ?? null

  const partySwing = useMemo(() => {
    if (!focusedPartyKey || !members) return null
    return computePartySwingSeats(focusedPartyKey, seats, membersByParty)
  }, [focusedPartyKey, seats, membersByParty, members])

  const [swingPortalEl, setSwingPortalEl] = useState<HTMLElement | null>(null)

  useLayoutEffect(() => {
    const wrap = wrapRef.current?.closest(
      '.lpo-ps-hero-chart-hemicycle-wrap',
    ) as HTMLElement | null
    if (!wrap) {
      setSwingPortalEl(null)
      return
    }

    const dialog = wrap.closest('.lpo-ps-hero-chart-dialog') as HTMLElement | null
    const overlay = dialog?.closest('.lpo-ps-hero-chart-overlay') as HTMLElement | null
    const touchZoomInner = wrap.closest(
      '.lpo-ps-hero-chart-touch-zoom-inner',
    ) as HTMLElement | null

    const updateSwingLayout = () => {
      const isMobileLayout = window.matchMedia(HERO_CHART_COMPACT_MQ).matches
      // Desktop: portal to the overlay and use fixed viewport coords so the stack is never
      // clipped by scale-shell / dialog overflow when sitting above the filter row.
      // Mobile: portal into touch-zoom-inner so pinch/pan transform applies to swing wings too.
      const portalTarget = isMobileLayout
        ? (touchZoomInner ?? wrap)
        : (overlay ?? dialog ?? wrap)
      const wrapRect = wrap.getBoundingClientRect()
      const portalOriginRect = portalTarget.getBoundingClientRect()
      const resetBtn = wrap.querySelector(
        '.lpo-ps-knesset-filters-reset',
      ) as HTMLElement | null
      const mapStage = wrap.querySelector('.lpo-ps-knesset-map-stage') as HTMLElement | null

      setSwingPortalEl(portalTarget)
      wrap.classList.toggle('lpo-ps-hero-chart-hemicycle-wrap--swing-mobile', isMobileLayout)
      dialog?.classList.toggle(
        'lpo-ps-hero-chart-dialog--swing-mobile',
        isMobileLayout && Boolean(partySwing),
      )

      if (!mapStage) return

      const stageRect = mapStage.getBoundingClientRect()
      const stageTop = stageRect.top - wrapRect.top
      const stageWidth = stageRect.width
      const mapSeatEl = mapStage.querySelector(
        '.lpo-ps-knesset-seat:not(.lpo-ps-knesset-seat--swing)',
      ) as HTMLElement | null
      const mapSeatSize = mapSeatEl?.getBoundingClientRect().width ?? stageWidth * 0.0355
      const faceSize = isMobileLayout
        ? Math.round(mapSeatSize)
        : Math.round(Math.max(22, Math.min(40, stageWidth * 0.0355 * 1.55)))

      portalTarget.style.setProperty('--lpo-ps-knesset-swing-face-size', `${faceSize}px`)

      if (isMobileLayout && dialog) {
        overlay?.style.removeProperty('--lpo-ps-knesset-swing-fixed-top')
        overlay?.style.removeProperty('--lpo-ps-knesset-swing-fixed-left')
        overlay?.style.removeProperty('--lpo-ps-knesset-swing-fixed-right')
        if (dialog) clearMobileSwingCoords(dialog)
        portalTarget.style.removeProperty('--lpo-ps-knesset-swing-anchor-top')
        wrap.style.removeProperty('--lpo-ps-knesset-swing-stack-gap')

        positionMobileSwingOverBlocBar(dialog, portalTarget, partySwing, faceSize)
        return
      }

      if (touchZoomInner) clearMobileSwingCoords(touchZoomInner)
      dialog?.style.removeProperty('--lpo-ps-knesset-swing-fixed-top')
      dialog?.style.removeProperty('--lpo-ps-knesset-swing-fixed-left')
      dialog?.style.removeProperty('--lpo-ps-knesset-swing-fixed-right')

      wrap.style.setProperty('--lpo-ps-knesset-swing-stage-top', `${stageTop}px`)

      const rootFontSize =
        parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      const groupGap = 0.1 * rootFontSize
      const arrowHeight = 0.62 * rootFontSize
      const stackGap = 0.2 * rootFontSize

      portalTarget.style.setProperty('--lpo-ps-knesset-swing-stack-gap', `${stackGap}px`)

      const clearDesktopSwingCoords = () => {
        portalTarget.style.removeProperty('--lpo-ps-knesset-swing-anchor-top')
        portalTarget.style.removeProperty('--lpo-ps-knesset-swing-fixed-top')
        portalTarget.style.removeProperty('--lpo-ps-knesset-swing-fixed-left')
        portalTarget.style.removeProperty('--lpo-ps-knesset-swing-fixed-right')
      }

      if (resetBtn && !isMobileLayout) {
        const resetRect = resetBtn.getBoundingClientRect()
        const clearance = 0.15 * rootFontSize
        const stackCeiling = resetRect.top - clearance

        const swingStack = portalTarget.querySelector(
          '.lpo-ps-knesset-swing-stack',
        ) as HTMLElement | null
        const stackH =
          swingStack?.getBoundingClientRect().height ??
          2.15 * rootFontSize + faceSize + groupGap + arrowHeight + stackGap

        const applyFixedTop = (viewportTop: number) => {
          portalTarget.style.setProperty(
            '--lpo-ps-knesset-swing-fixed-top',
            `${viewportTop - portalOriginRect.top}px`,
          )
        }

        // Wing stacks sit in the side gutter — can use vertical space from dialog top
        // through the header's side margins (not the wrap top, which is the filter row).
        const floor = (dialog?.getBoundingClientRect().top ?? portalOriginRect.top) + 8

        // Stack bottom aligns just above איפוס מסננים (viewport coords → overlay-local fixed).
        let fixedTop = Math.max(floor, stackCeiling - stackH)
        applyFixedTop(fixedTop)

        const wingInset = wrapRect.width * 0.09
        if (partySwing?.side === 'right') {
          portalTarget.style.setProperty(
            '--lpo-ps-knesset-swing-fixed-right',
            `${portalOriginRect.right - wrapRect.right + wingInset}px`,
          )
          portalTarget.style.removeProperty('--lpo-ps-knesset-swing-fixed-left')
        } else {
          portalTarget.style.setProperty(
            '--lpo-ps-knesset-swing-fixed-left',
            `${wrapRect.left + wingInset - portalOriginRect.left}px`,
          )
          portalTarget.style.removeProperty('--lpo-ps-knesset-swing-fixed-right')
        }

        if (swingStack) {
          const stackBottom = swingStack.getBoundingClientRect().bottom
          if (stackBottom > stackCeiling) {
            fixedTop = Math.max(floor, fixedTop - (stackBottom - stackCeiling))
            applyFixedTop(fixedTop)
          }
        }

        wrap.style.removeProperty('--lpo-ps-knesset-swing-top')
        wrap.style.removeProperty('--lpo-ps-knesset-swing-portraits-top')
      } else if (resetBtn && isMobileLayout) {
        clearDesktopSwingCoords()
      } else {
        clearDesktopSwingCoords()
        const portraitTop = stageTop + stageRect.height * 0.045
        wrap.style.setProperty('--lpo-ps-knesset-swing-portraits-top', `${portraitTop}px`)
      }
    }

    updateSwingLayout()
    const remeasureSwing = () => {
      requestAnimationFrame(() => {
        updateSwingLayout()
        requestAnimationFrame(updateSwingLayout)
      })
    }
    if (partySwing) remeasureSwing()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateSwingLayout) : null
    ro?.observe(wrap)
    if (dialog) ro?.observe(dialog)
    const filtersResetBtn = wrap.querySelector('.lpo-ps-knesset-filters-reset')
    if (filtersResetBtn) ro?.observe(filtersResetBtn)
    const blocBarTrack = dialog?.querySelector('.lpo-ps-hero-chart-bloc-bar .lpo-ps-bar-track')
    if (blocBarTrack) ro?.observe(blocBarTrack)
    window.addEventListener('resize', updateSwingLayout)
    // The mobile/compact dialog scrolls as a single unit (header + body), so the swing panel's
    // fixed-pixel offset (measured from the dialog's own bounding rect) must be recomputed as the
    // user scrolls — otherwise it drifts away from the seat map it's meant to sit above.
    const dialogBody = dialog?.querySelector('.lpo-ps-hero-chart-body')
    dialog?.addEventListener('scroll', updateSwingLayout, { passive: true })
    dialogBody?.addEventListener('scroll', updateSwingLayout, { passive: true })
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', updateSwingLayout)
      dialog?.removeEventListener('scroll', updateSwingLayout)
      dialogBody?.removeEventListener('scroll', updateSwingLayout)
      dialog?.classList.remove('lpo-ps-hero-chart-dialog--swing-mobile')
      if (touchZoomInner) clearMobileSwingCoords(touchZoomInner)
      if (dialog) clearMobileSwingCoords(dialog)
    }
  }, [loadError, members, partySwing])

  useEffect(() => {
    if (!onMatchingPartyKeysChange) return
    if (!activeFilters.length) {
      onMatchingPartyKeysChange(null)
      return
    }
    onMatchingPartyKeysChange(
      partyKeysMatchingFilters(seats, activeFilters, mergeArabsWithOpposition),
    )
  }, [seats, activeFilters, mergeArabsWithOpposition, onMatchingPartyKeysChange])

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer])

  const scheduleTooltipClose = useCallback(() => {
    if (pinnedSeatIdRef.current) return
    clearCloseTimer()
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null
      if (!tooltipKeepAliveRef.current && !pinnedSeatIdRef.current) {
        setTooltip(null)
      }
    }, TOOLTIP_CLOSE_DELAY_MS)
  }, [clearCloseTimer])

  const showTooltipAt = useCallback(
    (
      e: React.MouseEvent<HTMLButtonElement> | React.PointerEvent<HTMLButtonElement>,
      seat: KnessetFilledSeat,
    ) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = rect.width > 0 ? rect.left + rect.width / 2 : e.clientX
      const y = rect.height > 0 ? rect.top + rect.height / 2 : e.clientY
      setTooltip({
        seat,
        x,
        y,
        placement: tooltipPlacement(y),
      })
    },
    [],
  )

  const handleSeatPointerEnter = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>, seat: KnessetFilledSeat) => {
      if (suppressSeatOpenRef.current) return
      if (pinnedSeatIdRef.current && pinnedSeatIdRef.current !== seat.slot.id) return

      clearCloseTimer()
      tooltipKeepAliveRef.current = true
      showTooltipAt(e, seat)
    },
    [clearCloseTimer, showTooltipAt],
  )

  const handleSeatPointerLeave = useCallback(() => {
    tooltipKeepAliveRef.current = false
    if (pinnedSeatIdRef.current) return
    scheduleTooltipClose()
  }, [scheduleTooltipClose])

  const handleSeatPointerMove = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>, seat: KnessetFilledSeat) => {
      if (suppressSeatOpenRef.current) return
      if (pinnedSeatIdRef.current && pinnedSeatIdRef.current !== seat.slot.id) return
      showTooltipAt(e, seat)
    },
    [showTooltipAt],
  )

  const handleSeatBlur = useCallback(
    (e: React.FocusEvent<HTMLButtonElement>) => {
      const next = e.relatedTarget as Node | null
      if (next && tooltipPortalRef.current?.contains(next)) return
      tooltipKeepAliveRef.current = false
      if (pinnedSeatIdRef.current) return
      scheduleTooltipClose()
    },
    [scheduleTooltipClose],
  )

  const handleSeatPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>, seat: KnessetFilledSeat) => {
      if (e.pointerType !== 'touch') return
      if (suppressSeatOpenRef.current) return
      if (pinnedSeatIdRef.current && pinnedSeatIdRef.current !== seat.slot.id) return

      clearCloseTimer()
      tooltipKeepAliveRef.current = true
      setPinnedSeatId(seat.slot.id)
      showTooltipAt(e, seat)
    },
    [clearCloseTimer, showTooltipAt],
  )

  const handleTooltipPointerEnter = useCallback(() => {
    clearCloseTimer()
    tooltipKeepAliveRef.current = true
  }, [clearCloseTimer])

  const handleTooltipPointerLeave = useCallback(() => {
    tooltipKeepAliveRef.current = false
    if (pinnedSeatIdRef.current) return
    scheduleTooltipClose()
  }, [scheduleTooltipClose])

  useEffect(() => {
    if (!pinnedSeatId) return

    const handleOutsidePointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (tooltipPortalRef.current?.contains(target)) return

      setPinnedSeatId(null)
      setTooltip(null)
      tooltipKeepAliveRef.current = false
      clearCloseTimer()
      suppressSeatOpenRef.current = true
      window.setTimeout(() => {
        suppressSeatOpenRef.current = false
      }, TOOLTIP_SUPPRESS_SEAT_OPEN_MS)
    }

    document.addEventListener('pointerdown', handleOutsidePointerDown, true)
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown, true)
  }, [pinnedSeatId, clearCloseTimer])

  const segLabel = (segment: Segment) =>
    segmentLabel(segment, {
      knessetMapCoalition: t.knessetMapCoalition,
      knessetMapOpposition: t.knessetMapOpposition,
      knessetMapArabs: t.knessetMapArabs,
    })

  const rankLabel = (seat: KnessetFilledSeat) =>
    t.knessetMapListRank
      .replace(/\{rank\}/g, String(seat.listRank))
      .replace(/\{total\}/g, String(seat.partySeatTotal))

  const handleToggleFilter = (next: KnessetMapFocusItem) => {
    if (!onMapFiltersChange) return
    onMapFiltersChange(toggleMapFilter(activeFilters, next))
  }

  const showStats = seats.length > 0 && Boolean(onMapFiltersChange)

  return (
    <div
      ref={wrapRef}
      className={`lpo-ps-knesset-map${activeFilters.length ? ' lpo-ps-knesset-map--party-focus' : ''}`}
      dir={locale === 'he' ? 'rtl' : 'ltr'}
      aria-label={t.knessetMapAria}
    >
      {loadError ? (
        <p className="lpo-ps-knesset-map-status">{t.knessetMapLoadError}</p>
      ) : !members ? (
        <p className="lpo-ps-knesset-map-status">{t.knessetMapLoading}</p>
      ) : (
        <>
          <div
            className={`lpo-ps-knesset-map-row${showStats ? ' lpo-ps-knesset-map-row--with-stats' : ''}`}
            dir="ltr"
          >
            {showStats ? (
              <div className="lpo-ps-knesset-stats-gutter lpo-ps-knesset-stats-gutter--left">
                <KnessetStatsLeftStack
                  seats={seats}
                  mergeArabsWithOpposition={mergeArabsWithOpposition}
                  locale={locale}
                  t={t}
                  mapFilters={activeFilters}
                  onToggleFocus={handleToggleFilter}
                />
              </div>
            ) : null}
            <div
              className="lpo-ps-knesset-map-stage"
              style={knessetHollowInsetStyle() as CSSProperties}
            >
              {stageOverlay}
              {seats.map((seat) => (
                <SeatPortrait
                  key={seat.slot.id}
                  seat={seat}
                  visualState={seatFilterVisualState(
                    seat,
                    activeFilters,
                    mergeArabsWithOpposition,
                  )}
                  locale={locale}
                  displayParty={displayParty}
                  onPointerEnter={(e) => handleSeatPointerEnter(e, seat)}
                  onLeave={handleSeatPointerLeave}
                  onMove={(e) => handleSeatPointerMove(e, seat)}
                  onBlur={handleSeatBlur}
                  onPointerDown={(e) => handleSeatPointerDown(e, seat)}
                />
              ))}
            </div>
            {showStats ? (
              <div className="lpo-ps-knesset-stats-gutter lpo-ps-knesset-stats-gutter--right">
                <KnessetStatsRightStack
                  seats={seats}
                  mergeArabsWithOpposition={mergeArabsWithOpposition}
                  t={t}
                  mapFilters={activeFilters}
                  onToggleFocus={handleToggleFilter}
                />
              </div>
            ) : null}
          </div>
          {partySwing && swingPortalEl
            ? createPortal(
                <PartySwingSeatsOverlay
                  swing={partySwing}
                  locale={locale}
                  t={t}
                  displayParty={displayParty}
                  onPointerEnter={handleSeatPointerEnter}
                  onLeave={handleSeatPointerLeave}
                  onMove={handleSeatPointerMove}
                  onBlur={handleSeatBlur}
                  onPointerDown={handleSeatPointerDown}
                />,
                swingPortalEl,
              )
            : null}
          {tooltip
            ? createPortal(
                <KnessetSeatTooltip
                  key={tooltip.seat.slot.id}
                  tooltip={tooltip}
                  members={members ?? []}
                  locale={locale}
                  t={t}
                  displayParty={displayParty}
                  rankLabel={rankLabel}
                  segLabel={segLabel}
                  photoCredit={tooltipPhotoCredit}
                  portalRef={(el) => {
                    tooltipPortalRef.current = el
                  }}
                  onPointerEnter={handleTooltipPointerEnter}
                  onPointerLeave={handleTooltipPointerLeave}
                  openLinksInNewTab
                />,
                document.body,
              )
            : null}
        </>
      )}
    </div>
  )
      }
