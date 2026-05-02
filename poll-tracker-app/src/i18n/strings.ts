import type { AppLocale } from './localeContext'

export type UiStrings = {
  titleLatest: string
  titleElectionPolls: string
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
  pollSummarySubtitle: string
  /** Bold lead + tail; shown above per-outlet rows in poll summary */
  pollSummaryOutletsBreakdownLead: string
  pollSummaryOutletsBreakdownTail: string
  pollSummaryNoOutlets: string
  pollSummaryHeroAria: string
  pollSummaryRowsAria: string
  pollSummaryChangedPartiesAria: string
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
    pollSummarySubtitle: 'Average of polls in the last {n} days.',
    pollSummaryOutletsBreakdownLead: 'Poll breakdown',
    pollSummaryOutletsBreakdownTail:
      ' (only parties with a seat change vs. the previous poll are shown)',
    pollSummaryNoOutlets: 'No polls from the last {n} days.',
    pollSummaryHeroAria: 'Average coalition and opposition across recent polls',
    pollSummaryRowsAria: 'Latest poll per outlet in window',
    pollSummaryChangedPartiesAria: 'Parties with mandate changes vs previous poll',
    pollSummaryOpenAria: 'Show poll summary for the last {n} days',
    pollSummaryCloseAria: 'Back to all polls',
    pollSummaryNarrativeBackgroundAria: 'General political context for this poll window',
    pollSummaryNarrativeTrendsAria: 'Outlet and party trend notes',
    pollSummaryNarrativeAsOf: 'Context as of {date}',
    mediaBiasNarrativeLinkAria: 'Open media house-effects analysis',

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
    titleElectionPolls: 'סקרי מנדטים בישראל',
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
    pollSummarySubtitle: 'ממוצע סקרים ב-{n} הימים האחרונים',
    pollSummaryOutletsBreakdownLead: 'פירוט הסקרים',
    pollSummaryOutletsBreakdownTail: ' (מוצגות רק מפלגות שרשמו שינוי מול סקר קודם)',
    pollSummaryNoOutlets: 'אין סקרים מתוך {n} הימים האחרונים.',
    pollSummaryHeroAria: 'ממוצע קואליציה ואופוזיציה מסקרים אחרונים',
    pollSummaryRowsAria: 'הסקר האחרון לכל כלי תקשורת בחלון',
    pollSummaryChangedPartiesAria: 'מפלגות עם שינוי במנדטים לעומת הסקר הקודם',
    pollSummaryOpenAria: 'הצג סיכום סקרים ל-{n} הימים האחרונים',
    pollSummaryCloseAria: 'חזרה לכל הסקרים',
    pollSummaryNarrativeBackgroundAria: 'רקע כללי לחלון הסקרים',
    pollSummaryNarrativeTrendsAria: 'הערות מגמה לפי ערוצים ומפלגות',
    pollSummaryNarrativeAsOf: 'הקשר מעודכן ל־{date}',
    mediaBiasNarrativeLinkAria: 'פתיחת ניתוח הטיית מדיה ואפקטי בית',

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
