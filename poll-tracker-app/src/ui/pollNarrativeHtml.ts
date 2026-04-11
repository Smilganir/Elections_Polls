/**
 * Editorial HTML for poll summary narrative: sanitize, then highlight bloc terms
 * (coalition / opposition, EN + HE) with segment-colored spans.
 */

const TAG_SPLIT_RE = /(<\/?(?:strong|b)\b[^>]*>|<br\s*\/?>)/gi

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

/** Allow only <strong>, <b>, <br>; strip attributes and everything else. */
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
    .map((part) => (part.match(/^<\/?(?:strong|b)|^<br/i) ? part : highlightPlainSegment(part)))
    .join('')
}
