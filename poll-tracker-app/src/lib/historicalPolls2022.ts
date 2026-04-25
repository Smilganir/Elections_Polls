/**
 * Knesset 25 (November 1, 2022) historical election data.
 *
 * knesset2022Actual   — official certified results; party names keyed to the
 *                       app's canonical convention. 16 entries; seat-holders
 *                       sum to exactly 120.
 * knesset2022FinalPolls — each outlet's last published poll before election
 *                         day (Oct 28–31 2022). Used exclusively by
 *                         computeHistoricalAccuracy(); has no effect on the
 *                         30-day rolling baseline pipeline.
 *
 * NOTE (spec §"Note re: knesset2022Actual duplication"): if knessetBenchmark.ts
 * is ever added for PollSummaryPanel deltas, it should re-export KNESSET_2022_SEATS
 * from here rather than redefine the same numbers.
 */

/**
 * Official Knesset 25 results (Nov 1 2022).
 * 16 parties listed; those that did not clear the 3.25 % threshold carry 0.
 * Seats from parties that ran as alliances are attributed to the alliance key
 * (e.g. "Religious Zionism" = RZ party + Otzma Yehudit + Noam = 14 total).
 */
export const knesset2022Actual: Record<string, number> = {
  Likud: 32,
  'Yesh Atid': 24,
  'Religious Zionism': 14,   // Full alliance: RZ (7) + Otzma Yehudit (6) + Noam (1)
  'Blue & White': 12,        // National Unity (Gantz); app uses "Blue & White" label
  Shas: 11,
  UTJ: 7,
  'Yisrael Beiteinu': 6,
  "Ra'am": 5,
  "Hadash Ta'al": 5,
  'The Democrats': 4,        // Labor 2022 seats; app now uses merged "The Democrats" label
  Meretz: 0,                 // 3.16 % — just below the 3.25 % threshold
  Balad: 0,                  // 2.90 % — below threshold
  'Otzma Yehudit': 0,        // Ran within Religious Zionism alliance; not listed separately
  Noam: 0,                   // Ran within Religious Zionism alliance; not listed separately
  'New Hope': 0,             // Ran within National Unity alliance
  Yamina: 0,                 // Ran within National Unity alliance
}

/**
 * Each outlet's final published poll before Knesset 25 (Oct 28–31 2022).
 *
 * Party keys use the same convention as the live app (e.g. "Blue & White",
 * "The Democrats" for what was then called Labor). The comparison-key
 * normalization in computeHistoricalAccuracy() handles the alliance groupings
 * (Religious Zionism alliance → actual 14; The Democrats + Meretz → actual 4).
 *
 * Outlets absent from this map (i24 news, ג׳רוזלם פוסט, וואלה, זמן ישראל,
 * מכונת האמת, ערוץ 7) show "N/A — No 2022 Data" in the track-record badge.
 */
export const knesset2022FinalPolls: Record<string, Record<string, number>> = {
  'חדשות 12': {
    Likud: 30,
    'Yesh Atid': 25,
    'Religious Zionism': 12,
    'Blue & White': 13,
    Shas: 11,
    UTJ: 7,
    'Yisrael Beiteinu': 6,
    "Ra'am": 5,
    "Hadash Ta'al": 5,
    'The Democrats': 5,
    Meretz: 4,
    Balad: 0,
  },

  'חדשות 13': {
    Likud: 31,
    'Yesh Atid': 24,
    'Religious Zionism': 13,
    'Blue & White': 13,
    Shas: 10,
    UTJ: 7,
    'Yisrael Beiteinu': 6,
    "Ra'am": 5,
    "Hadash Ta'al": 5,
    'The Democrats': 5,
    Meretz: 4,
    Balad: 0,
  },

  'כאן חדשות': {
    Likud: 29,
    'Yesh Atid': 26,
    'Religious Zionism': 12,
    'Blue & White': 14,
    Shas: 10,
    UTJ: 7,
    'Yisrael Beiteinu': 7,
    "Ra'am": 5,
    "Hadash Ta'al": 5,
    'The Democrats': 5,
    Meretz: 4,
    Balad: 0,
  },

  'ערוץ 14': {
    Likud: 33,
    'Yesh Atid': 23,
    'Religious Zionism': 15,
    'Blue & White': 12,
    Shas: 11,
    UTJ: 7,
    'Yisrael Beiteinu': 6,
    "Ra'am": 4,
    "Hadash Ta'al": 4,
    'The Democrats': 4,
    Meretz: 0,
    Balad: 0,
  },

  'מעריב': {
    Likud: 31,
    'Yesh Atid': 24,
    'Religious Zionism': 13,
    'Blue & White': 13,
    Shas: 11,
    UTJ: 7,
    'Yisrael Beiteinu': 6,
    "Ra'am": 5,
    "Hadash Ta'al": 5,
    'The Democrats': 5,
    Meretz: 4,
    Balad: 0,
  },

  'ישראל היום': {
    Likud: 32,
    'Yesh Atid': 23,
    'Religious Zionism': 14,
    'Blue & White': 11,
    Shas: 11,
    UTJ: 7,
    'Yisrael Beiteinu': 6,
    "Ra'am": 5,
    "Hadash Ta'al": 5,
    'The Democrats': 5,
    Meretz: 4,
    Balad: 0,
  },
}
