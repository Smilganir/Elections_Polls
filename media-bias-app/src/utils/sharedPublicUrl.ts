/**
 * Resolve a path that lives in poll-tracker-app/public (e.g. /media/icon.png,
 * /parties/icon.png) to a usable URL in both dev and prod.
 *
 * Dev:  Vite's sharedAssetsPlugin serves these paths directly from
 *       poll-tracker-app/public, so /media/icon.png works as-is.
 *
 * Prod: media-bias-app is deployed to /Elections/media-bias/ (merged into
 *       poll-tracker-app/dist/media-bias/ by the CI workflow). The shared
 *       assets live one level up at /Elections/media/... and /Elections/parties/...
 *       We derive the parent base by stripping the last path segment from BASE_URL.
 */
export function sharedPublicUrl(assetPath: string): string {
  const clean = assetPath.startsWith('/') ? assetPath.slice(1) : assetPath
  if (import.meta.env.DEV) return `/${clean}`
  // BASE_URL = /Elections/media-bias/ → parentBase = /Elections/
  const base = import.meta.env.BASE_URL || '/'
  const parentBase = base.replace(/\/[^/]+\/?$/, '/') || '/'
  return `${parentBase}${clean}`
}
