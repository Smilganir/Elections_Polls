import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { AppLocale } from '../i18n/localeContext'
import { UI } from '../i18n/strings'

/** Bump when hint eligibility / persistence rules change so users aren't stuck on old dismiss flags. */
const STORAGE_KEY = 'lpo-ps-portrait-hint-dismissed-v2'
/** Phone landscape cap — below typical laptop window heights (e.g. 720px). */
const PHONE_LANDSCAPE_MAX_HEIGHT_PX = 500
const PHONE_LANDSCAPE_MQ = `(max-height: ${PHONE_LANDSCAPE_MAX_HEIGHT_PX}px) and (orientation: landscape) and (pointer: coarse)`

function viewportSize(): { w: number; h: number } {
  const vv = window.visualViewport
  return {
    w: vv?.width ?? window.innerWidth,
    h: vv?.height ?? window.innerHeight,
  }
}

function isCoarsePointer(): boolean {
  try {
    return window.matchMedia('(pointer: coarse)').matches
  } catch {
    return false
  }
}

function isViewportLandscape(): boolean {
  const { w, h } = viewportSize()
  return w > h
}

function isPhoneLandscape(): boolean {
  if (typeof window === 'undefined') return false
  if (!isCoarsePointer()) return false

  try {
    if (window.matchMedia(PHONE_LANDSCAPE_MQ).matches) return true
  } catch {
    /* fall through */
  }

  // Android Chrome can lag orientation media queries; viewport fallback only.
  const { h } = viewportSize()
  return isViewportLandscape() && h <= PHONE_LANDSCAPE_MAX_HEIGHT_PX
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

function RotateToPortraitGlyph({ className }: { className?: string }) {
  const sw = 2.35
  return (
    <svg className={className} viewBox="0 0 92 92" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
        <path d="M 26 21 A 36 36 0 1 1 66 71" opacity={0.9} />
        <path d="M 67 70 L75 71 M67 70 L68 81" opacity={0.95} strokeWidth={2.55} />
        <path d="M 66 71 A 36 36 0 1 1 26 21" opacity={0.9} />
        <path d="M 25 22 L19 17 M25 22 L30 17" opacity={0.95} strokeWidth={2.55} />
        <g transform="translate(46 48)">
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

type Props = {
  locale: AppLocale
  /** The `.lpo-ps-knesset-map-row--with-stats` row — hint only when this is visible. */
  statsRowRef: RefObject<HTMLElement | null>
}

export function RotatePortraitHint({ locale, statsRowRef }: Props) {
  const t = UI[locale]
  const [open, setOpen] = useState(false)
  const [statsRowVisible, setStatsRowVisible] = useState(false)
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

  useEffect(() => {
    const el = statsRowRef.current
    if (!el) {
      setStatsRowVisible(false)
      return
    }

    const scrollRoot = el.closest('.lpo-ps-hero-chart-dialog') as HTMLElement | null
    const io = new IntersectionObserver(
      ([entry]) => setStatsRowVisible(entry.isIntersecting),
      { root: scrollRoot, threshold: 0.12 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [statsRowRef])

  const syncViewport = useCallback(() => {
    if (typeof window === 'undefined') return

    if (dismissedRef.current || wasDismissed()) {
      if (openRef.current) closeOverlay()
      return
    }

    const phoneLandscape = isPhoneLandscape()

    if (!phoneLandscape) {
      if (openRef.current) closeOverlay()
      return
    }

    const shouldShow = statsRowVisible

    if (shouldShow && !openRef.current) {
      openRef.current = true
      setOpen(true)
    } else if (!shouldShow && openRef.current) {
      closeOverlay()
    }
  }, [closeOverlay, statsRowVisible])

  useEffect(() => {
    dismissedRef.current = wasDismissed()
    syncViewport()

    const mqs = [
      window.matchMedia(PHONE_LANDSCAPE_MQ),
      window.matchMedia('(pointer: coarse)'),
    ]
    const onMqChange = () => syncViewport()
    mqs.forEach((mq) => mq.addEventListener('change', onMqChange))

    window.addEventListener('resize', syncViewport)
    window.visualViewport?.addEventListener('resize', syncViewport)
    window.visualViewport?.addEventListener('scroll', syncViewport)

    const orientTimeouts: ReturnType<typeof setTimeout>[] = []
    const onOrientationChange = () => {
      orientTimeouts.forEach(clearTimeout)
      orientTimeouts.length = 0
      // Stagger remeasures — iOS/Android often update dimensions after orientationchange.
      for (const delay of [0, 80, 180, 360, 600]) {
        orientTimeouts.push(setTimeout(syncViewport, delay))
      }
    }
    window.addEventListener('orientationchange', onOrientationChange)

    const mountTimeout = setTimeout(syncViewport, 150)

    return () => {
      mqs.forEach((mq) => mq.removeEventListener('change', onMqChange))
      window.removeEventListener('resize', syncViewport)
      window.visualViewport?.removeEventListener('resize', syncViewport)
      window.visualViewport?.removeEventListener('scroll', syncViewport)
      window.removeEventListener('orientationchange', onOrientationChange)
      clearTimeout(mountTimeout)
      orientTimeouts.forEach(clearTimeout)
    }
  }, [syncViewport])

  useEffect(() => {
    syncViewport()
  }, [statsRowVisible, syncViewport])

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
    <div className="lpo-rotate-hint-overlay" dir={dir} role="presentation">
      <div className="lpo-rotate-hint-scrim" aria-hidden onClick={dismissAndPersist} />
      <div
        className="lpo-rotate-hint-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lpo-rotate-hint-heading"
      >
        <RotateToPortraitGlyph className="lpo-rotate-hint-svg" />
        <h2 id="lpo-rotate-hint-heading" className="lpo-rotate-hint-title">
          {t.rotatePortraitTitle}
        </h2>
        <button type="button" className="lpo-rotate-hint-btn" onClick={dismissAndPersist}>
          {t.rotatePortraitDismiss}
        </button>
      </div>
    </div>,
    document.body,
  )
}
