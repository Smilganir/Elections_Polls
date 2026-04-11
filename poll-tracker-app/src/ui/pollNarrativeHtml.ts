/**
 * Editorial HTML for poll summary narrative: sanitize, then highlight bloc terms
 * (coalition / opposition, EN + HE) with segment-colored spans.
 */

const TAG_SPLIT_RE =
  /(<\/?(?:strong|b)\b[^>]*>|<\/?span\b[^>]*>|<br\s*\/?>)/gi

/** Whitelisted `class` on `<span>` (trend bullets only). */
const NARRATIVE_SEAT_SPAN_CLASS_DOWN =
  'lpo-ps-narrative-seat lpo-ps-narrative-seat--down'
const NARRATIVE_SEAT_SPAN_CLASS_UP = 'lpo-ps-narrative-seat lpo-ps-narrative-seat--up'
const NARRATIVE_TREND_ARROW_CLASS_UP =
  'lpo-ps-narrative-party-trend-arrow lpo-ps-narrative-party-trend-arrow--up'
const NARRATIVE_TREND_ARROW_CLASS_DOWN =
  'lpo-ps-narrative-party-trend-arrow lpo-ps-narrative-party-trend-arrow--down'

/** LTR isolate so ↗/↘ stays visually left of digits in RTL Hebrew (Unicode bidi). */
export const NARRATIVE_SEAT_DELTA_RUN_CLASS = 'lpo-ps-narrative-seat-delta-run'

const ALLOWED_NARRATIVE_SPAN_CLASSES = new Set([
  NARRATIVE_SEAT_DELTA_RUN_CLASS,
  NARRATIVE_SEAT_SPAN_CLASS_DOWN,
  NARRATIVE_SEAT_SPAN_CLASS_UP,
  NARRATIVE_TREND_ARROW_CLASS_DOWN,
  NARRATIVE_TREND_ARROW_CLASS_UP,
])

/** Trend bullets: wrap rounded |Δ seats| for red/green styling (must match sanitizer whitelist). */
export function narrativeSeatMagnitudeHtml(avg: number, magnitude: number): string {
  const cls = avg > 0 ? NARRATIVE_SEAT_SPAN_CLASS_UP : NARRATIVE_SEAT_SPAN_CLASS_DOWN
  return `<span class="${cls}"><strong>${magnitude}</strong></span>`
}

/** ↗/↘ before the seat magnitude (same colors as `.lpo-ps-narrative-party-trend-arrow--up|down`). */
export function narrativeTrendArrowHtml(avg: number): string {
  const cls = avg > 0 ? NARRATIVE_TREND_ARROW_CLASS_UP : NARRATIVE_TREND_ARROW_CLASS_DOWN
  const ch = avg > 0 ? '↗' : '↘'
  return `<span class="${cls}">${ch}</span>`
}

/** Arrow immediately before seat number; wrapped in LTR isolate for correct order in RTL. */
export function narrativeSeatDeltaLeadHtml(avg: number, magnitude: number): string {
  return `<span dir="ltr" class="${NARRATIVE_SEAT_DELTA_RUN_CLASS}">${narrativeTrendArrowHtml(avg)}${narrativeSeatMagnitudeHtml(avg, magnitude)}</span>`
}

/**
 * Longer Hebrew matches first; Hebrew uses (not letter) boundaries; EN uses \b.
 * `[\u0590-\u05FF]` = Hebrew + related scripts (avoid קואליציה inside בקואליציה).
 */
const BLOC_TERM_RE =
  /(?<![\u0590-\u05FF])הקואליציה(?![\u0590-\u05FF])|(?<![\u0590-\u05FF])האופוזיציה(?![\u0590-\u05FF])|(?<![\u0590-\u05FF])קואליציה(?![\u0590-\u05FF])|(?<![\u0590-\u05FF])אופוזיציה(?![\u0590-\u05FF])|\bcoalition\b|\bopposition\b/gi

function blocKindForMatch(m: string): 'coalition' | 'opposition' {
  const lower = m.toLowerCase()
  if (lower === 'opposition' || m === 'אופוזיציה' || m === 'האופוזיציה') return 'opposition'
  return 'coalition'
}

function wrapBlocSpan(match: string, kind: 'coalition' | 'opposition'): string {
  return `<span class="lpo-ps-narrative-bloc lpo-ps-narrative-bloc--${kind}">${match}</span>`
}

function highlightPlainSegment(text: string): string {
  return text.replace(BLOC_TERM_RE, (match) => wrapBlocSpan(match, blocKindForMatch(match)))
}

/** Allow <strong>, <b>, <br>, and <span> only with whitelisted classes. */
export function sanitizeNarrativeHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\/?>/gi, (match, tag: string) => {
      const t = tag.toLowerCase()
      if (t === 'br') return '<br />'
      if (t === 'strong' || t === 'b') {
        return match.startsWith('</') ? `</${t}>` : `<${t}>`
      }
      if (t === 'span') {
        if (match.startsWith('</')) return '</span>'
        const dq = /^<\s*span\b[^>]*\bclass\s*=\s*"([^"]*)"[^>]*>/i.exec(match)
        const sq = /^<\s*span\b[^>]*\bclass\s*=\s*'([^']*)'[^>]*>/i.exec(match)
        const cls = (dq?.[1] ?? sq?.[1] ?? '').trim()
        if (cls === NARRATIVE_SEAT_DELTA_RUN_CLASS) {
          return `<span dir="ltr" class="${NARRATIVE_SEAT_DELTA_RUN_CLASS}">`
        }
        if (ALLOWED_NARRATIVE_SPAN_CLASSES.has(cls)) {
          return `<span class="${cls}">`
        }
        return ''
      }
      return ''
    })
}

/**
 * Sanitize editorial HTML, then wrap coalition/opposition words in
 * `.lpo-ps-narrative-bloc--coalition` / `--opposition` (colors from CSS).
 */
export function narrativeHtmlWithBlocHighlights(html: string): string {
  const sanitized = sanitizeNarrativeHtml(html)
  const parts = sanitized.split(TAG_SPLIT_RE)
  return parts
    .map((part) =>
      part.match(/^<\/?(?:strong|b)|^<\/?span|^<br/i) ? part : highlightPlainSegment(part),
    )
    .join('')
}
