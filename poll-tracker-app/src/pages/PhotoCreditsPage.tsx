import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  fetchPhotoCredits,
  photoCreditEntryId,
  photoCreditsGroupedByParty,
  type PhotoCreditRecord,
} from '../lib/photoCreditsSheet'
import { useHeroPartiesChartOverlay } from '../ui/HeroPartiesChartOverlayContext'

export function PhotoCreditsPage() {
  const { setOpen: setHeroChartOpen } = useHeroPartiesChartOverlay()
  const [searchParams] = useSearchParams()
  const [records, setRecords] = useState<PhotoCreditRecord[] | null>(null)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchPhotoCredits()
      .then((rows) => {
        if (!cancelled) setRecords(rows)
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const groups = useMemo(
    () => (records ? photoCreditsGroupedByParty(records) : []),
    [records],
  )

  useEffect(() => {
    const entry = searchParams.get('entry')
    if (!entry || !entry.startsWith('photo-credit-')) return
    const el = document.getElementById(entry)
    el?.scrollIntoView({ block: 'nearest' })
  }, [searchParams, records])

  return (
    <div className="photo-credits-page" dir="rtl">
      <header className="photo-credits-page-header">
        <h1 className="photo-credits-page-title">קרדיטי תמונות</h1>
        <p className="photo-credits-page-policy">
          התמונות מוצגות לצורך זיהוי, דיווח והנגשת מידע בלבד. זכויות התמונות שייכות לבעליהן.
          לבקשת הסרה או תיקון קרדיט -{' '}
          <a href="mailto:smilganir@gmail.com">צרו קשר</a>.
        </p>
        <p className="photo-credits-page-back">
          <Link
            to="/?map=1"
            onClick={() => setHeroChartOpen(true)}
          >
            ← חזרה למפה
          </Link>
        </p>
      </header>

      {loadError ? (
        <p className="photo-credits-page-status">לא ניתן לטעון את רשימת הקרדיטים.</p>
      ) : !records ? (
        <p className="photo-credits-page-status">טוען קרדיטים…</p>
      ) : (
        <div className="photo-credits-page-groups">
          {groups.map((group) => (
            <section key={group.partyHeb} className="photo-credits-party-group">
              <h2 className="photo-credits-party-title">{group.partyHeb}</h2>
              <ul className="photo-credits-party-list">
                {group.rows.map((row) => (
                  <li
                    key={`${row.partyHeb}-${row.listRank}-${row.candidateName}`}
                    id={photoCreditEntryId(row)}
                  >
                    <span className="photo-credits-row-name">{row.candidateName}</span>
                    <span className="photo-credits-row-sep" aria-hidden="true">
                      {' '}
                      ·{' '}
                    </span>
                    <span className="photo-credits-row-credit">{row.credit}</span>
                    {row.license.trim() ? (
                      <>
                        <span className="photo-credits-row-sep" aria-hidden="true">
                          {' '}
                          ·{' '}
                        </span>
                        {row.licenseUrl.trim() ? (
                          <a
                            className="photo-credits-row-link"
                            href={row.licenseUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {row.license}
                          </a>
                        ) : (
                          <span className="photo-credits-row-license">{row.license}</span>
                        )}
                      </>
                    ) : null}
                    {row.sourcePageUrl.trim() ? (
                      <>
                        <span className="photo-credits-row-sep" aria-hidden="true">
                          {' '}
                          ·{' '}
                        </span>
                        <a
                          className="photo-credits-row-link"
                          href={row.sourcePageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          מקור
                        </a>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
