/**
 * Resolve a path that lives in poll-tracker-app/public (e.g. /media/icon.png,
 * /parties/icon.png) to a usable URL in both dev and prod.
 *
 * Dev:  Vite's sharedAssetsPlugin serves these paths directly from
 *       poll-tracker-app/public, so /media/icon.png works as-is.
 *
 * Prod: deployed under /<repo>/media-bias/ inside the same Pages site as the tracker.
 *       Shared assets from poll-tracker `public/` are at /<repo>/media/ and /<repo>/parties/.
 *       We derive that parent base by stripping the final path segment from `import.meta.env.BASE_URL`.
 */
export function sharedPublicUrl(assetPath: string): string {
  const clean = assetPath.startsWith('/') ? assetPath.slice(1) : assetPath
  if (import.meta.env.DEV) return `/${clean}`
  // e.g. BASE_URL /Elections_Polls/media-bias/ → parentBase /Elections_Polls/
  const base = import.meta.env.BASE_URL || '/'
  const parentBase = base.replace(/\/[^/]+\/?$/, '/') || '/'
  return `${parentBase}${clean}`
}
