/** Resolve paths for files in `public/` when `base` is not `/` (e.g. GitHub Pages project site). */
export function publicUrl(path: string): string {
  const trimmed = path.startsWith('/') ? path.slice(1) : path
  const base = import.meta.env.BASE_URL || '/'
  if (base === '/') return `/${trimmed}`
  const withSlash = base.endsWith('/') ? base : `${base}/`
  return `${withSlash}${trimmed}`
}
