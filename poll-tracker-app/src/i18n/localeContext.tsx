import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type AppLocale = 'en' | 'he'

export type LocaleContextValue = {
  locale: AppLocale
  setLocale: (l: AppLocale) => void
  toggleLocale: () => void
}

export const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<AppLocale>('he')

  useEffect(() => {
    document.documentElement.lang = locale === 'he' ? 'he' : 'en'
    document.documentElement.dir = 'ltr'
  }, [locale])

  const toggleLocale = useCallback(() => {
    setLocale((prev) => (prev === 'en' ? 'he' : 'en'))
  }, [])

  const value = useMemo(
    () => ({ locale, setLocale, toggleLocale }),
    [locale, toggleLocale],
  )

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  )
}
