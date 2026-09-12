import type { AppLocale } from '../i18n/localeContext'
import type { UiStrings } from '../i18n/strings'
import {
  knessetYearsBinLabel,
  peripheryBinLabel,
  preKnessetRoleChartLabel,
  sectorChartLabel,
  type EducationBucket,
  type KnessetMapFilters,
  type KnessetMapFocusItem,
  type MilitaryServiceBucket,
  type SectorBucket,
} from '../lib/knessetSeatDemographics'

function ageBinLabel(id: string): string {
  if (id === '80') return '80+'
  const start = Number(id)
  return `${start}–${start + 10}`
}

function educationLabel(bucket: EducationBucket, t: UiStrings): string {
  if (bucket === 'torah') return t.knessetStatsEduTorah
  if (bucket === 'highschool') return t.knessetStatsEduHighSchool
  if (bucket === 'ba') return t.knessetStatsEduBa
  if (bucket === 'ma') return t.knessetStatsEduMa
  return t.knessetStatsEduPhd
}

function militaryServiceLabel(
  bucket: MilitaryServiceBucket | 'served' | 'non_idf',
  t: UiStrings,
): string {
  if (bucket === 'served') return t.knessetStatsMilitaryLabel
  if (bucket === 'non_idf') return t.knessetStatsMilNonIdf
  if (bucket === 'regular') return t.knessetStatsMilRegular
  if (bucket === 'officer') return t.knessetStatsMilOfficer
  if (bucket === 'national_service') return t.knessetStatsMilNationalService
  if (bucket === 'not_served') return t.knessetStatsMilNotServed
  return t.knessetStatsMilUnknown
}

export function mapFilterLabel(
  filter: KnessetMapFocusItem,
  t: UiStrings,
  displayParty: (partyKey: string) => string,
  locale: AppLocale = 'he',
): string {
  if (filter.kind === 'party') return displayParty(filter.partyKey)
  if (filter.kind === 'segment') {
    return filter.segment === 'Coalition' ? t.coalition : t.opposition
  }
  if (filter.kind === 'seniority') {
    return filter.value === 'new' ? t.knessetMapSeniorityNew : t.knessetMapSeniorityVeteran
  }
  if (filter.kind === 'gender') {
    return filter.value === 'female' ? t.knessetMapGenderFemale : t.knessetMapGenderMale
  }
  if (filter.kind === 'military') {
    return militaryServiceLabel(filter.value, t)
  }
  if (filter.kind === 'age') return ageBinLabel(filter.value)
  if (filter.kind === 'knessetYears') return knessetYearsBinLabel(filter.value)
  if (filter.kind === 'periphery') return peripheryBinLabel(filter.value)
  if (filter.kind === 'education') return educationLabel(filter.value, t)
  if (filter.kind === 'sector') return sectorChartLabel(filter.value as SectorBucket, locale)
  if (filter.kind === 'preRole') return preKnessetRoleChartLabel(filter.value, locale)
  return ''
}

export function PollSummaryKnessetFiltersPane({
  filters,
  onToggleFilter,
  onReset,
  displayParty,
  locale,
  t,
}: {
  filters: KnessetMapFilters
  onToggleFilter: (item: KnessetMapFocusItem) => void
  onReset: () => void
  displayParty: (partyKey: string) => string
  locale: AppLocale
  t: UiStrings
}) {
  if (!filters.length) {
    return (
      <p
        className="lpo-ps-subtitle lpo-ps-subtitle--outlets-trend-hint lpo-ps-hero-chart-outlet-hint lpo-ps-hero-chart-knesset-filter-hint"
        dir={locale === 'he' ? 'rtl' : 'ltr'}
      >
        {t.knessetMapFilterHint}
      </p>
    )
  }

  return (
    <div className="lpo-ps-knesset-filters-pane" role="region" aria-label={t.knessetMapActiveFiltersAria}>
      <ul className="lpo-ps-knesset-filters-list">
        {filters.map((filter) => {
          const label = mapFilterLabel(filter, t, displayParty, locale)
          return (
            <li key={filterKey(filter)}>
              <button
                type="button"
                className="lpo-ps-knesset-filter-chip"
                onClick={() => onToggleFilter(filter)}
                aria-label={t.knessetMapFilterRemoveAria.replace(/\{label\}/g, label)}
              >
                <span className="lpo-ps-knesset-filter-chip-label">{label}</span>
                <span className="lpo-ps-knesset-filter-chip-x" aria-hidden>×</span>
              </button>
            </li>
          )
        })}
      </ul>
      <button
        type="button"
        className="lpo-ps-knesset-filters-reset"
        onClick={onReset}
        aria-label={t.knessetMapResetFiltersAria}
      >
        {t.knessetMapResetFilters}
      </button>
    </div>
  )
}

function filterKey(filter: KnessetMapFocusItem): string {
  if (filter.kind === 'party') return `party:${filter.partyKey}`
  if (filter.kind === 'segment') return `segment:${filter.segment}`
  if (filter.kind === 'seniority') return `seniority:${filter.value}`
  if (filter.kind === 'gender') return `gender:${filter.value}`
  if (filter.kind === 'military') return `military:${filter.value}`
  if (filter.kind === 'age') return `age:${filter.value}`
  if (filter.kind === 'knessetYears') return `knessetYears:${filter.value}`
  if (filter.kind === 'periphery') return `periphery:${filter.value}`
  if (filter.kind === 'education') return `education:${filter.value}`
  if (filter.kind === 'sector') return `sector:${filter.value}`
  return `preRole:${filter.value}`
}
