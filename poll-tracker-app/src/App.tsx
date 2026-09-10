import { LatestPollsOverviewPage } from './pages/LatestPollsOverviewPage'
import { AppFooter } from './ui/AppFooter'
import {
  HeroPartiesChartOverlayProvider,
  useHeroPartiesChartOverlay,
} from './ui/HeroPartiesChartOverlayContext'

function AppShellFooter() {
  const { open: heroChartOpen } = useHeroPartiesChartOverlay()

  return (
    <footer className="app-footer">
      <AppFooter showVoteSmart={heroChartOpen} />
    </footer>
  )
}

function App() {
  return (
    <HeroPartiesChartOverlayProvider>
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
