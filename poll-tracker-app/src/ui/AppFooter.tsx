import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { useLocale } from '../i18n/useLocale'
import { UI } from '../i18n/strings'

const VOTESMART_CREDIT_HE =
  'בגרסה הקודמת נעשה שימוש בנתוני ״בוחרים חכ״ם״.'

const CANDIDATES_INFO_GROUPS: readonly { label: string; body: string }[] = [
  {
    label: 'רשמיים וראשוניים:',
    body: 'Knesset OData ואתר הכנסת, הלמ״ס, אתרי המפלגות והודעותיהן הרשמיות',
  },
  {
    label: 'פתוחים:',
    body: 'ויקיפדיה העברית, ויקינתונים',
  },
  {
    label: 'תקשורת:',
    body:
      'mivzaklive, ערוץ 7, ערוץ הכנסת, חדשות 10, ynet, כיכר השבת, i24, mako, עכשיו 14, כיפה, כאן 11, JDN, אייס, מעריב',
  },
]

let candidatesInfoOpen = false
let candidatesInfoAnchor: HTMLButtonElement | null = null
const candidatesInfoSubscribers = new Set<() => void>()

function subscribeCandidatesInfo(onStoreChange: () => void) {
  candidatesInfoSubscribers.add(onStoreChange)
  return () => {
    candidatesInfoSubscribers.delete(onStoreChange)
  }
}

function getCandidatesInfoOpen() {
  return candidatesInfoOpen
}

function setCandidatesInfoOpen(next: boolean, anchor: HTMLButtonElement | null = null) {
  candidatesInfoOpen = next
  candidatesInfoAnchor = next ? anchor : null
  candidatesInfoSubscribers.forEach((notify) => notify())
}

function useCandidatesInfoOpen() {
  return useSyncExternalStore(subscribeCandidatesInfo, getCandidatesInfoOpen, getCandidatesInfoOpen)
}

const CANDIDATES_POPUP_COMPACT_MQ = '(max-width: 768px)'

function clearPopupFixedPosition(popup: HTMLDivElement) {
  popup.classList.remove('app-footer-candidates-popup--fixed')
  popup.style.position = ''
  popup.style.left = ''
  popup.style.right = ''
  popup.style.bottom = ''
  popup.style.width = ''
  popup.style.maxWidth = ''
  popup.style.insetInlineStart = ''
  popup.style.insetInlineEnd = ''
}

function placePopupAboveButton(popup: HTMLDivElement, button: HTMLButtonElement) {
  const margin = 8
  const maxWidth = Math.min(352, window.innerWidth - margin * 2)
  const rect = button.getBoundingClientRect()
  let left = rect.left + rect.width / 2 - maxWidth / 2
  left = Math.max(margin, Math.min(left, window.innerWidth - maxWidth - margin))

  popup.classList.add('app-footer-candidates-popup--fixed')
  popup.style.position = 'fixed'
  popup.style.left = `${left}px`
  popup.style.right = 'auto'
  popup.style.insetInlineStart = ''
  popup.style.insetInlineEnd = ''
  popup.style.bottom = `${window.innerHeight - rect.top + 6}px`
  popup.style.width = `${maxWidth}px`
  popup.style.maxWidth = `calc(100vw - ${margin * 2}px)`
}

function CandidatesInfoButton({ leadingSep = true }: { leadingSep?: boolean }) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const open = useCandidatesInfoOpen()
  const isActive = open && candidatesInfoAnchor === buttonRef.current

  useLayoutEffect(() => {
    const popup = popupRef.current
    const button = buttonRef.current
    if (!isActive || !popup || !button) return

    const mq = window.matchMedia(CANDIDATES_POPUP_COMPACT_MQ)
    const syncPosition = () => {
      if (mq.matches) placePopupAboveButton(popup, button)
      else clearPopupFixedPosition(popup)
    }

    syncPosition()
    window.addEventListener('resize', syncPosition)
    return () => {
      window.removeEventListener('resize', syncPosition)
      clearPopupFixedPosition(popup)
    }
  }, [isActive])

  useEffect(() => {
    if (!isActive) return

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (popupRef.current?.contains(target)) return
      if (buttonRef.current?.contains(target)) return
      setCandidatesInfoOpen(false)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCandidatesInfoOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isActive])

  return (
    <span className="app-footer-candidates-info">
      {leadingSep ? (
        <span className="app-footer-source-sep" aria-hidden="true"> · </span>
      ) : null}
      <button
        ref={buttonRef}
        type="button"
        className="app-footer-candidates-info-btn"
        aria-expanded={isActive}
        aria-haspopup="dialog"
        onClick={() => {
          if (isActive) {
            setCandidatesInfoOpen(false)
            return
          }
          setCandidatesInfoOpen(true, buttonRef.current)
        }}
      >
        מידע על מועמדים
      </button>
      {isActive ? (
        <div
          ref={popupRef}
          className="app-footer-candidates-popup"
          dir="rtl"
          role="dialog"
          aria-label="מידע על מועמדים"
        >
          <button
            type="button"
            className="app-footer-candidates-popup-close"
            aria-label="סגור"
            onClick={() => setCandidatesInfoOpen(false)}
          >
            ×
          </button>
          <div className="app-footer-candidates-popup-body">
            {CANDIDATES_INFO_GROUPS.map((group) => (
              <p key={group.label} className="app-footer-candidates-popup-line">
                <strong>{group.label}</strong> {group.body}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </span>
  )
}

export function AppFooter({
  showKnessetMemberSources = false,
}: {
  showKnessetMemberSources?: boolean
}) {
  const { locale } = useLocale()
  const t = UI[locale]

  return (
    <>
      <span
        className="app-footer-data-block"
        dir={locale === 'he' ? 'rtl' : undefined}
      >
        <span>
          {t.data}{' '}
          <a
            href="https://themadad.com/allpolls/"
            target="_blank"
            rel="noopener noreferrer"
          >
            themadad.com
          </a>
        </span>
        {showKnessetMemberSources ? (
          <>
            <span className="app-footer-source-sep" aria-hidden="true"> · </span>
            <span className="app-footer-votesmart-group" dir="rtl">
              <CandidatesInfoButton leadingSep={false} />
              <span className="app-footer-votesmart-asterisk"> * </span>
              <span className="app-footer-votesmart-credit">
                {VOTESMART_CREDIT_HE}
              </span>
            </span>
          </>
        ) : null}
      </span>
      <span className="footer-divider" />
      <span>
        {t.design}{' '}
        <a
          href="https://www.linkedin.com/in/%E2%80%ABnir-smilga%E2%80%AC%E2%80%8E-1a744631/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <strong>Nir Smilga</strong>
        </a>
      </span>
    </>
  )
}
