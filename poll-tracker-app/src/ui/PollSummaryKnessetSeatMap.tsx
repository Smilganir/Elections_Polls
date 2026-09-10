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
): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = []
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
    <dl className="lpo-ps-knesset-tooltip-details">
      {detailRows.map((row) => (
        <div key={row.label} className="lpo-ps-knesset-tooltip-detail-row">
          <dt className="lpo-ps-knesset-tooltip-detail-label">{row.label}</dt>
          <dd className="lpo-ps-knesset-tooltip-detail-value">{row.value}</dd>
        </div>
      ))}
    </dl>
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

  return (
    <div
      className={`lpo-ps-knesset-tooltip lpo-ps-knesset-tooltip--${tooltip.placement}${
        locale === 'he' ? ' lpo-ps-knesset-tooltip--rtl' : ' lpo-ps-knesset-tooltip--ltr'
      }`}
      style={{ left: tooltip.x, top: tooltip.y }}
      dir={locale === 'he' ? 'rtl' : 'ltr'}
      role="tooltip"
    >
      <div className="lpo-ps-knesset-tooltip-header">
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
  )
}

function tooltipPlacement(clientY: number): TooltipPlacement {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(
    '--lpo-ps-hero-chart-overlay-top',
  )
  const overlayTop = Number.parseFloat(raw) || 88
  return clientY < overlayTop + 100 ? 'below' : 'above'
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
        <div className="lpo-ps-knesset-swing-header">
          <p className="lpo-ps-knesset-swing-title">{t.knessetMapSwingTitle}</p>
          <div className="lpo-ps-knesset-swing-labels-row">
            {showOut ? (
              <p className="lpo-ps-knesset-swing-group-label">{t.knessetMapSwingOutLabel}</p>
            ) : null}
            {showOut && showIn ? <div className="lpo-ps-knesset-swing-divider" aria-hidden /> : null}
            {showIn ? (
              <p className="lpo-ps-knesset-swing-group-label">{t.knessetMapSwingInLabel}</p>
            ) : null}
          </div>
        </div>
        <div className="lpo-ps-knesset-swing-portraits-row">
          <div className="lpo-ps-knesset-swing-groups">
            {showOut ? (
              <div className="lpo-ps-knesset-swing-group" aria-label={t.knessetMapSwingOutAria}>
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

    const updateSwingLayout = () => {
      const isMobileLayout = window.matchMedia(HERO_CHART_COMPACT_MQ).matches
      const portalTarget = isMobileLayout && dialog ? dialog : wrap
      const wrapRect = wrap.getBoundingClientRect()
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
      const faceSize = Math.round(Math.max(22, Math.min(40, stageWidth * 0.0355 * 1.55)))

      portalTarget.style.setProperty('--lpo-ps-knesset-swing-face-size', `${faceSize}px`)

      if (isMobileLayout && dialog) {
        const dialogRect = dialog.getBoundingClientRect()
        const panelHeight = faceSize + 36
        const top = stageRect.top - dialogRect.top - panelHeight - 4
        const inset = Math.max(6, dialogRect.width * 0.015)

        dialog.style.setProperty('--lpo-ps-knesset-swing-fixed-top', `${top}px`)
        dialog.style.setProperty('--lpo-ps-knesset-swing-fixed-left', `${inset}px`)
        dialog.style.setProperty('--lpo-ps-knesset-swing-fixed-right', `${inset}px`)
        return
      }

      wrap.style.setProperty('--lpo-ps-knesset-swing-stage-top', `${stageTop}px`)

      const portraitTop = stageTop + stageRect.height * 0.045
      wrap.style.setProperty('--lpo-ps-knesset-swing-portraits-top', `${portraitTop}px`)
      if (resetBtn) {
        const labelTop = resetBtn.getBoundingClientRect().top - wrapRect.top
        wrap.style.setProperty('--lpo-ps-knesset-swing-top', `${labelTop}px`)
      }
    }

    updateSwingLayout()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateSwingLayout) : null
    ro?.observe(wrap)
    if (dialog) ro?.observe(dialog)
    window.addEventListener('resize', updateSwingLayout)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', updateSwingLayout)
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

  const updateTooltipPos = (e: React.MouseEvent, seat: KnessetFilledSeat) => {
    setTooltip({
      seat,
      x: e.clientX,
      y: e.clientY,
      placement: tooltipPlacement(e.clientY),
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
        </>
      )}
    </div>
  )
}

