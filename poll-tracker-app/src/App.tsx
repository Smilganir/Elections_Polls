import { useLocale } from './i18n/useLocale'
import { LatestPollsOverviewPage } from './pages/LatestPollsOverviewPage'
import { AppFooter } from './ui/AppFooter'
import {
  HeroPartiesChartOverlayProvider,
  useHeroPartiesChartOverlay,
} from './ui/HeroPartiesChartOverlayContext'
import { RotatePortraitHint } from './ui/RotatePortraitHint'

function AppShellFooter() {
  const { open: heroChartOpen } = useHeroPartiesChartOverlay()

  return (
    <footer className="app-footer">
      <AppFooter showKnessetMemberSources={heroChartOpen} />
    </footer>
  )
}

function AppRotateHint() {
  const { locale } = useLocale()
  return <RotatePortraitHint locale={locale} />
}

function App() {
  return (
    <HeroPartiesChartOverlayProvider>
      <div className="app-shell">
        <main className="page-content">
          <LatestPollsOverviewPage />
        </main>

        <AppShellFooter />
        <AppRotateHint />
      </div>
    </HeroPartiesChartOverlayProvider>
  )
}

export default App
