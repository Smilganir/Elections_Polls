import { useEffect, useState } from 'react'
import { fetchSheet } from '../services/sheetsApi'

type DashboardFrameProps = {
  title: string
  subtitle: string
  primaryTab: string
}

export function DashboardFrame({ title, subtitle, primaryTab }: DashboardFrameProps) {
  const [rowCount, setRowCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    fetchSheet(primaryTab)
      .then((data) => {
        if (cancelled) return
        const bodyRows = Math.max(0, data.rows.length - 1)
        setRowCount(bodyRows)
        setError(null)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Unknown error')
      })

    return () => {
      cancelled = true
    }
  }, [primaryTab])

  return (
    <section className="dashboard-frame">
      <div className="dashboard-heading">
        <h2>{title}</h2>
        <p>{subtitle}</p>
        <p className="meta">
          Primary data tab: <strong>{primaryTab}</strong>
        </p>
        {rowCount !== null && <p className="meta">Rows loaded: {rowCount}</p>}
        {error && <p className="meta error">{error}</p>}
      </div>

      <div className="placeholder-grid">
        <article className="placeholder-card">
          <h3>Main timeline chart</h3>
          <p>
            This panel will reproduce the Tableau timeline with events, party
            lines, and latest values.
          </p>
        </article>
        <article className="placeholder-card">
          <h3>Filters and controls</h3>
          <p>
            Tableau parameters and worksheet actions will be mapped into React
            state controls.
          </p>
        </article>
      </div>
    </section>
  )
}
