import type { AppLocale } from './localeContext'

export type MbUiStrings = {
  // App shell
  appTitle: string
  appSubtitle: string
  backToPollTracker: string
  dataLabel: string
  designLabel: string
  loading: string
  loadFailed: string
  loadFailedCheck: string
  localeToggleAria: string

  // Global controls
  /** Gear button: opens baseline / Arabs / min polls / FDR panel */
  settingsAria: string
  windowDaysLabel: string
  day14: string
  day30: string
  day60: string
  combineArabsLabel: string
  totalPollsLabel: string
  fdrMinNLabel: string
  significantCells: string
  excludedLowN: string

  // Tabs
  tabHeatmap: string
  tabBlocTilt: string
  tabAnomalies: string

  // Heatmap section
  heatmapSubtitle: (minN: number) => string
  sortToggleAria: string
  /** Small label above Bias / Seats row-sort toggle in heatmap header */
  sortByCaption: string
  sortToggleBias: string
  sortToggleSeats: string
  biasColHeader: string
  biasColHeaderTooltip: string
  legendOver: string
  legendUnder: string
  legendFdr: string
  legendDimmed: string
  legendDimmedExplain: string
  noData: string

  // Bloc legend labels (corner cell)
  coalition: string
  opposition: string
  /** Hebrew display name for the synthetic ARAB_COMBINED party key */
  arabCombinedHe: string

  // Bloc Tilt section
  blocTiltSubtitle: string
  tiltLabelOpposition: string
  tiltLabelCoalition: string

  // Track Record (bloc tilt rows)
  trackRecord2022: string
  trackRecordMae: string
  trackRecordBlocError: string
  trackRecordNoData: string

  // Anomaly section
  anomalySubtitle: string
  anomalyOutletLabel: string
  anomalyAllOutlets: string
  anomalyMinPollsLabel: string
  anomalyZLabel: string
  anomalyFlagged: string
  noAnomalies: string

  // Anomaly table headers
  anomalyColOutlet: string
  anomalyColDate: string
  anomalyColParty: string
  anomalyColSeats: string
  anomalyColBaseline: string
  anomalyColRawResid: string
  anomalyColZ: string

  // Info popups (filter controls)
  infoBaselineWindow: string
  infoMinPolls: string
  infoFdrMin: string
  infoMethodologyTitle: string
  infoMethodology: string

  // Tooltip
  tooltipN: string
  tooltipRawMean: string
  tooltipDampenedMean: string
  tooltipPValue: string
  tooltipPAdj: string
  tooltipPAdjExcluded: string
}

export const MB: Record<AppLocale, MbUiStrings> = {
  en: {
    // App shell
    appTitle: 'Media Bias',
    appSubtitle: 'Israel Election Polls — House Effects Analysis',
    backToPollTracker: '← Poll Tracker',
    dataLabel: 'Data:',
    designLabel: 'Design:',
    loading: 'Loading poll data…',
    loadFailed: 'Failed to load data',
    loadFailedCheck: 'Check that VITE_GOOGLE_SHEETS_API_KEY is set in media-bias-app/.env',
    localeToggleAria: 'Interface language',

    // Global controls
    settingsAria: 'Analysis settings',
    windowDaysLabel: 'Baseline\nwindow',
    day14: '14 days',
    day30: '30 days',
    day60: '60 days',
    combineArabsLabel: 'Combine\nArabs',
    totalPollsLabel: 'Min\nPolls\u00a0\u2265',
    fdrMinNLabel: 'FDR\nMin',
    significantCells: 'significant cells',
    excludedLowN: 'excluded (low-n)',

    // Tabs
    tabHeatmap: 'House Effects Heatmap',
    tabBlocTilt: 'Bloc Tilt',
    tabAnomalies: 'Anomalies',

    // Heatmap
    heatmapSubtitle: (minN) =>
      `Each cell = mean raw residual (outlet seats \u2212 LOO cross-outlet baseline). Bold border = p<0.05 after BH-FDR. Dimmed = n<${minN} (excluded from FDR pool).`,
    sortToggleAria: 'Sort party rows',
    sortByCaption: 'Sort by',
    sortToggleBias: 'Bias',
    sortToggleSeats: 'Seats',
    biasColHeader: 'Bias',
    biasColHeaderTooltip:
      'n-weighted mean of raw residual (outlet \u2212 LOO cross-outlet baseline) across all outlets, for the party in this row.',
    legendOver: 'Over-reports',
    legendUnder: 'Under-reports',
    legendFdr: 'p<0.05 (FDR)',
    legendDimmed: 'dim',
    legendDimmedExplain: 'n<min-n (FDR excluded)',
    noData: 'No data yet \u2014 adjust window or min-n settings.',

    // Bloc legend
    coalition: 'Coalition',
    opposition: 'Opposition',
    arabCombinedHe: 'Arab List (combined)',

    // Bloc Tilt
    blocTiltSubtitle:
      'Bloc tilt = \u03a3 coalition residuals \u2212 \u03a3 opposition residuals (raw seats). Positive = outlet skews Coalition; negative = skews Opposition.',
    tiltLabelOpposition: '\u2190 Opposition tilt',
    tiltLabelCoalition: 'Coalition tilt \u2192',

    // Track Record
    trackRecord2022: '2022 Track Record:',
    trackRecordMae: 'MAE',
    trackRecordBlocError: 'Bloc Error:',
    trackRecordNoData: '2022: N/A \u2014 No Data',

    // Anomaly
    anomalySubtitle:
      "Polls flagged as outliers within each outlet\u2019s own (party) history. z computed from the threshold-dampened residual; raw \u0394 shown for display.",
    anomalyOutletLabel: 'Outlet',
    anomalyAllOutlets: 'All outlets',
    anomalyMinPollsLabel: 'Outlet min\u00a0polls',
    anomalyZLabel: 'z\u00a0\u2265\u00a0',
    anomalyFlagged: 'flagged',
    noAnomalies: 'No anomalies at this threshold.',

    // Anomaly table headers
    anomalyColOutlet: 'Outlet',
    anomalyColDate: 'Date',
    anomalyColParty: 'Party',
    anomalyColSeats: 'Seats',
    anomalyColBaseline: 'Baseline',
    anomalyColRawResid: 'Raw\u00a0\u0394',
    anomalyColZ: 'z',

    // Info popups
    infoBaselineWindow:
      'How many days back we look to set the "average". We compare each outlet\'s poll numbers against what ALL the other outlets said during that same period. 30 days is a good balance — stable enough but still picks up recent shifts.',
    infoMinPolls:
      'An outlet with only 1–2 polls could look biased just by chance. This filter hides outlets with too few polls so the results are more trustworthy. The default is 5.',
    infoFdrMin:
      'To check whether a bias is real and not just random noise, we need enough data points per party. Cells with fewer than this number are greyed out and skipped in the significance test.',
    infoMethodologyTitle: 'How does this work?',
    infoMethodology:
      'Every outlet publishes polls that give each party a seat count. This tool compares each outlet\'s numbers against the average of ALL OTHER outlets for the same party in the same time window — so no biased outlet can pull the "average" in its favour.\n\nIf an outlet consistently gives a party more seats than everyone else, its cell turns cyan (over-reports). If it gives fewer, it turns pink (under-reports). A bold border means the difference is statistically significant — very unlikely to be just chance.',

    // Tooltip
    tooltipN: 'N',
    tooltipRawMean: 'Raw Mean',
    tooltipDampenedMean: 'Dampened Mean',
    tooltipPValue: 'p-value',
    tooltipPAdj: 'pAdj (FDR)',
    tooltipPAdjExcluded: '\u2014 (n below threshold)',
  },

  he: {
    // App shell
    appTitle: 'הטיית מדיה',
    appSubtitle: 'ניתוח אפקטי בית בסקרי בחירות',
    backToPollTracker: '\u2190 מעקב סקרים',
    dataLabel: 'נתונים:',
    designLabel: 'עיצוב:',
    loading: 'טוען נתוני סקרים\u2026',
    loadFailed: 'שגיאה בטעינת נתונים',
    loadFailedCheck: 'ודאו שהמשתנה VITE_GOOGLE_SHEETS_API_KEY מוגדר ב-media-bias-app/.env',
    localeToggleAria: 'שפת הממשק',

    // Global controls
    settingsAria: 'הגדרות ניתוח',
    windowDaysLabel: 'חלון\nבסיס',
    day14: '14 ימים',
    day30: '30 ימים',
    day60: '60 ימים',
    combineArabsLabel: 'איחוד\nערבים',
    totalPollsLabel: 'מינ\u05f3\nסקרים\u00a0\u2265',
    fdrMinNLabel: 'FDR\nמינ\u05f3',
    significantCells: 'תאים מובהקים',
    excludedLowN: 'מוחרגים (n נמוך)',

    // Tabs
    tabHeatmap: 'מפת חום — אפקטי בית',
    tabBlocTilt: 'הטיית גוש',
    tabAnomalies: 'חריגות',

    // Heatmap
    heatmapSubtitle: (minN) =>
      `כל תא = ממוצע סטייה גולמית (מנדטי ערוץ \u2212 קו בסיס LOO). גבול מודגש = p<0.05 לאחר תיקון BH-FDR. מעומעם = n<${minN} (מוחרג מ-FDR).`,
    sortToggleAria: 'מיון שורות לפי מפלגה',
    sortByCaption: 'מיין לפי',
    sortToggleBias: 'הטיה',
    sortToggleSeats: 'מנדטים',
    biasColHeader: 'הטיה',
    biasColHeaderTooltip:
      'ממוצע משוקלל-n של סטייה גולמית (מנדטי ערוץ מול ממוצע LOO) על פני כל הערוצים, לשורה של המפלגה הזו.',
    legendOver: 'מגזים',
    legendUnder: 'מקטין',
    legendFdr: 'p<0.05 (FDR)',
    legendDimmed: 'מעומעם',
    legendDimmedExplain: 'n<סף-n (מוחרג מ-FDR)',
    noData: 'אין נתונים — שנו הגדרות חלון או סף-n.',

    // Bloc legend
    coalition: 'קואליציה',
    opposition: 'אופוזיציה',
    arabCombinedHe: 'רשימה ערבית (משולבת)',

    // Bloc Tilt
    blocTiltSubtitle:
      'הטיית גוש = \u03a3 שאריות קואליציה \u2212 \u03a3 שאריות אופוזיציה (מנדטים גולמיים). חיובי = הערוץ מגזים לטובת קואליציה; שלילי = לטובת אופוזיציה.',
    tiltLabelOpposition: '\u2190 הטיה לאופוזיציה',
    tiltLabelCoalition: 'הטיה לקואליציה \u2192',

    // Track Record
    trackRecord2022: 'רקורד 2022:',
    trackRecordMae: 'MAE',
    trackRecordBlocError: 'שגיאת גוש:',
    trackRecordNoData: '2022: אין נתונים',

    // Anomaly
    anomalySubtitle:
      'סקרים שסומנו כחריגים בתוך ההיסטוריה של כל ערוץ (לפי מפלגה). z מחושב מהסטייה המרוסנת; סטייה גולמית מוצגת לתצוגה.',
    anomalyOutletLabel: 'ערוץ',
    anomalyAllOutlets: 'כל הערוצים',
    anomalyMinPollsLabel: 'מינ\u05f3 סקרים לערוץ',
    anomalyZLabel: 'z\u00a0\u2265\u00a0',
    anomalyFlagged: 'מסומנות',
    noAnomalies: 'אין חריגות בסף זה.',

    // Anomaly table headers
    anomalyColOutlet: 'ערוץ',
    anomalyColDate: 'תאריך',
    anomalyColParty: 'מפלגה',
    anomalyColSeats: 'מנדטים',
    anomalyColBaseline: 'קו בסיס',
    anomalyColRawResid: 'סטייה',
    anomalyColZ: 'z',

    // Info popups
    infoBaselineWindow:
      'כמה ימים אחורה אנחנו מסתכלים כדי לחשב את ה"ממוצע". אנחנו משווים את המספרים של כל ערוץ למה שכל שאר הערוצים אמרו באותה תקופה בדיוק. 30 ימים זה איזון טוב — מספיק יציב, אבל עדיין מגיב לשינויים אחרונים.',
    infoMinPolls:
      'ערוץ עם רק 1–2 סקרים עלול להיראות מוטה רק במקרה. הפילטר הזה מסתיר ערוצים עם מעט מדי סקרים כדי שהתוצאות יהיו אמינות יותר. ברירת המחדל היא 5.',
    infoFdrMin:
      'כדי לבדוק אם הטיה אמיתית ולא סתם רעש אקראי, אנחנו צריכים מספיק נקודות מידע לכל מפלגה. תאים עם פחות מהמספר הזה מעומעמים ומוחרגים מהמבחן הסטטיסטי.',
    infoMethodologyTitle: 'איך זה עובד?',
    infoMethodology:
      'כל ערוץ מדיה מפרסם סקרים שנותנים לכל מפלגה מספר מנדטים. הכלי הזה משווה את המספרים של כל ערוץ לממוצע של כל שאר הערוצים, לאותה מפלגה ובאותה תקופה — כך שאף ערוץ מוטה לא יכול "למשוך" את הממוצע לטובתו.\n\nאם ערוץ נותן למפלגה יותר מנדטים מכולם — התא הופך טורקיז (מגזים). אם פחות — ורוד (מקטין). גבול מודגש אומר שההבדל מובהק סטטיסטית — כנראה לא מקרה.',

    // Tooltip
    tooltipN: 'N',
    tooltipRawMean: 'ממוצע גולמי',
    tooltipDampenedMean: 'ממוצע מרוסן',
    tooltipPValue: 'ערך p',
    tooltipPAdj: 'pAdj (FDR)',
    tooltipPAdjExcluded: '\u2014 (N מתחת לסף)',
  },
}
