import type { UnpivotRow } from '@shared/types/data'

/** Canonical sheet key — `PARTY_ICON_MAP` + EN overrides show Yahad + Bennett head. */
export const YAHD_MERGED_PARTY_KEY = "Bennett's Party"
const YESH_ATID = 'Yesh Atid'

function pollOutletKey(row: Pick<UnpivotRow, 'mediaOutlet' | 'pollId'>): string {
  return `${row.mediaOutlet}\x00${row.pollId}`
}

/**
 * Media-bias-app only: one row per (outlet, poll) for the merged Yahad line.
 * Sums `Yesh Atid` + `Bennett's Party` seat columns when both appear; relabels YA-only rows.
 */
export function mergeYeshAtidIntoBennettParty(rows: UnpivotRow[]): UnpivotRow[] {
  const passthrough: UnpivotRow[] = []
  const groups = new Map<string, UnpivotRow[]>()

  for (const row of rows) {
    if (row.party === YAHD_MERGED_PARTY_KEY || row.party === YESH_ATID) {
      const k = pollOutletKey(row)
      const g = groups.get(k)
      if (g) g.push(row)
      else groups.set(k, [row])
    } else {
      passthrough.push(row)
    }
  }

  const merged: UnpivotRow[] = []
  for (const group of groups.values()) {
    const bennett = group.filter(r => r.party === YAHD_MERGED_PARTY_KEY)
    const yesh = group.filter(r => r.party === YESH_ATID)
    let total = 0
    for (const r of bennett) {
      if (Number.isFinite(r.votes)) total += r.votes
    }
    for (const r of yesh) {
      if (Number.isFinite(r.votes)) total += r.votes
    }
    const ref = bennett[0] ?? yesh[0]
    merged.push({
      ...ref,
      party: YAHD_MERGED_PARTY_KEY,
      votes: total,
      votesRank: bennett[0]?.votesRank ?? yesh[0]?.votesRank ?? ref.votesRank,
    })
  }

  return [...passthrough, ...merged]
}
