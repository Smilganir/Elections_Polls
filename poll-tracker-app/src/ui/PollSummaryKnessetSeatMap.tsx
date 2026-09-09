import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
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
import type { Segment } from '../types/data'

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
): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = []
  if (member.age.trim()) rows.push({ label: t.knessetMapTooltipAge, value: member.age.trim() })
  const gender = genderLabel(member.gender, locale, t)
  if (gender) rows.push({ label: t.knessetMapTooltipGender, value: gender })
  const knessetYears = knessetYearsLabel(member.knessetYears, t)
  if (knessetYears) {
    rows.push({ label: t.knessetMapTooltipKnessetYears, value: knessetYears })
  }
  if (member.professionalExperience.trim()) {
    rows.push({
      label: t.knessetMapTooltipProfessional,
      value: member.professionalExperience.trim(),
    })
  }
  if (member.militaryService.trim()) {
    rows.push({ label: t.knessetMapTooltipMilitary, value: member.militaryService.trim() })
  }
  if (member.education.trim()) {
    rows.push({ label: t.knessetMapTooltipEducation, value: member.education.trim() })
  }
  return rows
}

function MemberTooltipDetails({
  member,
  locale,
  t,
}: {
  member: KnessetMemberRow
  locale: AppLocale
  t: UiStrings
}) {
  const detailRows = memberTooltipDetailRows(member, locale, t)
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

function tooltipPlacement(clientY: number): TooltipPlacement {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(
    '--lpo-ps-hero-chart-overlay-top',
  )
  const overlayTop = Number.parseFloat(raw) || 88
  return clientY < overlayTop + 100 ? 'below' : 'above'
}

function SeatPortrait({
  seat,
  dimmed,
  onPointerEnter,
  onLeave,
  onMove,
}: {
  seat: KnessetFilledSeat
  dimmed: boolean
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
      aria-label={isMember ? seat.member.name : seat.partyKey}
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
  focusedPartyKey,
  stageOverlay,
}: {
  poll: RollingPoll
  displayParty: (partyKey: string) => string
  locale: AppLocale
  t: UiStrings
  focusedPartyKey?: string | null
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

  return (
    <div
      ref={wrapRef}
      className={`lpo-ps-knesset-map${focusedPartyKey ? ' lpo-ps-knesset-map--party-focus' : ''}`}
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
            className="lpo-ps-knesset-map-stage"
            style={knessetHollowInsetStyle() as CSSProperties}
            aria-hidden
          >
            {seats.map((seat) => (
              <SeatPortrait
                key={seat.slot.id}
                seat={seat}
                dimmed={Boolean(focusedPartyKey && seat.partyKey !== focusedPartyKey)}
                onPointerEnter={(e) => updateTooltipPos(e, seat)}
                onLeave={() => setTooltip(null)}
                onMove={(e) => updateTooltipPos(e, seat)}
              />
            ))}
            {stageOverlay}
          </div>
          {tooltip
            ? createPortal(
                <div
                  className={`lpo-ps-knesset-tooltip lpo-ps-knesset-tooltip--${tooltip.placement}`}
                  style={{ left: tooltip.x, top: tooltip.y }}
                  dir="rtl"
                  role="tooltip"
                >
                  <div className="lpo-ps-knesset-tooltip-header">
                    <div className="lpo-ps-knesset-tooltip-header-text">
                      {tooltip.seat.kind === 'member' ? (
                        <p className="lpo-ps-knesset-tooltip-name">{tooltip.seat.member.name}</p>
                      ) : (
                        <p className="lpo-ps-knesset-tooltip-name">
                          {displayParty(tooltip.seat.partyKey)}
                        </p>
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
                            color:
                              PARTY_COLOR_MAP[tooltip.seat.partyKey] ?? tooltip.seat.ringColor,
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
                  </div>
                  {tooltip.seat.kind === 'member' ? (
                    <MemberTooltipDetails
                      member={tooltip.seat.member}
                      locale={locale}
                      t={t}
                    />
                  ) : null}
                </div>,
                document.body,
              )
            : null}
        </>
      )}
    </div>
  )
}

