import { HashRouter, Route, Routes } from 'react-router-dom'
import { useLocale } from './i18n/useLocale'
import { LatestPollsOverviewPage } from './pages/LatestPollsOverviewPage'
import { PhotoCreditsPage } from './pages/PhotoCreditsPage'
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

function PollTrackerHome() {
  return (
    <>
      <main className="page-content">
        <LatestPollsOverviewPage />
      </main>
      <AppShellFooter />
      <AppRotateHint />
    </>
  )
}

function App() {
  return (
    <HeroPartiesChartOverlayProvider>
      <HashRouter>
        <div className="app-shell">
          <Routes>
            <Route path="/" element={<PollTrackerHome />} />
            <Route path="/photo-credits" element={<PhotoCreditsPage />} />
          </Routes>
        </div>
      </HashRouter>
    </HeroPartiesChartOverlayProvider>
  )
}

export default App
