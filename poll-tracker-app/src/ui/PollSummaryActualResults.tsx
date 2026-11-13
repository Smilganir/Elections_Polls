import dayjs from 'dayjs'
import { useMemo } from 'react'
import { PARTY_ICON_MAP } from '../config/mappings'
import {
  K26_RESULTS_SOURCE_URL,
  K26_RESULTS_VALID_VOTES,
  KNESSET26_OFFICIAL_BY_PARTY_KEY,
} from '../data/knesset26OfficialResults'
import type { AppLocale } from '../i18n/localeContext'
import type { UiStrings } from '../i18n/strings'
import { lastPollByParty } from '../lib/actualResults'
import type { RollingPoll } from '../lib/pollRollingWindow'
import { IconWithFallback } from './IconWithFallback'

function fmtSeats(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

export function PollSummaryActualResults({
  polls,
  partyOrder,
  locale,
  t,
  displayParty,
}: {
  polls: readonly RollingPoll[]
  partyOrder: readonly string[]
  locale: AppLocale
  t: UiStrings
  displayParty: (partyKey: string) => string
}) {
  const dateFmt = locale === 'he' ? 'DD/MM/YYYY' : 'M/D/YYYY'
  const rows = useMemo(() => {
    const keys = [
      ...new Set([
        ...partyOrder,
        ...Object.entries(KNESSET26_OFFICIAL_BY_PARTY_KEY)
          .filter(([, r]) => r.seats > 0)
          .map(([k]) => k),
      ]),
    ]
    const last = lastPollByParty(polls, keys)
    return keys
      .map((party) => ({
        party,
        official: KNESSET26_OFFICIAL_BY_PARTY_KEY[party] ?? null,
        last: last.get(party) ?? null,
      }))
      .filter((r) => r.official != null || r.last != null)
      .sort(
        (a, b) =>
          (b.official?.votes ?? -1) - (a.official?.votes ?? -1) ||
          (b.last?.seats ?? 0) - (a.last?.seats ?? 0),
      )
  }, [polls, partyOrder])

  const dir = locale === 'he' ? 'rtl' : 'ltr'
  return (
    <section className="lpo-ps-actual" dir={dir} aria-label={t.actualResultsTitle}>
      <h3 className="lpo-ps-actual-title">{t.actualResultsTitle}</h3>
      <p className="lpo-ps-actual-source">
        <a href={K26_RESULTS_SOURCE_URL} target="_blank" rel="noopener noreferrer">
          {t.actualResultsSource}
        </a>
      </p>
      <div className="lpo-ps-actual-grid" role="table">
        <div className="lpo-ps-actual-row lpo-ps-actual-row--head" role="row">
          <span role="columnheader">{t.actualResultsColParty}</span>
          <span role="columnheader">{t.actualResultsColActual}</span>
          <span role="columnheader">{t.actualResultsColLastPoll}</span>
          <span role="columnheader">{t.actualResultsColDiff}</span>
        </div>
        {rows.map(({ party, official, last }) => {
          const diff = official && last ? official.seats - last.seats : null
          const pct = official
            ? ((official.votes / K26_RESULTS_VALID_VOTES) * 100).toFixed(2)
            : null
          return (
            <div className="lpo-ps-actual-row" role="row" key={party}>
              <span className="lpo-ps-actual-party" role="cell">
                <span className="lpo-ps-actual-ring">
                  <IconWithFallback src={PARTY_ICON_MAP[party]} label={displayParty(party)} />
                </span>
                <span className="lpo-ps-actual-name">{displayParty(party)}</span>
              </span>
              <span className="lpo-ps-actual-cell" role="cell" dir="ltr">
                {official ? (
                  <>
                    <strong className="lpo-ps-actual-num">{official.seats}</strong>
                    <span className="lpo-ps-actual-sub">{pct}%</span>
                  </>
                ) : (
                  <span className="lpo-ps-actual-noinfo" dir={dir}>
                    {t.actualResultsNoInfo}
                  </span>
                )}
              </span>
              <span
                className="lpo-ps-actual-cell"
                role="cell"
                dir="ltr"
                title={last ? last.outlets.join(', ') : undefined}
              >
                {last ? (
                  <>
                    <strong className="lpo-ps-actual-num lpo-ps-actual-num--poll">
                      {fmtSeats(last.seats)}
                    </strong>
                    <span className="lpo-ps-actual-sub">{dayjs(last.date).format(dateFmt)}</span>
                    {last.pollsCount > 1 ? (
                      <span className="lpo-ps-actual-sub" dir={dir}>
                        {t.actualResultsPollsCount.replace('{n}', String(last.pollsCount))}
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span className="lpo-ps-actual-noinfo" dir={dir}>
                    {t.actualResultsNoInfo}
                  </span>
                )}
              </span>
              <span
                className={
                  'lpo-ps-actual-cell lpo-ps-actual-diff' +
                  (diff == null || Math.abs(diff) < 0.05
                    ? ''
                    : diff > 0
                      ? ' lpo-ps-actual-diff--up'
                      : ' lpo-ps-actual-diff--down')
                }
                role="cell"
                dir="ltr"
              >
                {diff == null ? (
                  <span className="lpo-ps-actual-noinfo" dir={dir}>
                    {t.actualResultsNoInfo}
                  </span>
                ) : (
                  <strong>
                    {Math.abs(diff) < 0.05
                      ? '0'
                      : `${diff > 0 ? '+' : '−'}${fmtSeats(Math.abs(Math.round(diff * 10) / 10))}`}
                  </strong>
                )}
              </span>
            </div>
          )
        })}
      </div>
      <p className="lpo-ps-actual-foot">{t.actualResultsFootnote}</p>
    </section>
  )
}
