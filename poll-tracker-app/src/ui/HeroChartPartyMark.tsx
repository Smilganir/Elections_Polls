import type { CSSProperties } from 'react'
import { listLogoForParty } from '../config/mappings'
import { IconWithFallback } from './IconWithFallback'

export function HeroChartPartyMark({
  partyKey,
  label,
  color,
}: {
  partyKey: string
  label: string
  color: string
}) {
  const src = listLogoForParty(partyKey)

  return (
    <div
      className={`lpo-ps-hero-chart-party-mark${
        partyKey === 'The Democrats' ? ' lpo-ps-hero-chart-party-mark--enlarged' : ''
      }`}
      style={{ '--lpo-ps-party-mark-color': color } as CSSProperties}
    >
      <IconWithFallback src={src} label={label} />
      <span className="lpo-ps-hero-chart-party-dash" aria-hidden />
    </div>
  )
}
