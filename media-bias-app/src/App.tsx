import { useState } from 'react'
import { useMediaBiasData } from './hooks/useMediaBiasData'
import { MediaBiasPanel } from './ui/MediaBiasPanel'
import { useLocale } from './i18n/useLocale'
import { MB } from './i18n/strings'

export default function App() {
  const [windowDays, setWindowDays] = useState(30)
  const [combineArabs, setCombineArabs] = useState(true)

  const { locale, setLocale } = useLocale()
  const t = MB[locale]

  const { data, loading, error } = useMediaBiasData(combineArabs)

  return (
    <div className="mb-app-shell">
      <header className="mb-topbar">
        <div className="mb-topbar-inner">
          <div className="mb-topbar-brand" dir={locale === 'he' ? 'rtl' : 'ltr'}>
            <h1>{t.appTitle}</h1>
            <span className="mb-topbar-sub">{t.appSubtitle}</span>
          </div>
          <nav className="mb-topbar-nav">
            <div
              className="locale-toggle"
              role="group"
              aria-label={t.localeToggleAria}
            >
              <button
                type="button"
                className={`locale-toggle-btn${locale === 'en' ? ' active' : ''}`}
                onClick={() => setLocale('en')}
              >
                EN
              </button>
              <button
                type="button"
                className={`locale-toggle-btn${locale === 'he' ? ' active' : ''}`}
                onClick={() => setLocale('he')}
              >
                עב
              </button>
            </div>
            <a href="../" className="mb-nav-link" aria-label={t.backToPollTracker}>
              {t.backToPollTracker}
            </a>
          </nav>
        </div>
      </header>

      <main className="mb-page-content">
        {loading && (
          <div className="mb-loading">
            <div className="mb-spinner" />
            <p>{t.loading}</p>
          </div>
        )}

        {error && !loading && (
          <div className="mb-error">
            <h2>{t.loadFailed}</h2>
            <pre>{error}</pre>
            <p>{t.loadFailedCheck}</p>
          </div>
        )}

        {!loading && !error && data && (
          <MediaBiasPanel
            {...data}
            windowDays={windowDays}
            onWindowDaysChange={setWindowDays}
            combineArabs={combineArabs}
            onCombineArabsChange={setCombineArabs}
          />
        )}
      </main>

      <footer className="mb-footer">
        <span>
          {t.dataLabel}{' '}
          <a href="https://themadad.com/allpolls/" target="_blank" rel="noopener noreferrer">
            themadad.com/allpolls
          </a>
        </span>
        <span className="mb-footer-divider" />
        <span>
          {t.designLabel}{' '}
          <a
            href="https://www.linkedin.com/in/%E2%80%ABnir-smilga%E2%80%AC%E2%80%8E-1a744631/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <strong>Nir Smilga</strong>
          </a>
        </span>
      </footer>
    </div>
  )
}
