/**
 * Center hollow inset (% of map stage) — keeps bloc/table between wing columns.
 * Derived from wing seat coords in knessetSeatCoords.data.ts + seat dot radius.
 */
export const KNESSET_HOLLOW_INSETS = {
  left: 31,
  right: 31,
  /** Just below the arch seats (~26% + seat radius). */
  top: 30,
  /** Center floor is empty — keep a slim inset so the table can use the full U. */
  bottom: 3,
} as const

/** Fixed wing slots for מתנדנדים — filters-row band on the hemicycle wrap (not per-party). */
export const KNESSET_SWING_ANCHORS = {
  topRem: 0.18,
  wingInsetPct: 9,
  wingMaxWidthRem: 11.75,
} as const

export function knessetHollowInsetStyle(): Record<string, string> {
  const { left, right, top, bottom } = KNESSET_HOLLOW_INSETS
  return {
    '--lpo-ps-knesset-hollow-left': `${left}%`,
    '--lpo-ps-knesset-hollow-right': `${right}%`,
    '--lpo-ps-knesset-hollow-top': `${top}%`,
    '--lpo-ps-knesset-hollow-bottom': `${bottom}%`,
  }
}
