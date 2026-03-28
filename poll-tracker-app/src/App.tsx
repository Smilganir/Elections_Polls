import { UI } from './i18n/strings'
import { useLocale } from './i18n/useLocale'
import { LatestPollsOverviewPage } from './pages/LatestPollsOverviewPage'

function AppFooter() {
  const { locale } = useLocale()
  const t = UI[locale]
  return (
    <>
      <span>
        {t.data}{' '}
        <a
          href="https://themadad.com/allpolls/"
          target="_blank"
          rel="noopener noreferrer"
        >
          themadad.com/allpolls
        </a>
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

function App() {
  return (
    <div className="app-shell">
      <main className="page-content">
        <LatestPollsOverviewPage />
      </main>

      <footer className="app-footer">
        <AppFooter />
      </footer>
    </div>
  )
}

export default App
