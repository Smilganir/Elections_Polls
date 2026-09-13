import { Link } from 'react-router-dom'
import type { UiStrings } from '../i18n/strings'
import {
  photoCreditCommonsSuffix,
  photoCreditDisplayMode,
  photoCreditEntryId,
  type PhotoCreditRecord,
} from '../lib/photoCreditsSheet'

export function PhotoCreditLine({
  credit,
  t,
  className = '',
  openLinksInNewTab = false,
}: {
  credit: PhotoCreditRecord | null
  t: UiStrings
  className?: string
  openLinksInNewTab?: boolean
}) {
  const mode = photoCreditDisplayMode(credit)
  if (mode === 'none' || !credit) return null

  const classNames = `lpo-ps-photo-credit${className ? ` ${className}` : ''}`

  if (mode === 'neutral') {
    return (
      <p className={classNames}>
        <Link
          className="lpo-ps-photo-credit-link"
          to={`/photo-credits?entry=${encodeURIComponent(photoCreditEntryId(credit))}`}
          target={openLinksInNewTab ? '_blank' : undefined}
          rel={openLinksInNewTab ? 'noopener noreferrer' : undefined}
        >
          {t.photoCreditNeutralLink}
        </Link>
      </p>
    )
  }

  const sourceHref = credit.sourcePageUrl.trim()
  const licenseHref = credit.licenseUrl.trim()
  const license = credit.license.trim()
  const commonsSuffix = photoCreditCommonsSuffix(sourceHref, credit.credit)

  return (
    <p className={classNames}>
      <span className="lpo-ps-photo-credit-label">{t.photoCreditImageLabel}</span>{' '}
      {sourceHref ? (
        <a
          className="lpo-ps-photo-credit-link"
          href={sourceHref}
          target="_blank"
          rel="noopener noreferrer"
        >
          {credit.credit}
        </a>
      ) : (
        <span className="lpo-ps-photo-credit-text">{credit.credit}</span>
      )}
      {license ? (
        <>
          <span className="lpo-ps-photo-credit-sep" aria-hidden="true">
            {' '}
            ·{' '}
          </span>
          {licenseHref ? (
            <a
              className="lpo-ps-photo-credit-link"
              href={licenseHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              {license}
            </a>
          ) : (
            <span className="lpo-ps-photo-credit-text">{license}</span>
          )}
        </>
      ) : null}
      {commonsSuffix ? (
        <span className="lpo-ps-photo-credit-text">{commonsSuffix}</span>
      ) : null}
    </p>
  )
}
