import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppLocale } from '../i18n/localeContext'
import { MB } from '../i18n/strings'

const STORAGE_KEY = 'mb-landscape-hint-dismissed-v1'
/** Max viewport width while still triggering the portrait-phone hint */
const MAX_WIDTH_PX = 520

function isNarrowPortrait(): boolean {
  if (typeof window === 'undefined') return false
  return window.innerWidth <= MAX_WIDTH_PX && window.innerHeight > window.innerWidth
}

function wasDismissed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return true
  }
}

function persistDismissed(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    /* quota / privacy mode */
  }
}

/** Tilted handset + clockwise rotation arcs (screen-rotation affordance). */
function RotateToLandscapeGlyph({ className }: { className?: string }) {
  const sw = 2.35
  return (
    <svg className={className} viewBox="0 0 92 92" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
        <path d="M 66 21 A 36 36 0 1 1 26 71" opacity={0.9} />
        <path d="M 25 70 L17 71 M25 70 L24 81" opacity={0.95} strokeWidth={2.55} />
        <path d="M 26 71 A 36 36 0 1 1 66 21" opacity={0.9} />
        <path d="M 67 22 L73 17 M67 22 L62 17" opacity={0.95} strokeWidth={2.55} />
        <g transform="translate(46 48) rotate(-36)">
          <rect x="-16" y="-26" width="32" height="52" rx="6.6" ry="6.6" />
          <rect
            x="-11.75"
            y="-19.75"
            width="23.5"
            height="37.5"
            rx="2.8"
            ry="2.8"
            opacity={0.55}
            strokeWidth={1.6}
          />
        </g>
      </g>
    </svg>
  )
}

type Props = { locale: AppLocale }

export function RotateLandscapeHint({ locale }: Props) {
  const t = MB[locale]
  const [open, setOpen] = useState(false)
  const dismissedRef = useRef(typeof window !== 'undefined' ? wasDismissed() : false)
  const openRef = useRef(false)

  const dismissAndPersist = useCallback(() => {
    persistDismissed()
    dismissedRef.current = true
    setOpen(false)
    openRef.current = false
  }, [])

  const syncViewport = useCallback(() => {
    if (typeof window === 'undefined') return
    if (dismissedRef.current) return

    const narrowPortrait = isNarrowPortrait()

    if (narrowPortrait && !openRef.current && !wasDismissed()) {
      openRef.current = true
      setOpen(true)
    } else if (!narrowPortrait && openRef.current) {
      dismissAndPersist()
    }
  }, [dismissAndPersist])

  useEffect(() => {
    dismissedRef.current = wasDismissed()
    if (!dismissedRef.current && isNarrowPortrait()) {
      syncViewport()
    }
  }, [syncViewport])

  useEffect(() => {
    window.addEventListener('resize', syncViewport)
    window.addEventListener('orientationchange', syncViewport)
    return () => {
      window.removeEventListener('resize', syncViewport)
      window.removeEventListener('orientationchange', syncViewport)
    }
  }, [syncViewport])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const dir = locale === 'he' ? 'rtl' : 'ltr'

  if (!open) return null

  return (
    <div className="mb-rotate-hint-overlay" dir={dir} role="presentation">
      <div
        className="mb-rotate-hint-scrim"
        aria-hidden
        onClick={dismissAndPersist}
      />
      <div
        className="mb-rotate-hint-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mb-rotate-hint-heading"
      >
        <RotateToLandscapeGlyph className="mb-rotate-hint-svg" />
        <h2 id="mb-rotate-hint-heading" className="mb-rotate-hint-title">
          {t.rotateLandscapeTitle}
        </h2>
        <button type="button" className="mb-rotate-hint-btn" onClick={dismissAndPersist}>
          {t.rotateLandscapeDismiss}
        </button>
      </div>
    </div>
  )
}
