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

  const entryId = searchParams.get('entry')

  useEffect(() => {
    if (!entryId || !entryId.startsWith('photo-credit-') || !records) return

    const scrollToEntry = () => {
      const el = document.getElementById(entryId)
      if (!el) return
      const stickyBar = document.querySelector('.photo-credits-page-sticky-back')
      const stickyHeight = stickyBar?.getBoundingClientRect().height ?? 0
      const top = el.getBoundingClientRect().top + window.scrollY - stickyHeight - 8
      window.scrollTo({ top: Math.max(0, top), behavior: 'auto' })
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(scrollToEntry)
    })
  }, [entryId, records])

  return (
    <div className="photo-credits-page" dir="rtl">
      <div className="photo-credits-page-sticky-back">
        <div className="photo-credits-page-sticky-back-inner">
          <p className="photo-credits-page-back">
            <Link
              to="/?map=1"
              onClick={() => setHeroChartOpen(true)}
            >
              ← חזרה למפה
            </Link>
          </p>
        </div>
      </div>
      <header className="photo-credits-page-header">
        <h1 className="photo-credits-page-title">קרדיטי תמונות</h1>
        <p className="photo-credits-page-policy">
          התמונות מוצגות לצורך זיהוי, דיווח והנגשת מידע בלבד. זכויות התמונות שייכות לבעליהן.
          לבקשת הסרה או תיקון קרדיט -{' '}
          <a href="mailto:smilganir@gmail.com">צרו קשר</a>.
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
                {group.rows.map((row) => {
                  const rowEntryId = photoCreditEntryId(row)
                  return (
                  <li
                    key={`${row.partyHeb}-${row.listRank}-${row.candidateName}`}
                    id={rowEntryId}
                    className={
                      entryId === rowEntryId
                        ? 'photo-credits-party-list-item--highlighted'
                        : undefined
                    }
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
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
