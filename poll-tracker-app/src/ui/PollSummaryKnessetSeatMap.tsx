import {
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
import { PARTY_COLOR_MAP, PARTY_ICON_MAP, SEGMENT_COLORS } from '../config/mappings'
import {
  fetchKnessetMembers,
  membersByPartyKey,
  segmentLabel,
  type KnessetMemberRow,
} from '../lib/knessetMembersSheet'
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
  seatMatchesFilters,
  toggleMapFilter,
  type KnessetMapFilters,
  type KnessetMapFocusItem,
} from '../lib/knessetSeatDemographics'
import { computePartySwingSeats } from '../lib/knessetPartySwingSeats'
import type { Segment } from '../types/data'
import { KnessetStatsLeftStack, KnessetStatsRightStack } from './PollSummaryKnessetDemographics'
import { RotatePortraitHint } from './RotatePortraitHint'

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

function MemberTooltipDetails({
  member,
  locale,
  t,
  enProfile,
}: {
  member: KnessetMemberRow
  locale: AppLocale
  t: UiStrings
  enProfile: MemberEnTooltipProfile | null
}) {
  const detailRows = memberTooltipDetailRows(member, locale, t, enProfile)
  if (!detailRows.length) return null
  return (
    <div className="lpo-ps-knesset-tooltip-details">
      {detailRows.map((row) => (
        <p
          key={row.label}
          className={`lpo-ps-knesset-tooltip-detail-row${
            row.clamp ? ' lpo-ps-knesset-tooltip-detail-row--clamp' : ''
          }`}
        >
          <span className="lpo-ps-knesset-tooltip-detail-label">{row.label}:</span>
          <span className="lpo-ps-knesset-tooltip-detail-value">{row.value}</span>
        </p>
      ))}
    </div>
  )
}

function KnessetSeatTooltip({
  tooltip,
  locale,
  t,
  displayParty,
  rankLabel,
  segLabel,
}: {
  tooltip: TooltipState
  locale: AppLocale
  t: UiStrings
  displayParty: (partyKey: string) => string
  rankLabel: (seat: KnessetFilledSeat) => string
  segLabel: (segment: Segment) => string
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
      ref={tooltipRef}
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
            <img
              className="lpo-ps-knesset-tooltip-portrait"
              src={tooltip.seat.member.portraitImageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
            />
          ) : null}
          {member ? (
            <MemberTooltipDetails
              member={member}
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

  dialog.style.removeProperty('--lpo-ps-knesset-swing-wing-seg-width')

  if (!barTrack || !partySwing) return false

  const dialogRect = dialog.getBoundingClientRect()
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
    ? mapStage.getBoundingClientRect().top - dialogRect.top
    : null

  // Sit a bit lower over the bloc bar, but never overlap the hemicycle stage.
  const mapClearancePx = 8
  const extraDropPx = 34
  let top =
    trackRect.top -
    dialogRect.top -
    stackH +
    Math.round(trackRect.height * 0.1) +
    extraDropPx
  if (mapStageTop != null) {
    const maxTop = mapStageTop - stackH - mapClearancePx
    top = Math.min(top, maxTop)
  }

  dialog.style.setProperty('--lpo-ps-knesset-swing-fixed-top', `${top}px`)

  const anchorW =
    swingAnchor?.getBoundingClientRect().width ??
    Math.min(dialogRect.width * 0.34, 7.35 * 16)

  if (partySwing.side === 'right') {
    const coalSeg = dialog.querySelector(
      '.lpo-ps-hero-chart-bloc-bar .lpo-ps-seg--coal',
    ) as HTMLElement | null
    if (!coalSeg) return false
    const segRect = coalSeg.getBoundingClientRect()
    dialog.style.setProperty('--lpo-ps-knesset-swing-wing-seg-width', `${segRect.width}px`)
    const centerX = segRect.left + segRect.width * 0.68
    const right = dialogRect.right - (centerX + anchorW / 2)
    dialog.style.setProperty('--lpo-ps-knesset-swing-fixed-right', `${Math.max(4, right)}px`)
    dialog.style.removeProperty('--lpo-ps-knesset-swing-fixed-left')
  } else {
    const oppSeg = dialog.querySelector(
      '.lpo-ps-hero-chart-bloc-bar .lpo-ps-seg--opp',
    ) as HTMLElement | null
    if (!oppSeg) return false
    const segRect = oppSeg.getBoundingClientRect()
    dialog.style.setProperty('--lpo-ps-knesset-swing-wing-seg-width', `${segRect.width}px`)
    const centerX = segRect.left + segRect.width * 0.32
    const left = centerX - anchorW / 2 - dialogRect.left
    dialog.style.setProperty('--lpo-ps-knesset-swing-fixed-left', `${Math.max(4, left)}px`)
    dialog.style.removeProperty('--lpo-ps-knesset-swing-fixed-right')
  }

  return true
}

function SwingSeatPortrait({
  seat,
  locale,
  displayParty,
  onPointerEnter,
  onLeave,
  onMove,
}: {
  seat: KnessetFilledSeat
  locale: AppLocale
  displayParty: (partyKey: string) => string
  onPointerEnter: (e: React.MouseEvent<HTMLButtonElement>) => void
  onLeave: () => void
  onMove: (e: React.MouseEvent<HTMLButtonElement>) => void
}) {
  const isMember = seat.kind === 'member'
  const isPlaceholder = seat.kind === 'placeholder'
  const ring = seat.ringColor
  const partyIcon = PARTY_ICON_MAP[seat.partyKey]

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
      onBlur={onLeave}
      onMouseMove={onMove}
      aria-label={
        isMember ? memberTooltipName(seat.member, locale) : displayParty(seat.partyKey)
      }
    >
      {isMember && seat.member.imageUrl ? (
        <img
          className="lpo-ps-knesset-seat-img"
          src={seat.member.imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
        />
      ) : (
        <>
          {partyIcon ? (
            <img
              className="lpo-ps-knesset-seat-party-icon"
              src={partyIcon}
              alt=""
              loading="lazy"
              decoding="async"
            />
          ) : null}
          <span className="lpo-ps-knesset-seat-empty-portrait" aria-hidden />
        </>
      )}
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
}: {
  swing: NonNullable<ReturnType<typeof computePartySwingSeats>>
  locale: AppLocale
  t: UiStrings
  displayParty: (partyKey: string) => string
  onPointerEnter: (e: React.MouseEvent<HTMLButtonElement>, seat: KnessetFilledSeat) => void
  onLeave: () => void
  onMove: (e: React.MouseEvent<HTMLButtonElement>, seat: KnessetFilledSeat) => void
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
  dimmed,
  locale,
  displayParty,
  onPointerEnter,
  onLeave,
  onMove,
}: {
  seat: KnessetFilledSeat
  dimmed: boolean
  locale: AppLocale
  displayParty: (partyKey: string) => string
  onPointerEnter: (e: React.MouseEvent<HTMLButtonElement>) => void
  onLeave: () => void
  onMove: (e: React.MouseEvent<HTMLButtonElement>) => void
}) {
  const isMember = seat.kind === 'member'
  const isPlaceholder = seat.kind === 'placeholder'
  const ring = seat.ringColor
  const partyIcon = PARTY_ICON_MAP[seat.partyKey]

  return (
    <button
      type="button"
      className={`lpo-ps-knesset-seat${
        isPlaceholder ? ' lpo-ps-knesset-seat--placeholder' : ''
      }${dimmed ? ' lpo-ps-knesset-seat--dimmed' : ''}`}
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
      onBlur={onLeave}
      onMouseMove={onMove}
      aria-label={
        isMember ? memberTooltipName(seat.member, locale) : displayParty(seat.partyKey)
      }
    >
      {isMember && seat.member.imageUrl ? (
        <img
          className="lpo-ps-knesset-seat-img"
          src={seat.member.imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
        />
      ) : (
        <>
          {partyIcon ? (
            <img
              className="lpo-ps-knesset-seat-party-icon"
              src={partyIcon}
              alt=""
              loading="lazy"
              decoding="async"
            />
          ) : null}
          <span className="lpo-ps-knesset-seat-empty-portrait" aria-hidden />
        </>
      )}
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
  const statsRowRef = useRef<HTMLDivElement>(null)
  const [members, setMembers] = useState<KnessetMemberRow[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchKnessetMembers()
      .then((rows) => {
        if (!cancelled) setMembers(rows)
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

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

    const updateSwingLayout = () => {
      const isMobileLayout = window.matchMedia(HERO_CHART_COMPACT_MQ).matches
      // Desktop: portal to the overlay and use fixed viewport coords so the stack is never
      // clipped by scale-shell / dialog overflow when sitting above the filter row.
      const portalTarget = isMobileLayout ? (dialog ?? wrap) : (overlay ?? dialog ?? wrap)
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
        portalTarget.style.removeProperty('--lpo-ps-knesset-swing-anchor-top')
        wrap.style.removeProperty('--lpo-ps-knesset-swing-stack-gap')

        positionMobileSwingOverBlocBar(dialog, portalTarget, partySwing, faceSize)
        return
      }

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

  const updateTooltipPos = (e: React.MouseEvent<HTMLButtonElement>, seat: KnessetFilledSeat) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = rect.width > 0 ? rect.left + rect.width / 2 : e.clientX
    const y = rect.height > 0 ? rect.top + rect.height / 2 : e.clientY
    setTooltip({
      seat,
      x,
      y,
      placement: tooltipPlacement(y),
    })
  }

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
            ref={statsRowRef}
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
                  dimmed={!seatMatchesFilters(seat, activeFilters, mergeArabsWithOpposition)}
                  locale={locale}
                  displayParty={displayParty}
                  onPointerEnter={(e) => updateTooltipPos(e, seat)}
                  onLeave={() => setTooltip(null)}
                  onMove={(e) => updateTooltipPos(e, seat)}
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
                  onPointerEnter={(e, seat) => updateTooltipPos(e, seat)}
                  onLeave={() => setTooltip(null)}
                  onMove={(e, seat) => updateTooltipPos(e, seat)}
                />,
                swingPortalEl,
              )
            : null}
          {tooltip
            ? createPortal(
                <KnessetSeatTooltip
                  key={tooltip.seat.slot.id}
                  tooltip={tooltip}
                  locale={locale}
                  t={t}
                  displayParty={displayParty}
                  rankLabel={rankLabel}
                  segLabel={segLabel}
                />,
                document.body,
              )
            : null}
          {showStats ? <RotatePortraitHint locale={locale} statsRowRef={statsRowRef} /> : null}
        </>
      )}
    </div>
  )
}

