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
  /** Open cross-outlet average party bar chart (hero) */
  pollSummaryHeroPartiesChartOpenAria: string
  pollSummaryHeroPartiesChartTitle: string
  pollSummaryHeroPartiesChartCloseAria: string
  /** Appended to chart popup title; {n} = rolling window days */
  pollSummaryHeroPartiesChartWindowSuffix: string
  pollSummaryHeroPartiesChartOutletsAria: string
  pollSummaryHeroPartiesChartOutletExcludeAria: string
  pollSummaryHeroPartiesChartOutletIncludeAria: string
  /** Hint under chart popup title (outlet icon toggle) */
  pollSummaryHeroPartiesChartOutletHint: string
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
  /** Narrow portrait: one-time rotate-to-landscape hint on poll summary */
  rotateLandscapeTitle: string
  rotateLandscapeDismiss: string

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
      ' (green/red = change vs prior; gray dot under value = unusual vs other outlets; two dots = more unusual)',
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
      'Average seats per party across outlets in the window; mandate changes vs previous poll highlighted; number in parentheses is how many polls showed that change',
    pollSummaryChipDeltaOutletCountTitle: '{n} polls with a seat change vs prior',
    pollSummaryHeroChipOutletCountLegend: '(n) = polls with a seat change vs prior',
    pollSummaryHeroChipDeltaColorLegend: 'Green/red = change vs prior poll',
    pollSummaryHeroPartiesChartOpenAria: 'Show cross-outlet party average breakdown',
    pollSummaryHeroPartiesChartTitle: 'Cross-outlet party averages',
    pollSummaryHeroPartiesChartCloseAria: 'Close party breakdown',
    pollSummaryHeroPartiesChartWindowSuffix: ' · {n}-day window',
    pollSummaryHeroPartiesChartOutletsAria:
      'Outlets in the rolling window; click to include or exclude from the average',
    pollSummaryHeroPartiesChartOutletExcludeAria: 'Exclude {outlet} from average',
    pollSummaryHeroPartiesChartOutletIncludeAria: 'Include {outlet} in average',
    pollSummaryHeroPartiesChartOutletHint:
      'Click an outlet icon to include or exclude it from the average',
    pollSummaryHeroTrendPanelTitle: 'Cross-outlet average · {n}-day window',
    pollSummaryHeroPartyTrendOpenAria: 'Show cross-outlet average seat trend for {party}',
    pollSummaryHeroPartyTrendNoData: 'No poll history for this party in the window.',
    pollSummaryRowsAria: 'Latest poll per outlet in window',
    pollSummaryChangedPartiesAria:
      'All parties with seats in the latest poll; mandate changes vs previous poll highlighted',
    pollSummaryUnifiedPartyNamesAria: 'Party columns ordered by cross-outlet average rank',
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
    rotateLandscapeTitle: 'Rotate to landscape',
    rotateLandscapeDismiss: 'Got it',

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
    pollSummaryOutletsBreakdownTail:
      ' (ירוק/אדום = שינוי מול סקר קודם; נקודה אפורה = חריג מול שאר הערוצים; שתי נקודות = חריג יותר)',
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
      'ממוצע מנדטים לפי מפלגה בין הערוצים בחלון; שינוי מול הסקר הקודם מודגש; המספר בסוגריים = כמה סקרים הציגו את השינוי',
    pollSummaryChipDeltaOutletCountTitle: '{n} סקרים עם שינוי מול הסקר הקודם',
    pollSummaryHeroChipOutletCountLegend: '(מספר) = סקרים עם שינוי מול הסקר הקודם',
    pollSummaryHeroChipDeltaColorLegend: 'ירוק/אדום = שינוי מול סקר קודם',
    pollSummaryHeroPartiesChartOpenAria: 'הצג פירוט ממוצע מנדטים לפי מפלגה בין הערוצים',
    pollSummaryHeroPartiesChartTitle: 'ממוצע מנדטים לפי מפלגה בין הערוצים',
    pollSummaryHeroPartiesChartCloseAria: 'סגור פירוט מפלגות',
    pollSummaryHeroPartiesChartWindowSuffix: ' · חלון {n} ימים',
    pollSummaryHeroPartiesChartOutletsAria:
      'ערוצים בחלון הסקרים; לחיצה לכלילה או הוצאה מהממוצע',
    pollSummaryHeroPartiesChartOutletExcludeAria: 'הוצא את {outlet} מהממוצע',
    pollSummaryHeroPartiesChartOutletIncludeAria: 'כלול את {outlet} בממוצע',
    pollSummaryHeroPartiesChartOutletHint:
      'לחצו על ערוץ כדי לכלול או להוציא אותו מהממוצע',
    pollSummaryHeroTrendPanelTitle: 'ממוצע ערוצים · חלון {n} ימים',
    pollSummaryHeroPartyTrendOpenAria: 'הצג מגמת מנדטים ממוצעת בין ערוצים עבור {party}',
    pollSummaryHeroPartyTrendNoData: 'אין היסטוריית סקרים למפלגה זו בחלון.',
    pollSummaryRowsAria: 'הסקר האחרון לכל כלי תקשורת בחלון',
    pollSummaryChangedPartiesAria:
      'כל המפלגות עם מנדטים בסקר האחרון; שינוי מול סקר קודם מסומן ב-Δ',
    pollSummaryUnifiedPartyNamesAria: 'עמודות מפלגות לפי דירוג ממוצע בין הערוצים',
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
    rotateLandscapeTitle: 'סובבו את המכשיר לרוחב',
    rotateLandscapeDismiss: 'הבנתי',

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
