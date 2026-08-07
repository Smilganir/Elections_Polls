import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'

type HeroPartiesChartOverlayContextValue = {
  open: boolean
  setOpen: Dispatch<SetStateAction<boolean>>
  /** When true, narrow-portrait rotate hint must wait (hero chart is open with data). */
  deferRotateHint: boolean
  setDeferRotateHint: Dispatch<SetStateAction<boolean>>
}

const HeroPartiesChartOverlayContext =
  createContext<HeroPartiesChartOverlayContextValue | null>(null)

export function HeroPartiesChartOverlayProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(true)
  const [deferRotateHint, setDeferRotateHint] = useState(true)

  const value = useMemo(
    () => ({ open, setOpen, deferRotateHint, setDeferRotateHint }),
    [open, deferRotateHint],
  )

  return (
    <HeroPartiesChartOverlayContext.Provider value={value}>
      {children}
    </HeroPartiesChartOverlayContext.Provider>
  )
}

export function useHeroPartiesChartOverlay(): HeroPartiesChartOverlayContextValue {
  const ctx = useContext(HeroPartiesChartOverlayContext)
  if (!ctx) {
    throw new Error(
      'useHeroPartiesChartOverlay must be used within HeroPartiesChartOverlayProvider',
    )
  }
  return ctx
}
