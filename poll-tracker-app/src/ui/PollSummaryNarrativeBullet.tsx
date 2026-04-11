import type { ReactNode } from 'react'
import {
  PARTY_ICON_MAP,
  PARTY_SEGMENT_BY_KEY,
  segmentRingColorForSummary,
} from '../config/mappings'
import type { Segment } from '../types/data'
import { IconWithFallback } from './IconWithFallback'
import { narrativeHtmlWithBlocHighlights } from './pollNarrativeHtml'

/** Map shorthand / display names in JSON tokens → canonical PARTY_ICON_MAP keys */
const PARTY_TOKEN_ALIASES: Record<string, string> = {
  Bennett: "Bennett's Party",
  Lieberman: 'Yisrael Beiteinu',
}

function resolvePartyKey(raw: string): string {
  const k = raw.trim()
  if (PARTY_ICON_MAP[k]) return k
  const alias = PARTY_TOKEN_ALIASES[k]
  if (alias && PARTY_ICON_MAP[alias]) return alias
  return k
}

function segmentForNarrativeParty(partyKey: string): Segment {
  return PARTY_SEGMENT_BY_KEY[partyKey] ?? 'Opposition'
}

function NarrativePartyIcon({
  partyKey,
  displayParty,
  mergeArabsWithOpposition,
}: {
  partyKey: string
  displayParty: (partyKey: string) => string
  mergeArabsWithOpposition: boolean
}) {
  const src = PARTY_ICON_MAP[partyKey]
  const label = displayParty(partyKey)
  const segment = segmentForNarrativeParty(partyKey)
  const ringColor = segmentRingColorForSummary(segment, mergeArabsWithOpposition)
  return (
    <span className="lpo-ps-narrative-party-ico-wrap" title={label}>
      <span className="lpo-ps-narrative-party-ico">
        <span
          className="lpo-ps-narrative-party-ico-ring"
          style={{ boxShadow: `inset 0 0 0 2px ${ringColor}` }}
        >
          <IconWithFallback src={src} label={label} />
        </span>
      </span>
    </span>
  )
}

function parseNarrativeBullet(
  html: string,
  displayParty: (partyKey: string) => string,
  bulletIndex: number,
  mergeArabsWithOpposition: boolean,
): ReactNode[] {
  const re = /\[\[party:([^\]]+)\]\]/g
  const out: ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  let part = 0
  while ((m = re.exec(html)) !== null) {
    if (m.index > last) {
      const chunk = html.slice(last, m.index)
      out.push(
        <span
          key={`${bulletIndex}-t-${part++}`}
          // sanitized fragment; may include <strong> etc.
          dangerouslySetInnerHTML={{ __html: narrativeHtmlWithBlocHighlights(chunk) }}
        />,
      )
    }
    const resolved = resolvePartyKey(m[1])
    out.push(
      <NarrativePartyIcon
        key={`${bulletIndex}-p-${part++}`}
        partyKey={resolved}
        displayParty={displayParty}
        mergeArabsWithOpposition={mergeArabsWithOpposition}
      />,
    )
    last = re.lastIndex
  }
  if (last < html.length) {
    out.push(
      <span
        key={`${bulletIndex}-t-${part++}`}
        dangerouslySetInnerHTML={{ __html: narrativeHtmlWithBlocHighlights(html.slice(last)) }}
      />,
    )
  }
  return out
}

/** One trend bullet: HTML + optional [[party:CanonicalOrAlias]] tokens (icon immediately after token position in source — place token right after the label). */
export function PollSummaryNarrativeBulletLi({
  html,
  displayParty,
  index,
  mergeArabsWithOpposition,
}: {
  html: string
  displayParty: (partyKey: string) => string
  index: number
  mergeArabsWithOpposition: boolean
}) {
  const nodes = parseNarrativeBullet(html, displayParty, index, mergeArabsWithOpposition)
  return (
    <li>
      <span className="lpo-ps-narrative-trends-li-content">{nodes}</span>
    </li>
  )
}
