import { useLocale } from '../i18n/useLocale'
import { UI } from '../i18n/strings'

export function AppFooter({ showVoteSmart = false }: { showVoteSmart?: boolean }) {
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
        {showVoteSmart ? (
          <>
            {' · '}
            <a
              href="https://votesmart.co.il/"
              target="_blank"
              rel="noopener noreferrer"
            >
              votesmart.co.il
            </a>
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
