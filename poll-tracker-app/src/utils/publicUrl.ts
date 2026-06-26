/** Resolve paths for files in `public/` when `base` is not `/` (e.g. GitHub Pages project site). */
export function publicUrl(path: string): string {
  const trimmed = path.startsWith('/') ? path.slice(1) : path
  const base = import.meta.env.BASE_URL || '/'
  if (base === '/') return `/${trimmed}`
  const withSlash = base.endsWith('/') ? base : `${base}/`
  return `${withSlash}${trimmed}`
}

/** Published media-bias app (sibling bundle under the same GitHub Pages site). */
export const MEDIA_BIAS_APP_URL =
  'https://smilganir.github.io/Elections_Polls/media-bias/'

/**
 * Link to the media-bias app. Dev uses `base` `/` so `publicUrl('media-bias/')` would 404 locally
 * and on github.io without the repo prefix — use the canonical Pages URL when base is `/`.
 */
export function mediaBiasAppUrl(): string {
  const base = import.meta.env.BASE_URL || '/'
  if (base === '/') return MEDIA_BIAS_APP_URL
  return publicUrl('media-bias/')
}
