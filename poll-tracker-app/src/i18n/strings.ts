import type { AppLocale } from './localeContext'

export type UiStrings = {
  titleLatest: string
  titleElectionPolls: string
  /** Page title while hero chart dialog is open */
  titleElectionPollsHeroChart: string
  titleOverview: string
  coalition: string
  opposition: string
  arabs: string
  pollsPerPage: string
  /** Second line under label + dropdown; 1 enables sparkline mode */
  pollsPerPageHint: string
  loading: string
  noPolls: string
  latestPrefix: string
  previousDate: string
  seats: string
  pageOf: string
  pageOfMid: string
  pollsWord: string
  previousBtn: string
  nextBtn: string
  data: string
  design: string
  /** Hero chart / seat-map footer: label before per-MK source links */
  footerKnessetCandidates: string
  /** Hero chart footer: VoteSmart was the initial seed, now replaced */
  footerVoteSmartReplaced: string
  localeToggleAria: string
  backToAllParties: string
  sparklineRowFocusAria: string
  sparklineFocusPollHint: string
  eventLabelsToggle: string
  eventLabelsToggleAria: string
  /** Bloc view: opposition vs opposition+Arabs merged */
  blocArabsToggleLabel: string
  blocArabsToggleAria: string
  blocArabsSeparate: string
  blocArabsCombined: string
  /** Poll summary rolling window: open / close */
  pollSummaryOpenBtn: string
  pollSummaryPartiesDetailBtn: string
  pollSummaryWindowDaysLabel: string
  pollSummaryWindowDaysAria: string
  pollSummaryWindowDaysDecreaseAria: string
  pollSummaryWindowDaysIncreaseAria: string
  pollSummarySubtitle: string
  /** Bold lead + tail; shown above per-outlet rows in poll summary */
  pollSummaryOutletsBreakdownLead: string
  pollSummaryOutletsBreakdownTail: string
  pollSummaryOutletsBreakdownTrendHint: string
  /** Values-only grid cell tooltip line 1 (with prior poll) */
  pollSummaryCellTooltipLine1: string
  /** Values-only grid cell tooltip line 1 when no prior poll exists */
  pollSummaryCellTooltipNoPrior: string
  /** Values-only grid cell tooltip: unchanged vs prior */
  pollSummaryCellTooltipVsPriorUnchanged: string
  /** Values-only grid cell tooltip: {delta} vs prior poll */
  pollSummaryCellTooltipVsPriorDelta: string
  /** Stdev footnote fragment for dot cells (above outlet mean) */
  pollSummaryCellStdevAboveMean: string
  /** Stdev footnote fragment for dot cells (below outlet mean) */
  pollSummaryCellStdevBelowMean: string
  pollSummaryNoOutlets: string
  pollSummaryHeroAria: string
  pollSummaryHeroAvgPartiesAria: string
  /** Tooltip on hero chip (n) = outlets with a seat change vs prior */
  pollSummaryChipDeltaOutletCountTitle: string
  /** One-line legend under hero chips for (n) poll count */
  pollSummaryHeroChipOutletCountLegend: string
  /** Hero chip legend: green/red delta meaning */
  pollSummaryHeroChipDeltaColorLegend: string
  /** Short label above hero chart toolbar button */
  pollSummaryToolbarChartLabel: string
  /** Second line on hero chart button — opens seat map + bars */
  pollSummaryToolbarChartSeatsLabel: string
  /** Short label above outlet filter toolbar button (unified table header) */
  pollSummaryToolbarFilterLabel: string
  /** Open cross-outlet average party bar chart (hero) */
  pollSummaryHeroPartiesChartOpenAria: string
  pollSummaryHeroPartiesChartTitle: string
  /** Shorter dialog title on compact (mobile) viewports */
  pollSummaryHeroPartiesChartTitleCompact: string
  pollSummaryHeroPartiesChartCloseAria: string
  /** Appended to chart popup title; {n} = rolling window days */
  pollSummaryHeroPartiesChartWindowSuffix: string
  pollSummaryLastPollDate: string
  pollSummaryHeroPartiesChartOutletsAria: string
  pollSummaryHeroPartiesChartOutletExcludeAria: string
  pollSummaryHeroPartiesChartOutletIncludeAria: string
  /** Hint under chart popup title (outlet icon toggle) */
  pollSummaryHeroPartiesChartOutletHint: string
  /** Hero chart dialog info button */
  pollSummaryHeroPartiesChartInfoAria: string
  pollSummaryHeroPartiesChartInfoTitle: string
  /** Hero chart methodology bullets; {n} = rolling window days */
  pollSummaryHeroPartiesChartInfoBulletWindow: string
  pollSummaryHeroPartiesChartInfoBulletBars: string
  pollSummaryHeroPartiesChartInfoBulletDelta: string
  pollSummaryHeroPartiesChartInfoBulletInclusion: string
  pollSummaryHeroPartiesChartInfoBulletMap: string
  pollSummaryHeroPartiesChartInfoBulletFilters: string
  pollSummaryHeroPartiesChartInfoDetailsToggle: string
  pollSummaryHeroPartiesChartInfoDetailsBody: string
  /** Knesset hemicycle seat map in hero chart popup */
  knessetMapAria: string
  knessetMapLoading: string
  knessetMapLoadError: string
  knessetMapCoalition: string
  knessetMapOpposition: string
  knessetMapArabs: string
  knessetMapSeniorityVeteran: string
  knessetMapSeniorityNew: string
  /** Tooltip: list rank of {rank} out of {total} party mandates */
  knessetMapListRank: string
  /** Swing-seat strip above a focused party wedge */
  knessetMapSwingTitle: string
  knessetMapSwingInLabel: string
  knessetMapSwingOutLabel: string
  knessetMapSwingOutAria: string
  knessetMapSwingInAria: string
  knessetMapTooltipAge: string
  knessetMapTooltipGender: string
  knessetMapTooltipKnessetYears: string
  /** Tooltip: Knesset tenure; {n} = years */
  knessetMapKnessetYearsValue: string
  knessetMapTooltipProfessional: string
  knessetMapTooltipEducation: string
  knessetMapTooltipMilitary: string
  knessetMapTooltipSector: string
  knessetMapTooltipCity: string
  knessetMapTooltipSubIdentity: string
  knessetMapTooltipFunFact: string
  knessetMapTooltipPreRole: string
  knessetMapTooltipSources: string
  knessetMapTooltipNoInfo: string
  knessetMapTooltipUnknownName: string
  knessetMapGenderMale: string
  knessetMapGenderFemale: string
  knessetStatsNewLabel: string
  knessetStatsGenderLabel: string
  knessetStatsAgeLabel: string
  knessetStatsPeripheryLabel: string
  knessetStatsKnessetYearsLabel: string
  /** {label} {value} — demographic chart caption with mean (aria) */
  knessetStatsCaptionWithMean: string
  knessetStatsMeanWord: string
  /** vs Knesset 25 baseline label under demographic stat captions */
  knessetStatsVsK25: string
  knessetStatsVsK25Party: string
  knessetStatsVsK25Bloc: string
  knessetStatsMilitaryLabel: string
  knessetStatsMilitaryBreakdownLabel: string
  knessetStatsMilRegular: string
  knessetStatsMilOfficer: string
  knessetStatsMilNationalService: string
  knessetStatsMilNotServed: string
  knessetStatsMilUnknown: string
  knessetStatsEducationLabel: string
  knessetStatsSectorLabel: string
  knessetStatsEduTorah: string
  knessetStatsEduHighSchool: string
  knessetStatsEduBa: string
  knessetStatsEduMa: string
  knessetStatsEduPhd: string
  /** {label} {pct} */
  knessetStatsDonutAria: string
  knessetMapResetFilters: string
  knessetMapResetFiltersAria: string
  knessetMapFilterHint: string
  knessetFilterMilitaryNotServed: string
  knessetMapActiveFiltersAria: string
  /** {label} */
  knessetMapFilterRemoveAria: string
  /** Hero trend panel header; {n} = rolling window days */
  pollSummaryHeroTrendPanelTitle: string
  /** Hero chip → cross-outlet average trend */
  pollSummaryHeroPartyTrendOpenAria: string
  pollSummaryHeroPartyTrendNoData: string
  pollSummaryRowsAria: string
  pollSummaryChangedPartiesAria: string
  /** Sticky party-name column header above unified outlet rows */
  pollSummaryUnifiedPartyNamesAria: string
  pollSummaryOpenAria: string
  pollSummaryCloseAria: string
  /** Region label for general background sentence under poll summary hero */
  pollSummaryNarrativeBackgroundAria: string
  /** Region label for trend bullet list below channel rows */
  pollSummaryNarrativeTrendsAria: string
  /** One line; use {date} placeholder */
  pollSummaryNarrativeAsOf: string
  /** Link below narrative trends → standalone media-bias page */
  mediaBiasNarrativeLinkAria: string
  /** Party icon → outlet trend panel */
  pollSummaryPartyTrendOpenAria: string
  pollSummaryPartyTrendPopupAria: string
  pollSummaryPartyTrendCloseAria: string
  pollSummaryPartyTrendPanelAria: string
  pollSummaryPartyTrendPanelHint: string
  pollSummaryPartyTrendBackBtn: string
  pollSummaryPartyTrendBackAria: string
  pollSummaryPartyTrendLegendAria: string
  pollSummaryPartyTrendMaxLabel: string
  pollSummaryPartyTrendRecentLabel: string
  pollSummaryPartyTrendNoData: string
  /** Narrow landscape: rotate-to-portrait hint on Knesset stats map (per landscape stint) */
  rotatePortraitTitle: string
  rotatePortraitDismiss: string

  // ── Media Bias Panel ──────────────────────────────────────────────────────
  mediaBiasOpenBtn: string
  mediaBiasTitle: string
  mediaBiasHouseEffect: string
  mediaBiasCoalitionTilt: string
  mediaBiasOppositionTilt: string
  mediaBiasPAdj: string
  mediaBiasAnomalies: string
  mediaBiasOutletDropdownLabel: string
  mediaBiasZThresholdLabel: string
  mediaBiasMinPollsLabel: string
  mediaBiasWindowDaysLabel: string
  mediaBiasSplitArabsLabel: string
  mediaBiasIncludeSubthresholdLabel: string
  mediaBiasBlocTiltTitle: string
  mediaBiasHeatmapTitle: string
  mediaBiasAnomalyTableTitle: string
  mediaBiasAnomalyDate: string
  mediaBiasAnomalyParty: string
  mediaBiasAnomalySeats: string
  mediaBiasAnomalyBaseline: string
  mediaBiasAnomalyRawResid: string
  mediaBiasAnomalyZ: string
  /** Tooltip label lines */
  mediaBiasTooltipN: string
  mediaBiasTooltipRawMean: string
  mediaBiasTooltipDampenedMean: string
  mediaBiasTooltipPValue: string
  mediaBiasTooltipPAdj: string
  mediaBiasTooltipPAdjExcluded: string
  /** 2022 Track Record badge */
  trackRecord2022Label: string
  trackRecordMaeLabel: string
  trackRecordBlocErrorLabel: string
  trackRecordNoData: string
}

export const UI: Record<AppLocale, UiStrings> = {
  en: {
    titleLatest: '',
    titleElectionPolls: 'Election Polls in Israel',
    titleElectionPollsHeroChart: 'Knesset 26 mandate polls & list mapping',
    titleOverview: '',
    coalition: 'Coalition',
    opposition: 'Opposition',
    arabs: 'Arabs',
    pollsPerPage: 'Polls in Page',
    pollsPerPageHint: 'Select 1 to show trends',
    loading: 'Loading poll data...',
    noPolls: 'No polls found.',
    latestPrefix: 'Latest:',
    previousDate: 'Previous',
    seats: 'seats',
    pageOf: 'Page',
    pageOfMid: 'of',
    pollsWord: 'polls',
    previousBtn: 'Previous',
    nextBtn: 'Next',
    data: 'Data:',
    design: 'Design:',
    footerKnessetCandidates: 'Candidates:',
    footerVoteSmartReplaced:
      'Initially seeded from VoteSmart; now replaced with verified sources.',
    localeToggleAria: 'Interface language',
    backToAllParties: 'All parties',
    sparklineRowFocusAria: 'Show this party only',
    sparklineFocusPollHint: 'Swipe to change polls, All parties to go back',
    eventLabelsToggle: 'Events',
    eventLabelsToggleAria: 'Show or hide timeline event labels',
    blocArabsToggleLabel: 'Merge Arabs with opposition?',
    blocArabsToggleAria: 'Show Arab-segment seats separately or merged into opposition',
    blocArabsSeparate: 'Split',
    blocArabsCombined: 'Merge',
    pollSummaryOpenBtn: 'Poll summary',
    pollSummaryPartiesDetailBtn: 'All polls',
    pollSummaryWindowDaysLabel: 'Days in window',
    pollSummaryWindowDaysAria: 'Number of days to include in the poll summary rolling window',
    pollSummaryWindowDaysDecreaseAria: 'Decrease days in window',
    pollSummaryWindowDaysIncreaseAria: 'Increase days in window',
    pollSummarySubtitle: 'Average of polls in the last {n} days.',
    pollSummaryOutletsBreakdownLead: 'Poll breakdown',
    pollSummaryOutletsBreakdownTail:
      ' (green/red = change vs prior; gold dot = >1σ vs other outlets; two dots = ≥2σ)',
    pollSummaryOutletsBreakdownTrendHint: 'Click a party in an outlet to view its trend',
    pollSummaryCellTooltipLine1:
      '{party} · {seats} seats · prior poll {prior}',
    pollSummaryCellTooltipNoPrior: '{party} · {seats} seats · no prior poll',
    pollSummaryCellTooltipVsPriorUnchanged: 'unchanged vs prior poll',
    pollSummaryCellTooltipVsPriorDelta: '{delta} vs prior poll',
    pollSummaryCellStdevAboveMean:
      '{sigma} standard deviations above outlet average ({mean})',
    pollSummaryCellStdevBelowMean:
      '{sigma} standard deviations below outlet average ({mean})',
    pollSummaryNoOutlets: 'No polls from the last {n} days.',
    pollSummaryHeroAria: 'Average coalition and opposition across recent polls',
    pollSummaryHeroAvgPartiesAria:
      'Average seats per party across outlets with seats or a change vs prior (including drops to 0); mandate changes highlighted; number in parentheses is how many polls showed that change',
    pollSummaryChipDeltaOutletCountTitle: '{n} polls with a seat change vs prior',
    pollSummaryHeroChipOutletCountLegend: '(n) = polls with a seat change vs prior',
    pollSummaryHeroChipDeltaColorLegend: 'Green/red = change vs prior poll',
    pollSummaryToolbarChartLabel: 'Chart',
    pollSummaryToolbarChartSeatsLabel: '+ Seats',
    pollSummaryToolbarFilterLabel: 'Filter',
    pollSummaryHeroPartiesChartOpenAria:
      'Show cross-outlet party averages with Knesset seat map and bar chart',
    pollSummaryHeroPartiesChartTitle: 'Cross-outlet party averages',
    pollSummaryHeroPartiesChartTitleCompact: 'Party averages across outlets',
    pollSummaryHeroPartiesChartCloseAria: 'Close party breakdown',
    pollSummaryHeroPartiesChartWindowSuffix: ' · {n}-day window',
    pollSummaryLastPollDate: 'Last poll: {date}',
    pollSummaryHeroPartiesChartOutletsAria:
      'Outlets in the rolling window; click to include or exclude from the average',
    pollSummaryHeroPartiesChartOutletExcludeAria: 'Exclude {outlet} from average',
    pollSummaryHeroPartiesChartOutletIncludeAria: 'Include {outlet} in average',
    pollSummaryHeroPartiesChartOutletHint:
      'Click an outlet icon to include or exclude it from the average',
    pollSummaryHeroPartiesChartInfoAria: 'Methodology and how to use this chart',
    pollSummaryHeroPartiesChartInfoTitle: 'Methodology & how to read',
    pollSummaryHeroPartiesChartInfoBulletWindow:
      'Shows the latest poll from each outlet in the last {n} days. Tap an outlet icon to include or exclude it from the averages.',
    pollSummaryHeroPartiesChartInfoBulletBars:
      'Bars show each party’s mean seat count across included outlets (one decimal). The number in parentheses is that average rounded to whole seats for the hemicycle map.',
    pollSummaryHeroPartiesChartInfoBulletDelta:
      'Deltas (green up / red down) compare today’s cross-outlet mean to the mean from each outlet’s prior poll. (n) is how many outlets reported any seat change for that party.',
    pollSummaryHeroPartiesChartInfoBulletInclusion:
      'A party enters the mean at an outlet only if it currently holds seats there or changed vs that outlet’s previous poll (including falling to zero).',
    pollSummaryHeroPartiesChartInfoBulletMap:
      'The seat map fills candidate placeholders from published lists using largest-remainder rounding to 120 mandates from the averaged poll. Party averages include every list above the electoral threshold, so parties with fewer than 4 seats may appear.',
    pollSummaryHeroPartiesChartInfoBulletFilters:
      'Click a party row, bloc bar, or demographic chart to filter seats and stats. Reset filters above the map.',
    pollSummaryHeroPartiesChartInfoDetailsToggle: 'Knesset 25 comparison · More details',
    pollSummaryHeroPartiesChartInfoDetailsBody:
      'Measured on the 120 MKs seated on Sep 9, 2026, not those elected in 2022. Women: 33 (29 were elected; replacements raised it). Military service (regular/career/shortened; national service not counted): 77 — 64.2% of all, 71.3% of the 108 with verified info; 12 unknown. New: 39 first entered in this Knesset. Tenure: 7.8 actual years (median 5.4). Age: 55.3 (median 53.2; 119 with known DOB). Blocs as of Sep 9, 2026; Shas left the government but stayed in the coalition.\n\nBloc K25 baselines follow the “merge Arabs with opposition” toggle: merged — opposition+Arabs (60 seats); separate — opposition excluding Arab parties (50). Coalition (60): women 18.3%, new 40%, military served 66.7%, avg age 54.9, tenure 7.7. Opposition excl. Arabs (50): women 40%, new 24%, military served 72%, avg age 55.3, tenure 7.7.\n\nSources: Knesset website, Wikipedia, Wikidata, CBS, ynet — a cited source per MK. Initially seeded from VoteSmart; now replaced.',
    knessetMapAria: 'Knesset seat map from latest poll averages',
    knessetMapLoading: 'Loading candidate lists…',
    knessetMapLoadError: 'Could not load candidate lists.',
    knessetMapCoalition: 'Coalition',
    knessetMapOpposition: 'Opposition',
    knessetMapArabs: 'Arab lists',
    knessetMapSeniorityVeteran: 'Experienced MK',
    knessetMapSeniorityNew: 'New candidate',
    knessetMapListRank: 'List rank {rank} of {total}',
    knessetMapSwingTitle: 'On the bubble',
    knessetMapSwingInLabel: 'In',
    knessetMapSwingOutLabel: 'Out',
    knessetMapSwingOutAria: 'Next in line if the party gains seats',
    knessetMapSwingInAria: 'Last in if the party loses seats',
    knessetMapTooltipAge: 'Age',
    knessetMapTooltipGender: 'Gender',
    knessetMapTooltipKnessetYears: 'Knesset tenure',
    knessetMapKnessetYearsValue: '{n} years',
    knessetMapTooltipProfessional: 'Professional experience',
    knessetMapTooltipEducation: 'Education',
    knessetMapTooltipMilitary: 'Military / national service',
    knessetMapTooltipSector: 'Sector',
    knessetMapTooltipCity: 'City',
    knessetMapTooltipSubIdentity: 'Sub-identity',
    knessetMapTooltipFunFact: 'Fun fact',
    knessetMapTooltipPreRole: 'Pre-Knesset role',
    knessetMapTooltipSources: 'Sources',
    knessetMapTooltipNoInfo: 'No information',
    knessetMapTooltipUnknownName: 'Unknown candidate',
    knessetMapGenderMale: 'Male',
    knessetMapGenderFemale: 'Female',
    knessetStatsNewLabel: 'New MKs',
    knessetStatsGenderLabel: 'Women',
    knessetStatsAgeLabel: 'Age',
    knessetStatsPeripheryLabel: 'Periphery grade',
    knessetStatsKnessetYearsLabel: 'Knesset tenure',
    knessetStatsCaptionWithMean: '{label} · avg {value}',
    knessetStatsMeanWord: 'avg',
    knessetStatsVsK25: 'vs K25 (full Knesset)',
    knessetStatsVsK25Party: 'vs K25 (party)',
    knessetStatsVsK25Bloc: 'vs K25 (bloc)',
    knessetStatsMilitaryLabel: 'Served',
    knessetStatsMilitaryBreakdownLabel: 'Military / national service',
    knessetStatsMilRegular: 'Regular service',
    knessetStatsMilOfficer: 'Officer',
    knessetStatsMilNationalService: 'National service',
    knessetStatsMilNotServed: 'Did not serve',
    knessetStatsMilUnknown: 'No information',
    knessetStatsEducationLabel: 'Education',
    knessetStatsSectorLabel: 'Sector',
    knessetStatsEduTorah: 'Torah',
    knessetStatsEduHighSchool: 'High school',
    knessetStatsEduBa: "Bachelor's",
    knessetStatsEduMa: "Master's",
    knessetStatsEduPhd: 'Doctorate',
    knessetStatsDonutAria: '{label}: {pct} percent',
    knessetMapResetFilters: 'Reset filters',
    knessetMapResetFiltersAria: 'Clear all Knesset map filters',
    knessetMapFilterHint:
      'Click a party, bloc, or chart to filter the seat map',
    knessetFilterMilitaryNotServed: 'Did not serve',
    knessetMapActiveFiltersAria: 'Active Knesset filters',
    knessetMapFilterRemoveAria: 'Remove {label} filter',
    pollSummaryHeroTrendPanelTitle: 'Cross-outlet average · {n}-day window',
    pollSummaryHeroPartyTrendOpenAria: 'Show cross-outlet average seat trend for {party}',
    pollSummaryHeroPartyTrendNoData: 'No poll history for this party in the window.',
    pollSummaryRowsAria: 'Latest poll per outlet in window',
    pollSummaryChangedPartiesAria:
      'All parties with seats in the latest poll; mandate changes vs previous poll highlighted',
    pollSummaryUnifiedPartyNamesAria:
      'Party columns: opposition then Arabs then coalition, seats descending within each bloc',
    pollSummaryOpenAria: 'Show poll summary for the last {n} days',
    pollSummaryCloseAria: 'Back to all polls',
    pollSummaryNarrativeBackgroundAria: 'General political context for this poll window',
    pollSummaryNarrativeTrendsAria: 'Outlet and party trend notes',
    pollSummaryNarrativeAsOf: 'Context as of {date}',
    mediaBiasNarrativeLinkAria: 'Open media house-effects analysis',
    pollSummaryPartyTrendOpenAria: 'Show seat trend for {party} at {outlet}',
    pollSummaryPartyTrendPopupAria: 'Seat trend for {party} at {outlet}',
    pollSummaryPartyTrendCloseAria: 'Close trend chart',
    pollSummaryPartyTrendPanelAria: 'Seat trends at {outlet}: {parties}',
    pollSummaryPartyTrendPanelHint: 'Click party icons above to add or remove lines',
    pollSummaryPartyTrendBackBtn: 'All outlets',
    pollSummaryPartyTrendBackAria: 'Show all outlets and close trend chart',
    pollSummaryPartyTrendLegendAria: 'Parties shown on chart',
    pollSummaryPartyTrendMaxLabel: 'Max',
    pollSummaryPartyTrendRecentLabel: 'Recent',
    pollSummaryPartyTrendNoData: 'No poll history for this party at this outlet.',
    rotatePortraitTitle: 'Rotate to portrait',
    rotatePortraitDismiss: 'Got it',

    // ── Media Bias Panel ────────────────────────────────────────────────────
    mediaBiasOpenBtn: 'Media bias',
    mediaBiasTitle: 'Media Bias',
    mediaBiasHouseEffect: 'House Effect (seats)',
    mediaBiasCoalitionTilt: 'Coalition tilt',
    mediaBiasOppositionTilt: 'Opposition tilt',
    mediaBiasPAdj: 'p (FDR)',
    mediaBiasAnomalies: 'Anomalies',
    mediaBiasOutletDropdownLabel: 'Outlet',
    mediaBiasZThresholdLabel: 'z threshold',
    mediaBiasMinPollsLabel: 'Min polls',
    mediaBiasWindowDaysLabel: 'Window (days)',
    mediaBiasSplitArabsLabel: 'Split Arab parties',
    mediaBiasIncludeSubthresholdLabel: 'Include sub-threshold parties',
    mediaBiasBlocTiltTitle: 'Bloc Tilt per Outlet',
    mediaBiasHeatmapTitle: 'House Effects Heatmap',
    mediaBiasAnomalyTableTitle: 'Per-Outlet Anomalies',
    mediaBiasAnomalyDate: 'Date',
    mediaBiasAnomalyParty: 'Party',
    mediaBiasAnomalySeats: 'Seats',
    mediaBiasAnomalyBaseline: 'Baseline',
    mediaBiasAnomalyRawResid: 'Raw Δ',
    mediaBiasAnomalyZ: 'z',
    mediaBiasTooltipN: 'N',
    mediaBiasTooltipRawMean: 'Raw Mean',
    mediaBiasTooltipDampenedMean: 'Dampened Mean',
    mediaBiasTooltipPValue: 'p-value',
    mediaBiasTooltipPAdj: 'pAdj (FDR)',
    mediaBiasTooltipPAdjExcluded: '— (n below threshold)',
    trackRecord2022Label: '2022 Track Record',
    trackRecordMaeLabel: 'MAE',
    trackRecordBlocErrorLabel: 'Bloc Error',
    trackRecordNoData: 'N/A — No 2022 Data',
  },
  he: {
    titleLatest: '',
    titleElectionPolls: 'סקרי מנדטים לכנסת ה-26',
    titleElectionPollsHeroChart: 'סקרי מנדטים ומיפוי רשימות לכנסת ה-26',
    titleOverview: '',
    coalition: 'קואליציה',
    opposition: 'אופוזיציה',
    arabs: 'ערבים',
    pollsPerPage: 'סקרים לעמוד',
    pollsPerPageHint: 'בחרו 1 להצגת מגמות',
    loading: 'טוען נתוני סקרים...',
    noPolls: 'לא נמצאו סקרים.',
    latestPrefix: 'אחרון:',
    previousDate: 'קודם',
    seats: 'מנדטים',
    pageOf: 'עמוד',
    pageOfMid: 'מתוך',
    pollsWord: 'סקרים',
    previousBtn: 'הקודם',
    nextBtn: 'הבא',
    data: 'נתונים:',
    design: 'עיצוב:',
    footerKnessetCandidates: 'מועמדים:',
    footerVoteSmartReplaced: 'שואב בתחילה מ-VoteSmart; הוחלף במקורות מאומתים.',
    localeToggleAria: 'שפת הממשק',
    backToAllParties: 'כל המפלגות',
    sparklineRowFocusAria: 'הצג רק מפלגה זו',
    sparklineFocusPollHint: 'החלק כדי להחליף סקר, ״כל המפלגות״ לחזרה',
    eventLabelsToggle: 'אירועים',
    eventLabelsToggleAria: 'הצגה או הסתרה של תוויות ציר הזמן',
    blocArabsToggleLabel: 'מזג ערבים עם אופוזיציה?',
    blocArabsToggleAria: 'הצגת מנדטים ערביים נפרד או ממוזג לאופוזיציה',
    blocArabsSeparate: 'נפרד',
    blocArabsCombined: 'מיזוג',
    pollSummaryOpenBtn: 'סיכום סקרים',
    pollSummaryPartiesDetailBtn: 'כל הסקרים',
    pollSummaryWindowDaysLabel: 'ימים בחלון',
    pollSummaryWindowDaysAria: 'מספר הימים האחורה לכלול בסיכום הסקרים',
    pollSummaryWindowDaysDecreaseAria: 'הקטנת מספר הימים בחלון',
    pollSummaryWindowDaysIncreaseAria: 'הגדלת מספר הימים בחלון',
    pollSummarySubtitle: 'ממוצע סקרים ב-{n} הימים האחרונים',
    pollSummaryOutletsBreakdownLead: 'פירוט הסקרים',
    pollSummaryOutletsBreakdownTail:
      ' (ירוק/אדום = שינוי מול סקר קודם; נקודה זהובה = >1σ מול שאר הערוצים; שתי נקודות = ≥2σ)',
    pollSummaryOutletsBreakdownTrendHint: 'לחצו על מפלגה בערוץ כדי לראות טרנד',
    pollSummaryCellTooltipLine1:
      '{party} · {seats} מנדטים · סקר קודם {prior}',
    pollSummaryCellTooltipNoPrior: '{party} · {seats} מנדטים · אין סקר קודם',
    pollSummaryCellTooltipVsPriorUnchanged: 'ללא שינוי מול סקר קודם',
    pollSummaryCellTooltipVsPriorDelta: '{delta} מול סקר קודם',
    pollSummaryCellStdevAboveMean:
      '{sigma} סטיית תקן מעל ממוצע הערוצים ({mean})',
    pollSummaryCellStdevBelowMean:
      '{sigma} סטיית תקן מתחת ממוצע הערוצים ({mean})',
    pollSummaryNoOutlets: 'אין סקרים מתוך {n} הימים האחרונים.',
    pollSummaryHeroAria: 'ממוצע קואליציה ואופוזיציה מסקרים אחרונים',
    pollSummaryHeroAvgPartiesAria:
      'ממוצע מנדטים לפי מפלגה בין ערוצים עם מנדטים או שינוי מול הסקר הקודם (כולל ירידה ל־0); שינוי מודגש; המספר בסוגריים = כמה סקרים הציגו את השינוי',
    pollSummaryChipDeltaOutletCountTitle: '{n} סקרים עם שינוי מול הסקר הקודם',
    pollSummaryHeroChipOutletCountLegend: '(מספר) = סקרים עם שינוי מול הסקר הקודם',
    pollSummaryHeroChipDeltaColorLegend: 'ירוק/אדום = שינוי מול סקר קודם',
    pollSummaryToolbarChartLabel: 'גרף',
    pollSummaryToolbarChartSeatsLabel: '+מושבים',
    pollSummaryToolbarFilterLabel: 'סינון',
    pollSummaryHeroPartiesChartOpenAria:
      'הצג ממוצע מנדטים לפי מפלגה עם מפת 120 מושבים וגרף מנדטים',
    pollSummaryHeroPartiesChartTitle: 'ממוצע מנדטים לפי מפלגה בין הערוצים',
    pollSummaryHeroPartiesChartTitleCompact: 'ממוצע לפי מפלגה בין הערוצים',
    pollSummaryHeroPartiesChartCloseAria: 'סגור פירוט מפלגות',
    pollSummaryHeroPartiesChartWindowSuffix: ' · חלון {n} ימים',
    pollSummaryLastPollDate: 'סקר אחרון: {date}',
    pollSummaryHeroPartiesChartOutletsAria:
      'ערוצים בחלון הסקרים; לחיצה לכלילה או הוצאה מהממוצע',
    pollSummaryHeroPartiesChartOutletExcludeAria: 'הוצא את {outlet} מהממוצע',
    pollSummaryHeroPartiesChartOutletIncludeAria: 'כלול את {outlet} בממוצע',
    pollSummaryHeroPartiesChartOutletHint:
      'לחצו על ערוץ כדי לכלול או להוציא אותו מהממוצע',
    pollSummaryHeroPartiesChartInfoAria: 'מתודולוגיה והסבר על השימוש בגרף',
    pollSummaryHeroPartiesChartInfoTitle: 'מתודולוגיה ואיך לקרוא',
    pollSummaryHeroPartiesChartInfoBulletWindow:
      'מוצג הסקר האחרון מכל ערוץ ב-{n} הימים האחרונים. לחצו על אייקון ערוץ כדי לכלול או להוציא אותו מהממוצע.',
    pollSummaryHeroPartiesChartInfoBulletBars:
      'העמודות מציגות ממוצע מנדטים לפי מפלגה בין הערוצים שנבחרו (ספרה עשרונית אחת). המספר בסוגריים הוא העיגול למנדטים שלמים למפת המושבים.',
    pollSummaryHeroPartiesChartInfoBulletDelta:
      'השינויים (ירוק/אדום) מודדים את הממוצע הנוכחי מול הממוצע מסקר קודם בכל ערוץ. (מספר) = בכמה סקרים הייתה תזוזה במנדטים.',
    pollSummaryHeroPartiesChartInfoBulletInclusion:
      'מפלגה נכנסת לממוצע בערוץ רק אם יש לה מנדטים שם כעת או שינוי מול הסקר הקודם של אותו ערוץ (כולל ירידה ל־0).',
    pollSummaryHeroPartiesChartInfoBulletMap:
      'מפת המושבים ממלאת מועמדים מרשימות שפורסמו, עם עיגול בשיטת השאריות הגדולות ל־120 מנדטים לפי ממוצע הסקרים. הממוצע כולל כל מפלגה מעל אחוז החסימה, ולכן עשויות להופיע מפלגות עם פחות מ־4 מנדטים.',
    pollSummaryHeroPartiesChartInfoBulletFilters:
      'לחצו על מפלגה, גוש או תרשים דמוגרפי כדי לסנן מושבים וסטטיסטיקות. איפוס מסננים מעל המפה.',
    pollSummaryHeroPartiesChartInfoDetailsToggle: 'השוואה לכנסת 25 · פרטים נוספים',
    pollSummaryHeroPartiesChartInfoDetailsBody:
      'נמדד על 120 המכהנים ב-9.9.26, לא על הנבחרים של 2022. נשים: 33 (נבחרו 29, החלפות העלו). שירות צבאי (סדיר/קבע/מקוצר; שירות לאומי לא נספר): 77 — 64.2% מכולם, 71.3% מתוך 108 עם מידע מאומת; 12 בלי מידע. חדשים: 39 נכנסו לראשונה בכנסת זו. ותק: 7.8 שנים בפועל (חציון 5.4). גיל: 55.3 (חציון 53.2; 119 עם תאריך ידוע). גושים נכון ל-9.9.26; ש"ס מחוץ לממשלה אך בקואליציה.\n\nהשוואת גושים תואמת להגדרת «מזג ערבים עם אופוזיציה»: במיזוג — אופוזיציה+ערבים (60); בנפרד — אופוזיציה ללא מפלגות ערביות (50). קואליציה (60): נשים 18.3%, חדשים 40%, שירות צבאי 66.7%, גיל ממוצע 54.9, ותק 7.7. אופוזיציה ללא ערבים (50): נשים 40%, חדשים 24%, שירות צבאי 72%, גיל 55.3, ותק 7.7.\n\nמקורות: אתר הכנסת, ויקיפדיה, ויקינתונים, למ"ס, ynet — מקור מתועד לכל ח"כ. שואב בתחילה מ-VoteSmart; הוחלף.',
    knessetMapAria: 'מפת מושבים בכנסת לפי ממוצע הסקרים',
    knessetMapLoading: 'טוען רשימות מועמדים…',
    knessetMapLoadError: 'לא ניתן לטעון רשימות מועמדים.',
    knessetMapCoalition: 'קואליציה',
    knessetMapOpposition: 'אופוזיציה',
    knessetMapArabs: 'רשימות ערביות',
    knessetMapSeniorityVeteran: 'חבר כנסת ותיק',
    knessetMapSeniorityNew: 'מועמד חדש',
    knessetMapListRank: 'מקום {rank} מתוך {total}',
    knessetMapSwingTitle: 'מתנדנדים',
    knessetMapSwingInLabel: 'בפנים',
    knessetMapSwingOutLabel: 'בחוץ',
    knessetMapSwingOutAria: 'הבאים בתור אם המפלגה תרוויח מנדטים',
    knessetMapSwingInAria: 'האחרונים במקום אם המפלגה תאבד מנדטים',
    knessetMapTooltipAge: 'גיל',
    knessetMapTooltipGender: 'מין',
    knessetMapTooltipKnessetYears: 'ותק בכנסת',
    knessetMapKnessetYearsValue: '{n} שנים',
    knessetMapTooltipProfessional: 'ניסיון מקצועי',
    knessetMapTooltipEducation: 'השכלה',
    knessetMapTooltipMilitary: 'שירות צבאי/לאומי',
    knessetMapTooltipSector: 'מגזר',
    knessetMapTooltipCity: 'יישוב',
    knessetMapTooltipSubIdentity: 'תת-זהות',
    knessetMapTooltipFunFact: 'עובדה מעניינת',
    knessetMapTooltipPreRole: 'תפקיד קדם-כנסת',
    knessetMapTooltipSources: 'מקורות',
    knessetMapTooltipNoInfo: 'אין מידע',
    knessetMapTooltipUnknownName: 'מועמד/ת לא ידוע/ה',
    knessetMapGenderMale: 'זכר',
    knessetMapGenderFemale: 'נקבה',
    knessetStatsNewLabel: 'חדשים בכנסת',
    knessetStatsGenderLabel: 'נשים',
    knessetStatsMilitaryLabel: 'שירות צבאי',
    knessetStatsMilitaryBreakdownLabel: 'שירות צבאי/לאומי',
    knessetStatsMilRegular: 'סדיר',
    knessetStatsMilOfficer: 'קצין',
    knessetStatsMilNationalService: 'שירות לאומי',
    knessetStatsMilNotServed: 'לא שירתו',
    knessetStatsMilUnknown: 'אין מידע',
    knessetStatsAgeLabel: 'גיל',
    knessetStatsPeripheryLabel: 'ציון פריפריה',
    knessetStatsKnessetYearsLabel: 'ותק בכנסת',
    knessetStatsCaptionWithMean: '{label} · ממוצע {value}',
    knessetStatsMeanWord: 'ממוצע',
    knessetStatsVsK25: 'לעומת כ"כ25 (כל המליאה)',
    knessetStatsVsK25Party: 'לעומת כ"כ25 (מפלגה)',
    knessetStatsVsK25Bloc: 'לעומת כ"כ25 (גוש)',
    knessetStatsEducationLabel: 'השכלה',
    knessetStatsSectorLabel: 'מגזר',
    knessetStatsEduTorah: 'תורנית',
    knessetStatsEduHighSchool: 'תיכונית',
    knessetStatsEduBa: 'תואר ראשון',
    knessetStatsEduMa: 'תואר שני',
    knessetStatsEduPhd: 'דוקטורט',
    knessetStatsDonutAria: '{label}: {pct} אחוז',
    knessetMapResetFilters: 'איפוס מסננים',
    knessetMapResetFiltersAria: 'ניקוי כל מסנני מפת הכנסת',
    knessetMapFilterHint: 'לחצו על מפלגה, גוש או תרשים כדי לסנן מפת המושבים',
    knessetFilterMilitaryNotServed: 'לא שירתו',
    knessetMapActiveFiltersAria: 'מסנני כנסת פעילים',
    knessetMapFilterRemoveAria: 'הסר מסנן {label}',
    pollSummaryHeroTrendPanelTitle: 'ממוצע ערוצים · חלון {n} ימים',
    pollSummaryHeroPartyTrendOpenAria: 'הצג מגמת מנדטים ממוצעת בין ערוצים עבור {party}',
    pollSummaryHeroPartyTrendNoData: 'אין היסטוריית סקרים למפלגה זו בחלון.',
    pollSummaryRowsAria: 'הסקר האחרון לכל כלי תקשורת בחלון',
    pollSummaryChangedPartiesAria:
      'כל המפלגות עם מנדטים בסקר האחרון; שינוי מול סקר קודם מסומן ב-Δ',
    pollSummaryUnifiedPartyNamesAria:
      'עמודות מפלגות: אופוזיציה ואז ערבים ואז קואליציה, מנדטים יורדים בכל גוש',
    pollSummaryOpenAria: 'הצג סיכום סקרים ל-{n} הימים האחרונים',
    pollSummaryCloseAria: 'חזרה לכל הסקרים',
    pollSummaryNarrativeBackgroundAria: 'רקע כללי לחלון הסקרים',
    pollSummaryNarrativeTrendsAria: 'הערות מגמה לפי ערוצים ומפלגות',
    pollSummaryNarrativeAsOf: 'הקשר מעודכן ל־{date}',
    mediaBiasNarrativeLinkAria: 'פתיחת ניתוח הטיית מדיה ואפקטי בית',
    pollSummaryPartyTrendOpenAria: 'הצג מגמת מנדטים עבור {party} ב-{outlet}',
    pollSummaryPartyTrendPopupAria: 'מגמת מנדטים עבור {party} ב-{outlet}',
    pollSummaryPartyTrendCloseAria: 'סגור גרף מגמה',
    pollSummaryPartyTrendPanelAria: 'מגמות מנדטים ב-{outlet}: {parties}',
    pollSummaryPartyTrendPanelHint: 'לחצו על אייקוני המפלגות למעלה להוספה או הסרה מהגרף',
    pollSummaryPartyTrendBackBtn: 'כל הערוצים',
    pollSummaryPartyTrendBackAria: 'הצג את כל הערוצים וסגור את גרף המגמה',
    pollSummaryPartyTrendLegendAria: 'מפלגות המוצגות בגרף',
    pollSummaryPartyTrendMaxLabel: 'מקס׳',
    pollSummaryPartyTrendRecentLabel: 'אחרון',
    pollSummaryPartyTrendNoData: 'אין היסטוריית סקרים למפלגה זו בערוץ זה.',
    rotatePortraitTitle: 'סובבו את המכשיר לאורך',
    rotatePortraitDismiss: 'הבנתי',

    // ── פאנל הטיית מדיה ─────────────────────────────────────────────────────
    mediaBiasOpenBtn: 'הטיית מדיה',
    mediaBiasTitle: 'הטיית מדיה',
    mediaBiasHouseEffect: 'אפקט בית (מנדטים)',
    mediaBiasCoalitionTilt: 'הטיה לקואליציה',
    mediaBiasOppositionTilt: 'הטיה לאופוזיציה',
    mediaBiasPAdj: 'p (FDR)',
    mediaBiasAnomalies: 'חריגות',
    mediaBiasOutletDropdownLabel: 'ערוץ',
    mediaBiasZThresholdLabel: 'סף z',
    mediaBiasMinPollsLabel: 'מינ׳ סקרים',
    mediaBiasWindowDaysLabel: 'חלון (ימים)',
    mediaBiasSplitArabsLabel: 'פיצול מפלגות ערביות',
    mediaBiasIncludeSubthresholdLabel: 'כלול מפלגות מתחת לאחוז חסימה',
    mediaBiasBlocTiltTitle: 'הטיית גוש לפי ערוץ',
    mediaBiasHeatmapTitle: 'מפת חום — אפקטי בית',
    mediaBiasAnomalyTableTitle: 'חריגות לפי ערוץ',
    mediaBiasAnomalyDate: 'תאריך',
    mediaBiasAnomalyParty: 'מפלגה',
    mediaBiasAnomalySeats: 'מנדטים',
    mediaBiasAnomalyBaseline: 'קו בסיס',
    mediaBiasAnomalyRawResid: 'סטייה',
    mediaBiasAnomalyZ: 'z',
    mediaBiasTooltipN: 'N',
    mediaBiasTooltipRawMean: 'ממוצע גולמי',
    mediaBiasTooltipDampenedMean: 'ממוצע מרוסן',
    mediaBiasTooltipPValue: 'ערך p',
    mediaBiasTooltipPAdj: 'pAdj (FDR)',
    mediaBiasTooltipPAdjExcluded: '— (N מתחת לסף)',
    trackRecord2022Label: 'רקורד 2022',
    trackRecordMaeLabel: 'MAE',
    trackRecordBlocErrorLabel: 'שגיאת גוש',
    trackRecordNoData: 'אין נתוני 2022',
  },
}
