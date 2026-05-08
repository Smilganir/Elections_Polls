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
 * Canonical wide-table source for final-poll outlet columns: Google Sheet tab
 * "Kneset 25 Results" (see KNESSET_25_RESULTS_SHEET_TABS). At runtime the
 * media-bias bundle can merge Values API output over these fallbacks via
 * parseKnesset25ResultsSheet().
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
  'Religious Zionism': 14, // Full alliance: RZ (7) + Otzma Yehudit (6) + Noam (1)
  'Blue & White': 12, // National Unity (Gantz); app uses "Blue & White" label
  Shas: 11,
  UTJ: 7,
  'Yisrael Beiteinu': 6,
  "Ra'am": 5,
  "Hadash Ta'al": 5,
  'The Democrats': 4, // Labor 2022 seats; app now uses merged "The Democrats" label
  Meretz: 0, // 3.16 % — just below the 3.25 % threshold
  Balad: 0, // 2.90 % — below threshold
  'Otzma Yehudit': 0, // Ran within Religious Zionism alliance; not listed separately
  Noam: 0, // Ran within Religious Zionism alliance; not listed separately
  'New Hope': 0, // Ran within National Unity alliance
  Yamina: 0, // Ran within National Unity alliance
}

/**
 * Certified coalition bloc seats for Knesset 25 (Likud + Religious Zionism alliance + Shas + UTJ).
 * Matches `computeHistoricalAccuracy` bloc comparison (error = poll sum − this value).
 */
export const KNESSET25_COALITION_BLOC_SEATS_ACTUAL =
  knesset2022Actual.Likud +
  knesset2022Actual['Religious Zionism'] +
  knesset2022Actual.Shas +
  knesset2022Actual.UTJ

/**
 * Each outlet's final published poll before Knesset 25 (Oct 28–31 2022).
 *
 * Party keys use the same convention as the live app (e.g. "Blue & White",
 * "The Democrats" for what was then called Labor). The comparison-key
 * normalization in computeHistoricalAccuracy() handles the alliance groupings
 * (Religious Zionism alliance → actual 14; The Democrats + Meretz → actual 4).
 *
 * Fallback when the spreadsheet tab is unreachable; synced with Elections Polls Data
 * — tab "Kneset 25 Results" (Outlet columns × party rows × Netanyahu bloc row checks).
 *
 * Outlets absent from this map (i24 news, ג׳רוזלם פוסט, וואלה, זמן ישראל,
 * מכונת האמת, ערוץ 7) show "N/A — No 2022 Data" in the track-record badge.
 */
export const knesset2022FinalPolls: Record<string, Record<string, number>> = {
  'חדשות 12': {
    Likud: 31,
    'Yesh Atid': 25,
    'Religious Zionism': 14,
    'Blue & White': 11,
    Shas: 8,
    UTJ: 7,
    'Yisrael Beiteinu': 6,
    "Ra'am": 4,
    "Hadash Ta'al": 4,
    'The Democrats': 6,
    Meretz: 4,
    Balad: 0,
  },

  'חדשות 13': {
    Likud: 31,
    'Yesh Atid': 27,
    'Religious Zionism': 14,
    'Blue & White': 11,
    Shas: 8,
    UTJ: 7,
    'Yisrael Beiteinu': 6,
    "Ra'am": 4,
    "Hadash Ta'al": 4,
    'The Democrats': 4,
    Meretz: 4,
    Balad: 0,
  },

  'כאן חדשות': {
    Likud: 31,
    'Yesh Atid': 24,
    'Religious Zionism': 14,
    'Blue & White': 11,
    Shas: 8,
    UTJ: 7,
    'Yisrael Beiteinu': 6,
    "Ra'am": 4,
    "Hadash Ta'al": 4,
    'The Democrats': 6,
    Meretz: 5,
    Balad: 0,
  },

  'ערוץ 14': {
    Likud: 34,
    'Yesh Atid': 23,
    'Religious Zionism': 11,
    'Blue & White': 12,
    Shas: 10,
    UTJ: 7,
    'Yisrael Beiteinu': 6,
    "Ra'am": 4,
    "Hadash Ta'al": 5,
    'The Democrats': 4,
    Meretz: 4,
    Balad: 0,
  },

  'מעריב': {
    Likud: 31,
    'Yesh Atid': 25,
    'Religious Zionism': 14,
    'Blue & White': 12,
    Shas: 9,
    UTJ: 6,
    'Yisrael Beiteinu': 6,
    "Ra'am": 4,
    "Hadash Ta'al": 4,
    'The Democrats': 4,
    Meretz: 5,
    Balad: 0,
  },

  'ישראל היום': {
    Likud: 30,
    'Yesh Atid': 25,
    'Religious Zionism': 15,
    'Blue & White': 11,
    Shas: 9,
    UTJ: 7,
    'Yisrael Beiteinu': 5,
    "Ra'am": 4,
    "Hadash Ta'al": 4,
    'The Democrats': 6,
    Meretz: 4,
    Balad: 0,
  },
}

/** Tab titles in Elections Polls Data; try each until one loads from the Sheets API. */
export const KNESSET_25_RESULTS_SHEET_TABS = ['Kneset 25 Results', 'Knesset 25 Results'] as const

function mapSheetPartyCell(raw: string): string | null {
  const t = raw.trim()
  if (!t || t === '---' || /^netanyahu/i.test(t)) return null

  const LUT: Record<string, string> = {
    Likud: 'Likud',
    'Yesh Atid': 'Yesh Atid',
    'Religious Zionism': 'Religious Zionism',
    'National Unity': 'Blue & White',
    Shas: 'Shas',
    UTJ: 'UTJ',
    Labor: 'The Democrats',
    Meretz: 'Meretz',
    Balad: 'Balad',
    'Yisrael Beiteinu': 'Yisrael Beiteinu',
    'Yisrael Beytenu': 'Yisrael Beiteinu',
    "Ra'am": "Ra'am",
    "Hadash Ta'al": "Hadash Ta'al",
    'Hadash-Ta\'al': "Hadash Ta'al",
  }

  if (LUT[t]) return LUT[t]

  const normHyphen = t.replace(/\u2011|\u2010/g, '-')
  const normApos = normHyphen.replace(/\u02bc|׳|'|`/g, "'")
  if (normHyphen.includes('Hadash') && /\bTa'al\b/i.test(normHyphen.replace(/'/g, "'"))) {
    return "Hadash Ta'al"
  }
  if (normApos.includes('Hadash')) return "Hadash Ta'al"

  return null
}

/** Map English / Hebrew outlet headings from wide `Kneset 25 Results` → Hebrew outlet keys (`UnpivotData`). */
function mapKnesset25OutletHeaderToHebrew(headerCell: string): string | null {
  const u = headerCell.trim().toLowerCase()
  if (!u || u === 'party' || /^actual/.test(u)) return null

  const tuple: readonly [needle: RegExp, heb: string][] = [
    [/channel\s*12|ערוץ\s*12|news\s*12/, 'חדשות 12'],
    [/channel\s*13|ערוץ\s*13/, 'חדשות 13'],
    [/kan\s*11|^כאן\b/, 'כאן חדשות'],
    [/channel\s*14|ערוץ\s*14/, 'ערוץ 14'],
    [/maariv|מעריב/, 'מעריב'],
    [/israel\s*hayom|ישראל\s*היום/, 'ישראל היום'],
    [/כלכליסט/, 'כלכליסט'],
    [/גלובס/, 'גלובס'],
  ]
  for (const [needle, heb] of tuple) {
    if (needle.test(u)) return heb
  }
  return null
}

/**
 * Parse wide rows from spreadsheet tab — Party column + Actual + outlet columns →
 * `Record<HebrewOutlet, Record<AppPartyKey, seats>>`.
 */
export function parseKnesset25ResultsSheet(rowsIn: string[][]): Record<string, Record<string, number>> {
  if (!rowsIn.length) return {}

  function trimTail(r: string[]): string[] {
    const cp = [...r]
    while (cp.length && (cp.at(-1) ?? '').trim() === '') cp.pop()
    return cp
  }
  const rows = rowsIn.map(trimTail)

  let headerIdx = rows.findIndex(
    cells =>
      cells.some(c => /^party$/i.test((c ?? '').trim())) &&
      cells.some(c => /^actual/i.test((c ?? '').trim())),
  )
  if (headerIdx < 0) {
    headerIdx = rows.findIndex(cells => cells.some(c => /^party$/i.test((c ?? '').trim())))
  }
  if (headerIdx < 0) return {}

  const header = rows[headerIdx]!.map(c => (c ?? '').trim())
  const partyCol = header.findIndex(c => /^party$/i.test(c))
  const actualIdx = header.findIndex((c, i) => i > partyCol && /^actual/i.test((c ?? '').trim()))
  const outletStartCol =
    actualIdx >= 0 ? actualIdx + 1 : partyCol >= 0 ? partyCol + 1 : 2

  if (partyCol < 0 || outletStartCol >= header.length) return {}

  const byOutlet: Record<string, Record<string, number>> = {}
  for (let c = outletStartCol; c < header.length; c++) {
    const hk = mapKnesset25OutletHeaderToHebrew(header[c] ?? '')
    if (hk) byOutlet[hk] = {}
  }

  function parseSeatCell(v: unknown): number | undefined {
    if (v == null || v === '') return undefined
    const n = Number(String(v).trim().replace(/,/g, ''))
    return Number.isFinite(n) ? n : undefined
  }

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? []
    const appParty = mapSheetPartyCell(row[partyCol] ?? '')
    if (!appParty) continue

    for (let c = outletStartCol; c < header.length; c++) {
      const hk = mapKnesset25OutletHeaderToHebrew(header[c] ?? '')
      if (!hk || !byOutlet[hk]) continue
      const n = parseSeatCell(row[c])
      if (n === undefined) continue
      byOutlet[hk]![appParty] = n
    }
  }

  return Object.fromEntries(
    Object.entries(byOutlet).filter(([, poll]) => Object.keys(poll).length > 0),
  )
}

