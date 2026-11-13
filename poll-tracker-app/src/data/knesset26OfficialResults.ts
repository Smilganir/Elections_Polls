/**
 * Knesset 26 official final results (Central Elections Committee, national results page).
 * Source: https://votes26.bechirot.gov.il/ ("תוצאות סופיות רשמיות"), read 2026-11-13.
 * Approved by the committee plenum on 2026-11-04.
 * Totals: 7,331,981 eligible; 5,717,397 voted; 5,691,426 valid; 25,971 invalid.
 * Keys are the canonical unpivot party keys used by the dashboard.
 */
export const K26_RESULTS_SOURCE_URL = 'https://votes26.bechirot.gov.il/'
export const K26_RESULTS_VALID_VOTES = 5_691_426
export const K26_RESULTS_ELECTION_DAY = '2026-10-27'

export type OfficialListResult = { letters: string; seats: number; votes: number }

export const KNESSET26_OFFICIAL_BY_PARTY_KEY: Record<string, OfficialListResult> = {
  Likud: { letters: 'מחל', seats: 27, votes: 1_167_591 },
  'Yashar!': { letters: 'דרך', seats: 21, votes: 913_629 },
  "Bennett's Party": { letters: 'רק', seats: 12, votes: 532_018 },
  'Joint Arab List': { letters: 'ודם', seats: 11, votes: 500_755 },
  'The Democrats': { letters: 'אמת', seats: 8, votes: 366_278 },
  "Ra'am": { letters: 'עם', seats: 8, votes: 337_720 },
  'Yisrael Beiteinu': { letters: 'ל', seats: 7, votes: 337_450 },
  'Otzma Yehudit': { letters: 'ב', seats: 7, votes: 326_793 },
  UTJ: { letters: 'ג', seats: 7, votes: 312_632 },
  Shas: { letters: 'שס', seats: 6, votes: 299_533 },
  'Religious Zionism': { letters: 'ט', seats: 6, votes: 290_549 },
  'Bayit Yehudi–The Reservists': { letters: 'די', seats: 0, votes: 155_199 },
  "Ofer Winter's Party": { letters: 'ך', seats: 0, votes: 95_764 },
  'Blue & White': { letters: 'כן', seats: 0, votes: 0 },
}
