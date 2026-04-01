/**
 * GA4 custom event when the user toggles “merge Arabs with opposition”.
 * Visible in GA4 under Engagement → Events as `merge_arabs_toggle` (parameter `merge_on`).
 */
export function trackMergeArabsToggle(mergeOn: boolean): void {
  if (typeof window === 'undefined') return
  const g = window.gtag
  if (typeof g !== 'function') return
  g('event', 'merge_arabs_toggle', { merge_on: mergeOn })
}
