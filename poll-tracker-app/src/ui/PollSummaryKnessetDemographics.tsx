import { useMemo } from 'react'
import type { UiStrings } from '../i18n/strings'
import type { KnessetFilledSeat } from '../lib/knessetSeatAllocation'
import type {
  AgeBinId,
  EducationBucket,
  KnessetDemographics,
  KnessetMapFilters,
  KnessetMapFocusItem,
  KnessetYearsBinId,
  MilitaryServiceBucket,
} from '../lib/knessetSeatDemographics'
import {
  chartStatsExcludingKind,
  filterSeatsByFilters,
  filtersInclude,
  formatDemographicMean,
  formatPctLabel,
  knessetYearsBinLabel,
  militaryServedPctOfAll,
  summarizeProjectedKnesset,
} from '../lib/knessetSeatDemographics'
import {
  formatKnessetPpDelta,
  formatKnessetScalarPctDelta,
  knessetScalarPctDelta,
  knessetSharePpDelta,
  resolveKnesset25Baseline,
  type Knesset25BaselineScope,
} from '../lib/knesset25DemographicsBaseline'

function statsCaptionAria(
  label: string,
  mean: number | null | undefined,
  t: UiStrings,
): string {
  if (mean == null) return label
  return t.knessetStatsCaptionWithMean
    .replace(/\{label\}/g, label)
    .replace(/\{value\}/g, formatDemographicMean(mean))
}

function k25ScopeLabel(scope: Knesset25BaselineScope, t: UiStrings): string {
  if (scope === 'party') return t.knessetStatsVsK25Party
  if (scope === 'bloc') return t.knessetStatsVsK25Bloc
  return t.knessetStatsVsK25
}

function K25ComparisonBadge({
  delta,
  mode,
  scope,
  t,
}: {
  delta: number | null | undefined
  mode: 'pp' | 'pct'
  scope: Knesset25BaselineScope
  t: UiStrings
}) {
  if (delta == null || !Number.isFinite(delta) || Math.abs(delta) < 0.05) return null
  const up = delta > 0
  const dir = up ? 'up' : 'down'
  const value =
    mode === 'pp' ? formatKnessetPpDelta(delta) : formatKnessetScalarPctDelta(delta)

  return (
    <div className="lpo-ps-knesset-stat-k25" dir="ltr">
      <span className={`lpo-change-badge lpo-ps-knesset-stat-k25-badge ${dir}`}>
        <span className="lpo-ps-knesset-stat-k25-arrow" aria-hidden="true">
          {up ? '↗' : '↘'}
        </span>
        {value}
      </span>
      <span className="lpo-ps-knesset-stat-k25-label">{k25ScopeLabel(scope, t)}</span>
    </div>
  )
}

function DemographicStatsCaption({
  label,
  mean,
  k25DeltaPct,
  k25Scope,
  t,
}: {
  label: string
  mean: number | null | undefined
  k25DeltaPct?: number | null
  k25Scope?: Knesset25BaselineScope | null
  t: UiStrings
}) {
  return (
    <header className="lpo-ps-knesset-stat-heading">
      <figcaption className="lpo-ps-knesset-stats-caption" dir={mean != null ? 'ltr' : undefined}>
        {mean != null ? (
          <>
            <span className="lpo-ps-knesset-stats-caption-mean">
              {formatDemographicMean(mean)}
            </span>
            <span className="lpo-ps-knesset-stats-caption-sep" aria-hidden="true">
              · {t.knessetStatsMeanWord}
            </span>
          </>
        ) : null}
        <span className="lpo-ps-knesset-stats-caption-label">{label}</span>
      </figcaption>
      {k25Scope ? (
        <K25ComparisonBadge delta={k25DeltaPct} mode="pct" scope={k25Scope} t={t} />
      ) : null}
    </header>
  )
}

function chartDemographics(
  seats: readonly KnessetFilledSeat[],
  mapFilters: KnessetMapFilters,
  mergeArabsWithOpposition: boolean,
  excludeKind: KnessetMapFocusItem['kind'],
): KnessetDemographics {
  const filtered = filterSeatsByFilters(
    seats,
    chartStatsExcludingKind(mapFilters, excludeKind),
    mergeArabsWithOpposition,
  )
  return summarizeProjectedKnesset(filtered)
}

const DONUT_SIZE = 72
const DONUT_STROKE = 8.5

type ChartFocusProps = {
  mapFilters: KnessetMapFilters
  onToggleFocus: (next: KnessetMapFocusItem) => void
}

function Doughnut({
  portion,
  label,
  aria,
  k25DeltaPp,
  k25Scope,
  t,
  primaryFocus,
  complementFocus,
  mapFilters,
  onToggleFocus,
  layoutSlot,
}: {
  portion: number
  label: string
  aria: string
  k25DeltaPp?: number | null
  k25Scope?: Knesset25BaselineScope | null
  t: UiStrings
  primaryFocus: KnessetMapFocusItem
  complementFocus: KnessetMapFocusItem
  mapFilters: KnessetMapFilters
  onToggleFocus: (next: KnessetMapFocusItem) => void
  layoutSlot?: string
}) {
  const r = (DONUT_SIZE - DONUT_STROKE) / 2
  const c = 2 * Math.PI * r
  const dash = Math.max(0, Math.min(1, portion)) * c
  const cx = DONUT_SIZE / 2
  const cy = DONUT_SIZE / 2
  const primaryActive = filtersInclude(mapFilters, primaryFocus)
  const complementActive = filtersInclude(mapFilters, complementFocus)
  const centerShowsComplement = complementActive
  const centerFocus = centerShowsComplement ? complementFocus : primaryFocus
  const centerActive = centerShowsComplement ? complementActive : primaryActive
  const centerPct = centerShowsComplement ? Math.max(0, 1 - portion) : portion

  return (
    <figure className={`lpo-ps-knesset-donut-fig${layoutSlot ? ` ${layoutSlot}` : ''}`}>
      <header className="lpo-ps-knesset-stat-heading">
        <figcaption className="lpo-ps-knesset-stats-caption">{label}</figcaption>
        {k25Scope ? (
          <K25ComparisonBadge delta={k25DeltaPp} mode="pp" scope={k25Scope} t={t} />
        ) : null}
      </header>
      <div className="lpo-ps-knesset-donut" role="group" aria-label={aria}>
        <svg
          className="lpo-ps-knesset-donut-svg"
          width={DONUT_SIZE}
          height={DONUT_SIZE}
          viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}
          aria-hidden
        >
          <circle
            className="lpo-ps-knesset-donut-track"
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            strokeWidth={DONUT_STROKE}
          />
          <circle
            className={`lpo-ps-knesset-donut-fill${primaryActive ? ' lpo-ps-knesset-donut-fill--active' : ''}`}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            strokeWidth={DONUT_STROKE}
            strokeLinecap="butt"
            strokeDasharray={`${dash} ${c - dash}`}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
          <circle
            className={`lpo-ps-knesset-donut-hit${primaryActive ? ' lpo-ps-knesset-donut-hit--active' : ''}`}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="transparent"
            strokeWidth={DONUT_STROKE + 12}
            strokeDasharray={`${dash} ${c - dash}`}
            transform={`rotate(-90 ${cx} ${cy})`}
            onClick={() => onToggleFocus(primaryFocus)}
          />
          <circle
            className={`lpo-ps-knesset-donut-hit lpo-ps-knesset-donut-hit--complement${
              complementActive ? ' lpo-ps-knesset-donut-hit--active' : ''
            }`}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="transparent"
            strokeWidth={DONUT_STROKE + 12}
            strokeDasharray={`${c - dash} ${dash}`}
            strokeDashoffset={-dash}
            transform={`rotate(-90 ${cx} ${cy})`}
            onClick={() => onToggleFocus(complementFocus)}
          />
        </svg>
        <button
          type="button"
          className={`lpo-ps-knesset-donut-pct lpo-ps-knesset-stat-hit${
            centerActive ? ' lpo-ps-knesset-stat-hit--active' : ''
          }`}
          dir="ltr"
          aria-pressed={centerActive}
          title={label}
          onClick={() => onToggleFocus(centerFocus)}
        >
          {formatPctLabel(centerPct)}
        </button>
      </div>
    </figure>
  )
}

function ageTick(id: string): string {
  if (id === '80') return '80+'
  const start = Number(id)
  return `${start}–${start + 10}`
}

function AgeHistogram({
  bins,
  title,
  avgValue,
  k25DeltaPct,
  k25Scope,
  t,
  mapFilters,
  onToggleFocus,
  layoutSlot,
}: {
  bins: KnessetDemographics['ageBins']
  title: string
  avgValue: number | null
  k25DeltaPct: number | null
  k25Scope: Knesset25BaselineScope | null
  t: UiStrings
  mapFilters: KnessetMapFilters
  onToggleFocus: (next: KnessetMapFocusItem) => void
  layoutSlot?: string
}) {
  return (
    <DemographicHistogram
      bins={bins}
      label={title}
      avgValue={avgValue}
      k25DeltaPct={k25DeltaPct}
      k25Scope={k25Scope}
      t={t}
      mapFilters={mapFilters}
      onToggleFocus={onToggleFocus}
      focusKind="age"
      tickLabel={ageTick}
      layoutSlot={layoutSlot}
    />
  )
}

function KnessetYearsHistogram({
  bins,
  title,
  avgValue,
  k25DeltaPct,
  k25Scope,
  t,
  mapFilters,
  onToggleFocus,
  layoutSlot,
}: {
  bins: KnessetDemographics['knessetYearsBins']
  title: string
  avgValue: number | null
  k25DeltaPct: number | null
  k25Scope: Knesset25BaselineScope | null
  t: UiStrings
  mapFilters: KnessetMapFilters
  onToggleFocus: (next: KnessetMapFocusItem) => void
  layoutSlot?: string
}) {
  return (
    <DemographicHistogram
      bins={bins}
      label={title}
      avgValue={avgValue}
      k25DeltaPct={k25DeltaPct}
      k25Scope={k25Scope}
      t={t}
      mapFilters={mapFilters}
      onToggleFocus={onToggleFocus}
      focusKind="knessetYears"
      tickLabel={knessetYearsBinLabel}
      layoutSlot={layoutSlot}
    />
  )
}

function DemographicHistogram({
  bins,
  label,
  avgValue,
  k25DeltaPct,
  k25Scope,
  t,
  mapFilters,
  onToggleFocus,
  focusKind,
  tickLabel,
  layoutSlot,
}: {
  bins: readonly { id: string; count: number }[]
  label: string
  avgValue: number | null
  k25DeltaPct: number | null
  k25Scope: Knesset25BaselineScope | null
  t: UiStrings
  mapFilters: KnessetMapFilters
  onToggleFocus: (next: KnessetMapFocusItem) => void
  focusKind: 'age' | 'knessetYears'
  tickLabel: (id: string) => string
  layoutSlot?: string
}) {
  const max = Math.max(1, ...bins.map((b) => b.count))
  const total = bins.reduce((s, b) => s + b.count, 0)
  if (total <= 0) return null
  const aria = statsCaptionAria(label, avgValue, t)

  return (
    <figure className={`lpo-ps-knesset-age-fig${layoutSlot ? ` ${layoutSlot}` : ''}`}>
      <DemographicStatsCaption
        label={label}
        mean={avgValue}
        k25DeltaPct={k25DeltaPct}
        k25Scope={k25Scope}
        t={t}
      />
      <div className="lpo-ps-knesset-age-plot" dir="ltr" role="group" aria-label={aria}>
        {bins.map((bin) => {
          const focus: KnessetMapFocusItem =
            focusKind === 'age'
              ? { kind: 'age', value: bin.id as AgeBinId }
              : { kind: 'knessetYears', value: bin.id as KnessetYearsBinId }
          const active = filtersInclude(mapFilters, focus)
          return (
            <button
              key={bin.id}
              type="button"
              className={`lpo-ps-knesset-age-col lpo-ps-knesset-stat-hit${
                active ? ' lpo-ps-knesset-stat-hit--active' : ''
              }`}
              title={`${tickLabel(bin.id)}: ${bin.count}`}
              aria-pressed={active}
              disabled={bin.count <= 0}
              onClick={() => onToggleFocus(focus)}
            >
              <div className="lpo-ps-knesset-age-bar-wrap">
                <div
                  className="lpo-ps-knesset-age-bar"
                  style={{ height: `${(bin.count / max) * 100}%` }}
                />
              </div>
              <span className="lpo-ps-knesset-age-tick">{tickLabel(bin.id)}</span>
            </button>
          )
        })}
      </div>
    </figure>
  )
}

function educationLabel(bucket: EducationBucket, t: UiStrings): string {
  if (bucket === 'torah') return t.knessetStatsEduTorah
  if (bucket === 'highschool') return t.knessetStatsEduHighSchool
  if (bucket === 'ba') return t.knessetStatsEduBa
  if (bucket === 'ma') return t.knessetStatsEduMa
  return t.knessetStatsEduPhd
}

function militaryServiceLabel(bucket: MilitaryServiceBucket, t: UiStrings): string {
  if (bucket === 'regular') return t.knessetStatsMilRegular
  if (bucket === 'officer') return t.knessetStatsMilOfficer
  if (bucket === 'national_service') return t.knessetStatsMilNationalService
  if (bucket === 'not_served') return t.knessetStatsMilNotServed
  return t.knessetStatsMilUnknown
}

function MilitaryServiceBars({
  rows,
  title,
  t,
  mapFilters,
  onToggleFocus,
  layoutSlot,
}: {
  rows: KnessetDemographics['militaryService']
  title: string
  t: UiStrings
  mapFilters: KnessetMapFilters
  onToggleFocus: (next: KnessetMapFocusItem) => void
  layoutSlot?: string
}) {
  const known = rows.reduce((s, r) => s + r.count, 0)
  if (known <= 0) return null

  return (
    <figure className={`lpo-ps-knesset-edu-fig${layoutSlot ? ` ${layoutSlot}` : ''}`}>
      <figcaption className="lpo-ps-knesset-stats-caption">{title}</figcaption>
      <ul className="lpo-ps-knesset-edu-list" dir="ltr">
        {rows.map((row) => {
          const focus: KnessetMapFocusItem = {
            kind: 'military',
            value: row.bucket,
          }
          const active = filtersInclude(mapFilters, focus)
          return (
            <li key={row.bucket}>
              <button
                type="button"
                className={`lpo-ps-knesset-edu-row lpo-ps-knesset-stat-hit${
                  active ? ' lpo-ps-knesset-stat-hit--active' : ''
                }`}
                aria-pressed={active}
                disabled={row.count <= 0}
                onClick={() => onToggleFocus(focus)}
              >
                <span className="lpo-ps-knesset-edu-name">{militaryServiceLabel(row.bucket, t)}</span>
                <div className="lpo-ps-knesset-edu-track">
                  <div
                    className="lpo-ps-knesset-edu-fill"
                    style={{ width: `${row.share * 100}%` }}
                  />
                </div>
                <span className="lpo-ps-knesset-edu-pct" dir="ltr">
                  {formatPctLabel(row.share)}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </figure>
  )
}

function EducationBars({
  rows,
  title,
  t,
  mapFilters,
  onToggleFocus,
  layoutSlot,
}: {
  rows: KnessetDemographics['education']
  title: string
  t: UiStrings
  mapFilters: KnessetMapFilters
  onToggleFocus: (next: KnessetMapFocusItem) => void
  layoutSlot?: string
}) {
  const known = rows.reduce((s, r) => s + r.count, 0)
  if (known <= 0) return null

  return (
    <figure className={`lpo-ps-knesset-edu-fig${layoutSlot ? ` ${layoutSlot}` : ''}`}>
      <figcaption className="lpo-ps-knesset-stats-caption">{title}</figcaption>
      <ul className="lpo-ps-knesset-edu-list" dir="ltr">
        {rows.map((row) => {
          const focus: KnessetMapFocusItem = {
            kind: 'education',
            value: row.bucket,
          }
          const active = filtersInclude(mapFilters, focus)
          return (
            <li key={row.bucket}>
              <button
                type="button"
                className={`lpo-ps-knesset-edu-row lpo-ps-knesset-stat-hit${
                  active ? ' lpo-ps-knesset-stat-hit--active' : ''
                }`}
                aria-pressed={active}
                disabled={row.count <= 0}
                onClick={() => onToggleFocus(focus)}
              >
                <span className="lpo-ps-knesset-edu-name">{educationLabel(row.bucket, t)}</span>
                <div className="lpo-ps-knesset-edu-track">
                  <div
                    className="lpo-ps-knesset-edu-fill"
                    style={{ width: `${row.share * 100}%` }}
                  />
                </div>
                <span className="lpo-ps-knesset-edu-pct" dir="ltr">
                  {formatPctLabel(row.share)}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </figure>
  )
}

function donutAria(label: string, portion: number, t: UiStrings): string {
  return t.knessetStatsDonutAria
    .replace(/\{label\}/g, label)
    .replace(/\{pct\}/g, String(Math.round(portion * 100)))
}

export function KnessetStatsRightStack({
  seats,
  mergeArabsWithOpposition,
  t,
  mapFilters,
  onToggleFocus,
}: {
  seats: readonly KnessetFilledSeat[]
  mergeArabsWithOpposition: boolean
  t: UiStrings
} & ChartFocusProps) {
  const seniorityStats = useMemo(
    () => chartDemographics(seats, mapFilters, mergeArabsWithOpposition, 'seniority'),
    [seats, mapFilters, mergeArabsWithOpposition],
  )
  const genderStats = useMemo(
    () => chartDemographics(seats, mapFilters, mergeArabsWithOpposition, 'gender'),
    [seats, mapFilters, mergeArabsWithOpposition],
  )
  const ageStats = useMemo(
    () => chartDemographics(seats, mapFilters, mergeArabsWithOpposition, 'age'),
    [seats, mapFilters, mergeArabsWithOpposition],
  )
  const knessetYearsStats = useMemo(
    () => chartDemographics(seats, mapFilters, mergeArabsWithOpposition, 'knessetYears'),
    [seats, mapFilters, mergeArabsWithOpposition],
  )

  const k25Resolve = resolveKnesset25Baseline(mapFilters, mergeArabsWithOpposition)
  const k25 = k25Resolve?.slice
  const k25Scope = k25Resolve?.scope ?? null
  const femaleK25Pp = k25
    ? knessetSharePpDelta(genderStats.femalePct, k25.femalePct)
    : null
  const newK25Pp = k25 ? knessetSharePpDelta(seniorityStats.newPct, k25.newPct) : null
  const tenureK25Pct = k25
    ? knessetScalarPctDelta(knessetYearsStats.avgKnessetYears, k25.avgKnessetYears)
    : null
  const ageK25Pct = k25 ? knessetScalarPctDelta(ageStats.avgAge, k25.avgAge) : null

  return (
    <div className="lpo-ps-knesset-stats lpo-ps-knesset-stats--right">
      {genderStats.femalePct != null ? (
        <Doughnut
          portion={genderStats.femalePct}
          label={t.knessetStatsGenderLabel}
          aria={donutAria(t.knessetStatsGenderLabel, genderStats.femalePct, t)}
          k25DeltaPp={femaleK25Pp}
          k25Scope={k25Scope}
          t={t}
          primaryFocus={{ kind: 'gender', value: 'female' }}
          complementFocus={{ kind: 'gender', value: 'male' }}
          mapFilters={mapFilters}
          onToggleFocus={onToggleFocus}
          layoutSlot="lpo-ps-knesset-stat-slot--gender"
        />
      ) : null}
      {seniorityStats.newPct != null ? (
        <Doughnut
          portion={seniorityStats.newPct}
          label={t.knessetStatsNewLabel}
          aria={donutAria(t.knessetStatsNewLabel, seniorityStats.newPct, t)}
          k25DeltaPp={newK25Pp}
          k25Scope={k25Scope}
          t={t}
          primaryFocus={{ kind: 'seniority', value: 'new' }}
          complementFocus={{ kind: 'seniority', value: 'veteran' }}
          mapFilters={mapFilters}
          onToggleFocus={onToggleFocus}
          layoutSlot="lpo-ps-knesset-stat-slot--new"
        />
      ) : null}
      <KnessetYearsHistogram
        bins={knessetYearsStats.knessetYearsBins}
        title={t.knessetStatsKnessetYearsLabel}
        avgValue={knessetYearsStats.avgKnessetYears}
        k25DeltaPct={tenureK25Pct}
        k25Scope={k25Scope}
        t={t}
        mapFilters={mapFilters}
        onToggleFocus={onToggleFocus}
        layoutSlot="lpo-ps-knesset-stat-slot--tenure"
      />
      <AgeHistogram
        bins={ageStats.ageBins}
        title={t.knessetStatsAgeLabel}
        avgValue={ageStats.avgAge}
        k25DeltaPct={ageK25Pct}
        k25Scope={k25Scope}
        t={t}
        mapFilters={mapFilters}
        onToggleFocus={onToggleFocus}
        layoutSlot="lpo-ps-knesset-stat-slot--age"
      />
    </div>
  )
}

export function KnessetStatsLeftStack({
  seats,
  mergeArabsWithOpposition,
  t,
  mapFilters,
  onToggleFocus,
}: {
  seats: readonly KnessetFilledSeat[]
  mergeArabsWithOpposition: boolean
  t: UiStrings
} & ChartFocusProps) {
  const militaryStats = useMemo(
    () => chartDemographics(seats, mapFilters, mergeArabsWithOpposition, 'military'),
    [seats, mapFilters, mergeArabsWithOpposition],
  )
  const educationStats = useMemo(
    () => chartDemographics(seats, mapFilters, mergeArabsWithOpposition, 'education'),
    [seats, mapFilters, mergeArabsWithOpposition],
  )

  const k25Resolve = resolveKnesset25Baseline(mapFilters, mergeArabsWithOpposition)
  const k25 = k25Resolve?.slice
  const k25Scope = k25Resolve?.scope ?? null
  const militaryFilteredSeats = useMemo(
    () =>
      filterSeatsByFilters(
        seats,
        chartStatsExcludingKind(mapFilters, 'military'),
        mergeArabsWithOpposition,
      ),
    [seats, mapFilters, mergeArabsWithOpposition],
  )
  const militaryK25Pp = k25
    ? knessetSharePpDelta(militaryServedPctOfAll(militaryFilteredSeats), k25.servedPct)
    : null

  return (
    <div className="lpo-ps-knesset-stats lpo-ps-knesset-stats--stage-left">
      {militaryStats.servedPct != null ? (
        <Doughnut
          portion={militaryStats.servedPct}
          label={t.knessetStatsMilitaryLabel}
          aria={donutAria(t.knessetStatsMilitaryLabel, militaryStats.servedPct, t)}
          k25DeltaPp={militaryK25Pp}
          k25Scope={k25Scope}
          t={t}
          primaryFocus={{ kind: 'military', value: 'served' }}
          complementFocus={{ kind: 'military', value: 'not_served' }}
          mapFilters={mapFilters}
          onToggleFocus={onToggleFocus}
          layoutSlot="lpo-ps-knesset-stat-slot--military"
        />
      ) : null}
      <MilitaryServiceBars
        rows={militaryStats.militaryService}
        title={t.knessetStatsMilitaryBreakdownLabel}
        t={t}
        mapFilters={mapFilters}
        onToggleFocus={onToggleFocus}
        layoutSlot="lpo-ps-knesset-stat-slot--military-breakdown"
      />
      <EducationBars
        rows={educationStats.education}
        title={t.knessetStatsEducationLabel}
        t={t}
        mapFilters={mapFilters}
        onToggleFocus={onToggleFocus}
        layoutSlot="lpo-ps-knesset-stat-slot--education"
      />
    </div>
  )
}
