import type { ResidualDiagnosticRow } from '@shared/types/data'

const COLS = [
  'pollId',
  'date',
  'mediaOutlet',
  'party',
  'votes',
  'respondents',
  'pollster',
  'status',
  'baseline',
  'rawResidual',
  'statResidual',
] as const satisfies readonly (keyof ResidualDiagnosticRow)[]

function escapeCsvField(v: string | number): string {
  const s = v === '' || (typeof v === 'number' && !Number.isFinite(v)) ? '' : String(v)
  if (/[,"\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/** UTF-8 CSV (add BOM when writing) — one row per harmonized row after panel filters. */
export function residualDiagnosticsToCsv(rows: ResidualDiagnosticRow[]): string {
  const header = COLS.join(',')
  const body = rows
    .map(r =>
      COLS.map(k => {
        const v = r[k]
        if (v === null || v === undefined) return ''
        return escapeCsvField(v as string | number)
      }).join(','),
    )
    .join('\r\n')
  return `${header}\r\n${body}`
}

export function downloadResidualDiagnosticsCsv(
  rows: ResidualDiagnosticRow[],
  filenameBase = 'residual-diagnostics',
): void {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const csv = residualDiagnosticsToCsv(rows)
  const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filenameBase}-${stamp}.csv`
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
