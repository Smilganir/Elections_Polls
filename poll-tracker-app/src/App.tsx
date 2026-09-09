import { useLocale } from './i18n/useLocale'
import { LatestPollsOverviewPage } from './pages/LatestPollsOverviewPage'
import { AppFooter } from './ui/AppFooter'
import {
  HeroPartiesChartOverlayProvider,
  useHeroPartiesChartOverlay,
} from './ui/HeroPartiesChartOverlayContext'
import { RotateLandscapeHint } from './ui/RotateLandscapeHint'

function AppShellFooter() {
  const { open: heroChartOpen } = useHeroPartiesChartOverlay()

  return (
    <footer className="app-footer">
      <AppFooter showVoteSmart={heroChartOpen} />
    </footer>
  )
}

function App() {
  const { locale } = useLocale()

  return (
    <HeroPartiesChartOverlayProvider>
      <RotateLandscapeHint locale={locale} />
      <div className="app-shell">
        <main className="page-content">
          <LatestPollsOverviewPage />
        </main>

        <AppShellFooter />
      </div>
    </HeroPartiesChartOverlayProvider>
  )
}

export default App
