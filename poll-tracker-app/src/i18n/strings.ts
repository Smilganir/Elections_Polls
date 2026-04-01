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
  },
}
