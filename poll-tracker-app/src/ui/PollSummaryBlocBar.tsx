import type { UiStrings } from '../i18n/strings'

const KNESSET = 120
const MAJ_SEATS = 60

export function PsSegmentBar({
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
          <div className="lpo-ps-seg lpo-ps-seg--opp" style={{ flex: `0 0 ${wo}%` }} />
          {!mergeArabsWithOpposition && a > 0 ? (
            <div className="lpo-ps-seg lpo-ps-seg--arabs" style={{ flex: `0 0 ${wa}%` }} />
          ) : null}
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

export function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) return null
  const up = delta > 0
  return (
    <span className={`lpo-ps-delta ${up ? 'up' : 'down'}`}>
      {up ? '+' : '-'}
      {Math.abs(delta)}
    </span>
  )
}

function BlocSide({
  segment,
  label,
  value,
  delta,
  hasPrior,
  focused,
  onToggle,
}: {
  segment: 'Coalition' | 'Opposition'
  label: string
  value: number
  delta: number
  hasPrior: boolean
  focused: boolean
  onToggle?: (segment: 'Coalition' | 'Opposition') => void
}) {
  const sideClass =
    segment === 'Coalition' ? 'lpo-ps-hero-side--coal' : 'lpo-ps-hero-side--opp'
  const lblClass =
    segment === 'Coalition' ? 'lpo-ps-hero-lbl--coal' : 'lpo-ps-hero-lbl--opp'
  const numClass =
    segment === 'Coalition' ? 'lpo-ps-hero-num--coal' : 'lpo-ps-hero-num--opp'

  if (!onToggle) {
    return (
      <div className={`lpo-ps-hero-side ${sideClass}`}>
        <span className={`lpo-ps-hero-lbl ${lblClass}`}>{label}</span>
        <span className={`lpo-ps-hero-num ${numClass}`}>{value}</span>
        {hasPrior ? <DeltaBadge delta={delta} /> : null}
      </div>
    )
  }

  return (
    <button
      type="button"
      className={`lpo-ps-hero-side lpo-ps-hero-side--selectable ${sideClass}${
        focused ? ' lpo-ps-hero-side--focused' : ''
      }`}
      aria-pressed={focused}
      onClick={() => onToggle(segment)}
    >
      <span className={`lpo-ps-hero-lbl ${lblClass}`}>{label}</span>
      <span className={`lpo-ps-hero-num ${numClass}`}>{value}</span>
      {hasPrior ? <DeltaBadge delta={delta} /> : null}
    </button>
  )
}

export function PollSummaryHeroBlocBar({
  t,
  combineArabsWithOpposition,
  hasPrior,
  avgCoalition,
  avgOpposition,
  avgArabs,
  avgOppositionPlusArabs,
  deltaCoalition,
  deltaOpposition,
  deltaOppositionPlusArabs,
  focusedSegment,
  onToggleSegmentFocus,
  className = '',
}: {
  t: UiStrings
  combineArabsWithOpposition: boolean
  hasPrior: boolean
  avgCoalition: number
  avgOpposition: number
  avgArabs: number
  avgOppositionPlusArabs: number
  deltaCoalition: number
  deltaOpposition: number
  deltaOppositionPlusArabs: number
  focusedSegment?: 'Coalition' | 'Opposition' | null
  onToggleSegmentFocus?: (segment: 'Coalition' | 'Opposition') => void
  className?: string
}) {
  return (
    <div className={`lpo-ps-hero-bar-stack lpo-ps-bar-ltr ${className}`.trim()}>
      <div className="lpo-ps-blocs-nums-band">
        <div className="lpo-ps-hero-nums-between" dir="ltr">
          <BlocSide
            segment="Opposition"
            label={t.opposition}
            value={combineArabsWithOpposition ? avgOppositionPlusArabs : avgOpposition}
            delta={combineArabsWithOpposition ? deltaOppositionPlusArabs : deltaOpposition}
            hasPrior={hasPrior}
            focused={focusedSegment === 'Opposition'}
            onToggle={onToggleSegmentFocus}
          />
          <BlocSide
            segment="Coalition"
            label={t.coalition}
            value={avgCoalition}
            delta={deltaCoalition}
            hasPrior={hasPrior}
            focused={focusedSegment === 'Coalition'}
            onToggle={onToggleSegmentFocus}
          />
        </div>
        <span className="lpo-ps-maj-label-fly lpo-ps-maj-label-fly--12" aria-hidden>
          60
        </span>
      </div>
      <PsSegmentBar
        coalition={avgCoalition}
        opposition={avgOpposition}
        arabs={avgArabs}
        mergeArabsWithOpposition={combineArabsWithOpposition}
        showMajLine
        mini={false}
        className="lpo-ps-hero-bar"
      />
    </div>
  )
}
