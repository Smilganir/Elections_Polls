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
  className?: string
}) {
  return (
    <div className={`lpo-ps-hero-bar-stack lpo-ps-bar-ltr ${className}`.trim()}>
      <div className="lpo-ps-blocs-nums-band">
        <div className="lpo-ps-hero-nums-between" dir="ltr">
          <div className="lpo-ps-hero-side lpo-ps-hero-side--opp">
            <span className="lpo-ps-hero-lbl lpo-ps-hero-lbl--opp">{t.opposition}</span>
            <span className="lpo-ps-hero-num lpo-ps-hero-num--opp">
              {combineArabsWithOpposition ? avgOppositionPlusArabs : avgOpposition}
            </span>
            {hasPrior ? (
              <DeltaBadge
                delta={
                  combineArabsWithOpposition ? deltaOppositionPlusArabs : deltaOpposition
                }
              />
            ) : null}
          </div>
          <div className="lpo-ps-hero-side lpo-ps-hero-side--coal">
            <span className="lpo-ps-hero-lbl lpo-ps-hero-lbl--coal">{t.coalition}</span>
            <span className="lpo-ps-hero-num lpo-ps-hero-num--coal">{avgCoalition}</span>
            {hasPrior ? <DeltaBadge delta={deltaCoalition} /> : null}
          </div>
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
