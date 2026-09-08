/**
 * Center hollow inset (% of map stage) — keeps bloc/table between wing columns.
 * Derived from wing seat coords in knessetSeatCoords.data.ts + seat dot radius.
 */
export const KNESSET_HOLLOW_INSETS = {
  left: 32,
  right: 32,
  top: 31,
  bottom: 18,
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
