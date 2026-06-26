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

/** Local media-bias-app Vite dev server (see media-bias-app/vite.config.ts port). */
export const MEDIA_BIAS_DEV_URL =
  (import.meta.env.VITE_MEDIA_BIAS_DEV_URL as string | undefined)?.trim() ||
  'http://localhost:5175/'

/**
 * Link to the media-bias app.
 * Dev: standalone media-bias-app tab on localhost:5175.
 * Prod/preview: sibling bundle under the GitHub Pages base path.
 */
export function mediaBiasAppUrl(): string {
  if (import.meta.env.DEV) {
    return MEDIA_BIAS_DEV_URL.endsWith('/')
      ? MEDIA_BIAS_DEV_URL
      : `${MEDIA_BIAS_DEV_URL}/`
  }
  const base = import.meta.env.BASE_URL || '/'
  if (base === '/') return MEDIA_BIAS_APP_URL
  return publicUrl('media-bias/')
}
