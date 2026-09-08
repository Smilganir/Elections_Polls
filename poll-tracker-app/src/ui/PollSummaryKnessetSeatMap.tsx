import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { AppLocale } from '../i18n/localeContext'
import type { UiStrings } from '../i18n/strings'
import { buildKnessetFilledSeats, type KnessetFilledSeat } from '../lib/knessetSeatAllocation'
import {
  fetchKnessetMembers,
  membersByPartyKey,
  segmentLabel,
  type KnessetMemberRow,
} from '../lib/knessetMembersSheet'
import type { RollingPoll } from '../lib/pollRollingWindow'
import { knessetHollowInsetStyle } from '../lib/knessetHollowInsets'
import type { Segment } from '../types/data'

type TooltipState = {
  seat: KnessetFilledSeat
  x: number
  y: number
}

function SeniorityBadge({
  seniority,
  title,
}: {
  seniority: KnessetMemberRow['seniority']
  title: string
}) {
  if (seniority === 'unknown') return null
  const glyph = seniority === 'veteran' ? '★' : '✦'
  return (
    <span className="lpo-ps-knesset-seat-seniority" title={title} aria-hidden>
      {glyph}
    </span>
  )
}

function SeatPortrait({
  seat,
  onPointerEnter,
  onLeave,
  onMove,
}: {
  seat: KnessetFilledSeat
  onPointerEnter: (e: React.MouseEvent<HTMLButtonElement>) => void
  onLeave: () => void
  onMove: (e: React.MouseEvent<HTMLButtonElement>) => void
}) {
  const isMember = seat.kind === 'member'
  const ring = seat.ringColor

  return (
    <button
      type="button"
      className={`lpo-ps-knesset-seat${isMember ? '' : ' lpo-ps-knesset-seat--empty'}`}
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
      aria-label={isMember ? seat.member.name : undefined}
    >
      {isMember ? (
        <>
          <img
            className="lpo-ps-knesset-seat-img"
            src={seat.member.imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
          />
          {seat.member.listRank === 1 ? (
            <SeniorityBadge
              seniority={seat.member.seniority}
              title={seat.member.seniority === 'veteran' ? 'veteran' : 'new'}
            />
          ) : null}
        </>
      ) : (
        <span className="lpo-ps-knesset-seat-empty-dot" aria-hidden />
      )}
    </button>
  )
}

export function PollSummaryKnessetSeatMap({
  poll,
  displayParty,
  locale,
  t,
  stageOverlay,
}: {
  poll: RollingPoll
  displayParty: (partyKey: string) => string
  locale: AppLocale
  t: UiStrings
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
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return
    setTooltip({
      seat,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }

  const segLabel = (segment: Segment) =>
    segmentLabel(segment, {
      knessetMapCoalition: t.knessetMapCoalition,
      knessetMapOpposition: t.knessetMapOpposition,
      knessetMapArabs: t.knessetMapArabs,
    })

  const seniorityLabel = (s: KnessetMemberRow['seniority']) => {
    if (s === 'veteran') return t.knessetMapSeniorityVeteran
    if (s === 'new') return t.knessetMapSeniorityNew
    return ''
  }

  return (
    <div
      ref={wrapRef}
      className="lpo-ps-knesset-map"
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
                onPointerEnter={(e) => updateTooltipPos(e, seat)}
                onLeave={() => setTooltip(null)}
                onMove={(e) => updateTooltipPos(e, seat)}
              />
            ))}
            {stageOverlay}
            <span className="lpo-ps-knesset-map-total">120</span>
          </div>
          {tooltip && tooltip.seat.kind === 'member' ? (
            <div
              className="lpo-ps-knesset-tooltip"
              style={{ left: tooltip.x, top: tooltip.y }}
              role="tooltip"
            >
              <p className="lpo-ps-knesset-tooltip-name">{tooltip.seat.member.name}</p>
              <p className="lpo-ps-knesset-tooltip-meta">
                <span className="lpo-ps-knesset-tooltip-segment">
                  {segLabel(tooltip.seat.segment)}
                </span>
                <span className="lpo-ps-knesset-tooltip-party">
                  {displayParty(tooltip.seat.partyKey)}
                </span>
              </p>
              {tooltip.seat.member.seniority !== 'unknown' ? (
                <p className="lpo-ps-knesset-tooltip-seniority">
                  <SeniorityBadge
                    seniority={tooltip.seat.member.seniority}
                    title={seniorityLabel(tooltip.seat.member.seniority)}
                  />
                  {seniorityLabel(tooltip.seat.member.seniority)}
                </p>
              ) : null}
              {tooltip.seat.member.background ? (
                <p className="lpo-ps-knesset-tooltip-bg">{tooltip.seat.member.background}</p>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
