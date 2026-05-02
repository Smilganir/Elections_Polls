import type { AppLocale } from './localeContext'

export type MbUiStrings = {
  // App shell
  appTitle: string
  appSubtitle: string
  /** Browser tab title (sync with locale toggle) */
  documentTitle: string
  backToPollTracker: string
  dataLabel: string
  designLabel: string
  loading: string
  loadFailed: string
  loadFailedCheck: string
  localeToggleAria: string
  /** One-time portrait hint on narrow phones */
  rotateLandscapeTitle: string
  rotateLandscapeDismiss: string
  /** Download harmonized unpivot (Arab merge applied) as CSV */
  exportHarmonizedCsv: string
  exportHarmonizedCsvAria: string
  /** LOO residual row-level status (matches current min-polls, outlet filter, baseline window) */
  exportResidualDiagnosticsCsv: string
  exportResidualDiagnosticsAria: string
  /** Icon beside locale opens CSV popup */
  exportDataMenuAria: string
  /** Popup heading above export actions */
  exportPopoverTitle: string
  /** Residual export row disabled until panel registers */
  exportResidualWaitingTooltip: string

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
  heatmapSubtitle: string
  sortToggleAria: string
  /** Bold label above bias-column sort controls (total significant residual column) */
  heatmapBiasColTotalLabel: string
  /** Small label above Bias / Seats row-sort toggle in heatmap header */
  sortByCaption: string
  sortToggleBias: string
  sortToggleSeats: string
  biasColHeader: string
  biasColHeaderTooltip: string
  legendOver: string
  legendUnder: string
  legendFdr: string
  /** Mean threshold for dimmed cell digits (heatmap legend tail, styled muted) */
  legendMeanUnderHalfSeats: string
  noData: string

  // Bloc legend labels (corner cell)
  coalition: string
  opposition: string
  /** Hebrew display name for the synthetic ARAB_COMBINED party key */
  arabCombinedHe: string

  // Bloc Tilt section
  /** Bloc tilt explainer below the tilt grid */
  blocTiltSubtitleLead: string
  tiltLabelOpposition: string
  tiltLabelCoalition: string
  /** Column header above Knesset 25 final-poll coalition vs certified seats */
  tiltCoalPollVsActualCaption: string
  /** Accessible description for coalition bullet gauge */
  tiltCoalPollGaugeAria: (pollSeats: number, actualSeats: number) => string
  /** Coalition legend: parties (muted); certified result clause (gold in CSS) */
  tiltCoalGaugeLegendLead: string
  tiltCoalGaugeLegendGold: string

  // Track Record (bloc tilt rows)
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
    appTitle: 'House Effect Index',
    appSubtitle:
      'Analysis of biases and statistical significance in Israeli election polls',
    documentTitle: 'House Effect Index — Israeli election polls',
    backToPollTracker: '← Poll Tracker',
    dataLabel: 'Data:',
    designLabel: 'Design:',
    loading: 'Loading poll data…',
    loadFailed: 'Failed to load data',
    loadFailedCheck: 'Check that VITE_GOOGLE_SHEETS_API_KEY is set in media-bias-app/.env',
    localeToggleAria: 'Interface language',
    rotateLandscapeTitle: 'Rotate to landscape',
    rotateLandscapeDismiss: 'Got it',
    exportHarmonizedCsv: 'Export harmonized CSV',
    exportHarmonizedCsvAria: 'Download harmonized poll table as CSV (Arab list merge per settings)',
    exportResidualDiagnosticsCsv: 'Export residual diagnostics',
    exportResidualDiagnosticsAria:
      'Download CSV: each filtered row with LOO baseline status (included vs skipped_no_baseline) and residuals when included',
    exportDataMenuAria: 'Open CSV downloads',
    exportPopoverTitle: 'Download CSV',
    exportResidualWaitingTooltip: 'Waiting for analysis panel…',

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
    tabHeatmap: 'Heatmap',
    tabBlocTilt: 'Bloc Tilt',
    tabAnomalies: 'Anomalies',

    // Heatmap
    heatmapSubtitle:
      'Each cell = mean raw residual (outlet seats \u2212 LOO cross-outlet baseline). Gold border = p<0.05 after BH-FDR. Dimmer digits when mean < 0.5 seats (readability only; can still be significant).',
    sortToggleAria: 'Sort party rows',
    heatmapBiasColTotalLabel: 'Total',
    sortByCaption: 'Sort by',
    sortToggleBias: 'Bias',
    sortToggleSeats: 'Seats',
    biasColHeader: 'Bias',
    biasColHeaderTooltip:
      'Sum of raw residual (outlet \u2212 LOO baseline) across outlets where that cell is p<0.05 after BH-FDR. Outlets without a gold border do not contribute. Empty means no outlet is significant for this party.',
    legendOver: 'Over-reports',
    legendUnder: 'Under-reports',
    legendFdr: 'p<0.05 (FDR)',
    legendMeanUnderHalfSeats: 'mean < 0.5 seats',
    noData: 'No data yet \u2014 adjust window or min-n settings.',

    // Bloc legend
    coalition: 'Coalition',
    opposition: 'Opposition',
    arabCombinedHe: 'Arab List (combined)',

    // Bloc Tilt
    blocTiltSubtitleLead:
      'Direction from Σ coalition residuals − Σ opposition residuals (raw seat means).',
    tiltLabelOpposition: '\u2190 Opposition tilt',
    tiltLabelCoalition: 'Coalition tilt \u2192',
    tiltCoalPollVsActualCaption: 'Final poll bloc (Nov 2022)',
    tiltCoalPollGaugeAria: (pollSeats, actualSeats) =>
      `Predicted coalition seats from final pre-election poll: ${pollSeats}. Certified bloc result: ${actualSeats}`,
    tiltCoalGaugeLegendLead: 'Likud + Religious Zionism + Shas + UTJ seats · ',
    tiltCoalGaugeLegendGold: 'gold line = certified Nov 2022 result',

    // Track Record
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
      'FDR (false discovery rate): we test hundreds of outlet×party cells together; uncorrected p-values would wrongly flag lots of pairs as “significant”. Benjamini–Hochberg (BH‑FDR) adjusts p-values so the overall mistake rate stays controlled under many comparisons.\n\n“FDR Min” is how many qualifying poll rows a cell needs before it enters BH. Below that, grey cells skip FDR (no adjusted p-value) but still pick up colour from the mean residual; a gold border means BH‑adjusted p<0.05.',
    infoMethodologyTitle: 'Methodology',
    infoMethodology:
      'A house effect means an outlet systematically reports higher or lower seats for some parties than peer outlets—a relative pattern, not a verdict on accuracy.\n\nBaseline (leave-one-out): Each poll is compared to a cross-outlet mean built from everyone except that outlet (LOO). The mean is computed over polls for the same party that fall inside the baseline window (14 / 30 / 60 days ending on that poll\'s date), so your outlet cannot pull its own reference.\n\nResidual: Seats in the outlet\'s poll minus that LOO baseline (in seat units). The heatmap cell shows the average of these raw residuals for that outlet–party pair.\n\nFalse discovery rate (FDR): with hundreds of simultaneous outlet×party tests, raw p-values overstate certainty; Benjamini–Hochberg (BH‑FDR) calibrates p-values for multiplicity.\n\n“FDR Min” is how many poll rows each cell needs to enter BH correction. Cells below it skip FDR (grey) but retain colour from the mean residual; a gold border means BH‑adjusted p<0.05.\n\nExample: Outlet A shows Likud at 35 while peers average about 32 in the window ⇒ residual roughly +3 (over-reporting). Outlet B with very few polls is hidden entirely when below \"Min polls\" so one-offs do not dominate.\n\nShorter windows follow recent swings; longer windows stabilise baseline noise.',

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
    appTitle: 'מדד אפקט הבית',
    appSubtitle: 'ניתוח הטיות ומובהקות סטטיסטית בסקרי הבחירות בישראל',
    documentTitle: 'מדד אפקט הבית — סקרי בחירות בישראל',
    backToPollTracker: '\u2190 מעקב סקרים',
    dataLabel: 'נתונים:',
    designLabel: 'עיצוב:',
    loading: 'טוען נתוני סקרים\u2026',
    loadFailed: 'שגיאה בטעינת נתונים',
    loadFailedCheck: 'ודאו שהמשתנה VITE_GOOGLE_SHEETS_API_KEY מוגדר ב-media-bias-app/.env',
    localeToggleAria: 'שפת הממשק',
    rotateLandscapeTitle: 'סובבו את המכשיר לרוחב',
    rotateLandscapeDismiss: 'הבנתי',
    exportHarmonizedCsv: 'ייצוא CSV מותאם',
    exportHarmonizedCsvAria: 'הורדת טבלת הסקרים המותאמת כ-CSV (איחוד רשימות ערבים לפי ההגדרה)',
    exportResidualDiagnosticsCsv: 'ייצוא אבחון שאריות',
    exportResidualDiagnosticsAria:
      'הורדת CSV: כל שורה אחרי הפילטרים עם סטטוס קו בסיס LOO (כלול / דולג בלי בסיס) ושאריות כשהן מחושבות',
    exportDataMenuAria: 'פתיחת תפריט הורדת CSV',
    exportPopoverTitle: 'הורדת CSV',
    exportResidualWaitingTooltip: 'ממתינים לטעינת הפאנל…',

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
    tabHeatmap: 'מפת חום',
    tabBlocTilt: 'הטיית גוש',
    tabAnomalies: 'חריגות',

    // Heatmap
    heatmapSubtitle:
      'כל תא = ממוצע סטייה גולמית (מנדטי ערוץ \u2212 קו בסיס LOO). מסגרת זהובה = p<0.05 לאחר BH-FDR. טקסט עמום כשממוצע < 0.5 מנדטים (קריאות בלבד; עדיין יכול להיות מובהק).',
    sortToggleAria: 'מיון שורות לפי מפלגה',
    heatmapBiasColTotalLabel: '\u05e1\u05d4\u05f4\u05db',
    sortByCaption: 'מיין לפי',
    sortToggleBias: 'הטיה',
    sortToggleSeats: 'מנדטים',
    biasColHeader: 'הטיה',
    biasColHeaderTooltip:
      'סיכום הסטיות הגולמיות (ערוץ \u2212 קו בסיס LOO) בכל הערוכים שנמצאו מובהקים (p<0.05 BH-FDR). תאים ללא מסגרת זהובה לא נכנסים לסיכום. ריק = אף ערוץ לא מובהק עבור מפלגה זו.',
    legendOver: 'מגזים',
    legendUnder: 'מקטין',
    legendFdr: 'p<0.05 (FDR)',
    legendMeanUnderHalfSeats: 'ממוצע < 0.5 מנדטים',
    noData: 'אין נתונים — שנו הגדרות חלון או סף-n.',

    // Bloc legend
    coalition: 'קואליציה',
    opposition: 'אופוזיציה',
    arabCombinedHe: 'רשימה ערבית (משולבת)',

    // Bloc Tilt
    blocTiltSubtitleLead:
      'הכיוון נקבע לפי \u03a3 שאריות קואליציה \u2212 \u03a3 שאריות אופוזיציה (ממוצעים גולמיים במנדטים).',
    tiltLabelOpposition: '\u2190 הטיה לאופוזיציה',
    tiltLabelCoalition: 'הטיה לקואליציה \u2192',
    tiltCoalPollVsActualCaption: 'הקואליציה בסקר האחרון לפני הבחירות (נוב׳ 2022)',
    tiltCoalPollGaugeAria: (pollSeats, actualSeats) =>
      `מנדטים בלוק מהסקר השבוע האחרון לפני הבחירות: ${pollSeats}. התוצאה הרשמית בבלוק: ${actualSeats}`,
    tiltCoalGaugeLegendLead: 'סה״כ קואליציה: ליכוד, ציונות דתית, ש״ס ויהדות התורה',
    tiltCoalGaugeLegendGold: 'קו זהב = תוצאות ספירה רשמית (נוב׳ 2022)',

    // Track Record
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
      'FDR (False Discovery Rate — שיעור גילוי שווא): כשמריצים מאות השוואות ערוץ×מפלגה במקביל, ערכי p שלא מתוקנים עלולים לסמן יותר מדי תאים כ„מובהקים” בלי בסיס באמת; Benjamini–Hochberg (BH-FDR) מתאים למרובה מבחנים ומסדר את ערכי ה-p בהתאם.\n\n„מינ׳ ל-FDR" הוא צפיות מינימלי לכל תא לפני שנכנס ל-BH. מתחת לסף התא מחוץ לתיקון (אפור) אך עדיין מראה גוון מהממוצע; מסגרת זהובה = p מתוקן < 0.05.',
    infoMethodologyTitle: 'מתודולוגיה',
    infoMethodology:
      'אפקט הבית (House Effect) מתאר מצב שבו גוף מסוים מציג באופן עקבי מספר מושבים גבוה או נמוך יותר עבור מפלגות מסוימות בהשוואה לגופים אחרים. מדובר בדפוס יחסי ולא בקביעה לגבי רמת הדיוק של הסוקר.\n\n' +
      'קו הבסיס (Leave-one-out) משמש להשוואה, כאשר כל סקר מושווה לממוצע של כל שאר הגופים מלבד זה הנבדק. הממוצע מחושב על סמך סקרי אותה מפלגה בתוך טווח הזמן שנבחר (14, 30 או 60 יום לפני מועד הסקר), מה שמבטיח שהגוף הנסקר לא יטה את קו הייחוס של עצמו.\n\n' +
      'השארית (Residual) היא ההפרש בין מספר המושבים בסקר לבין קו הבסיס. התא במפת החום מציג את ממוצע השאריות הגולמיות עבור אותו שילוב של גוף סוקר ומפלגה.\n\n' +
      'שיעור גילוי שגוי (FDR) נדרש מאחר שביצוע מאות בדיקות סימולטניות עלול לנפח את רמת הוודאות הסטטיסטית. שיטת Benjamini–Hochberg מכיילת את ערכי ה-p כדי להתחשב בריבוי הבדיקות ולהימנע ממסקנות שגויות.\n\n' +
      'המדד "FDR Min" קובע כמה סקרים נדרשים בכל תא כדי להיכלל בתיקון ה-BH. תאים שאינם עומדים בסף זה ידלגו על התיקון ויוצגו באפור, אך ישמרו על צבע השארית הממוצעת. מסגרת זהב מסמנת מובהקות סטטיסטית (p<0.05) לאחר התיקון.\n\n' +
      'כדוגמה, אם גוף א\u05f3 מציג לליכוד 35 מושבים בעוד הממוצע של עמיתיו באותו חלון זמן הוא 32, השארית תהיה כ-3+ (דיווח יתר). גוף ב\u05f3 עם מספר סקרים נמוך מ-"Min polls" יוסתר לחלוטין כדי למנוע ממקרים נקודתיים להטות את התמונה הכללית.\n\n' +
      'בחירת טווח הזמן משפיעה על הנתונים: חלונות קצרים עוקבים אחר תנודות ושינויים אחרונים, בעוד שחלונות ארוכים יותר מייצבים את "רעשי הרקע" של קו הבסיס.',

    // Tooltip
    tooltipN: 'N',
    tooltipRawMean: 'ממוצע גולמי',
    tooltipDampenedMean: 'ממוצע מרוסן',
    tooltipPValue: 'ערך p',
    tooltipPAdj: 'pAdj (FDR)',
    tooltipPAdjExcluded: '\u2014 (N מתחת לסף)',
  },
}
