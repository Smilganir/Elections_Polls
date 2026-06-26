import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { AppLocale } from '../i18n/localeContext'
import { MB } from '../i18n/strings'

/** Bump when hint eligibility / persistence rules change so users aren't stuck on old dismiss flags. */
const STORAGE_KEY = 'mb-landscape-hint-dismissed-v2'
const PORTRAIT_MOBILE_MQ = '(max-width: 768px) and (orientation: portrait)'

function viewportSize(): { w: number; h: number } {
  const vv = window.visualViewport
  return {
    w: vv?.width ?? window.innerWidth,
    h: vv?.height ?? window.innerHeight,
  }
}

function isNarrowPortrait(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (window.matchMedia(PORTRAIT_MOBILE_MQ).matches) return true
  } catch {
    /* fall through */
  }
  const { w, h } = viewportSize()
  return Math.min(w, h) <= 768 && h >= w
}

function wasDismissed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
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

  const closeOverlay = useCallback(() => {
    setOpen(false)
    openRef.current = false
  }, [])

  const dismissAndPersist = useCallback(() => {
    persistDismissed()
    dismissedRef.current = true
    closeOverlay()
  }, [closeOverlay])

  const syncViewport = useCallback(() => {
    if (typeof window === 'undefined') return
    if (dismissedRef.current || wasDismissed()) return

    const narrowPortrait = isNarrowPortrait()

    if (narrowPortrait && !openRef.current) {
      openRef.current = true
      setOpen(true)
    } else if (!narrowPortrait && openRef.current) {
      closeOverlay()
    }
  }, [closeOverlay])

  useEffect(() => {
    dismissedRef.current = wasDismissed()
    syncViewport()

    const mq = window.matchMedia(PORTRAIT_MOBILE_MQ)
    mq.addEventListener('change', syncViewport)
    window.addEventListener('resize', syncViewport)
    window.visualViewport?.addEventListener('resize', syncViewport)

    let orientTimeout: ReturnType<typeof setTimeout> | undefined
    const onOrientationChange = () => {
      if (orientTimeout !== undefined) clearTimeout(orientTimeout)
      orientTimeout = setTimeout(syncViewport, 120)
    }
    window.addEventListener('orientationchange', onOrientationChange)

    const mountTimeout = setTimeout(syncViewport, 150)

    return () => {
      mq.removeEventListener('change', syncViewport)
      window.removeEventListener('resize', syncViewport)
      window.visualViewport?.removeEventListener('resize', syncViewport)
      window.removeEventListener('orientationchange', onOrientationChange)
      clearTimeout(mountTimeout)
      if (orientTimeout !== undefined) clearTimeout(orientTimeout)
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

  return createPortal(
    <div className="mb-rotate-hint-overlay" dir={dir} role="presentation">
      <div className="mb-rotate-hint-scrim" aria-hidden onClick={dismissAndPersist} />
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
    </div>,
    document.body,
  )
}
