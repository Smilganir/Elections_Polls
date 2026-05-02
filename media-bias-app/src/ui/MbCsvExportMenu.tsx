import { useEffect, useId, useRef, useState } from 'react'
import type { MbUiStrings } from '../i18n/strings'

import exportSvgMarkup from '../assets/export-data.svg?raw'

type Props = {
  t: MbUiStrings
  locale: 'en' | 'he'
  harmonizedReady: boolean
  onExportHarmonized: () => void
  /** Nullable until MediaBiasPanel registers the exporter (respects filters + baseline window). */
  residualDiagExport: (() => void) | null
}

/**
 * Glyph button beside locale toggle opens a popup with CSV export actions.
 */
export function MbCsvExportMenu({
  t,
  locale,
  harmonizedReady,
  onExportHarmonized,
  residualDiagExport,
}: Props) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const runResidual = () => {
    residualDiagExport?.()
    setOpen(false)
  }

  const runHarmonized = () => {
    if (harmonizedReady) onExportHarmonized()
    setOpen(false)
  }

  const canResidual = residualDiagExport !== null

  return (
    <div className="mb-export-menu" ref={wrapRef}>
      <button
        type="button"
        className={`mb-export-svg-btn ${open ? 'mb-export-svg-btn--open' : ''}`}
        aria-label={t.exportDataMenuAria}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={menuId}
        disabled={!harmonizedReady}
        title={harmonizedReady ? t.exportDataMenuAria : undefined}
        onClick={() => harmonizedReady && setOpen(o => !o)}
      >
        <span
          className="mb-export-svg-inline"
          // Local trusted asset — inherit `color` from button like `.lpo-mb-settings-btn` gear.
          dangerouslySetInnerHTML={{ __html: exportSvgMarkup }}
          aria-hidden
        />
      </button>

      {open && harmonizedReady && (
        <div
          id={menuId}
          role="dialog"
          aria-label={t.exportPopoverTitle}
          className="mb-export-popover"
          dir={locale === 'he' ? 'rtl' : 'ltr'}
        >
          <p className="mb-export-popover-title">{t.exportPopoverTitle}</p>
          <ul className="mb-export-popover-list">
            <li>
              <button
                type="button"
                className="mb-export-popover-item"
                onClick={runHarmonized}
                aria-label={t.exportHarmonizedCsvAria}
              >
                {t.exportHarmonizedCsv}
              </button>
            </li>
            <li>
              <button
                type="button"
                className="mb-export-popover-item"
                onClick={() => runResidual()}
                disabled={!canResidual}
                title={!canResidual ? t.exportResidualWaitingTooltip : undefined}
                aria-label={t.exportResidualDiagnosticsAria}
              >
                {t.exportResidualDiagnosticsCsv}
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}
