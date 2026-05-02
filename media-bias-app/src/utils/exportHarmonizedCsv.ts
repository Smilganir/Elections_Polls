import type { UnpivotRow } from '@shared/types/data'

const COLUMNS: (keyof UnpivotRow)[] = [
  'pollId',
  'date',
  'respondents',
  'mediaOutlet',
  'pollster',
  'mediaIndex',
  'party',
  'votes',
  'votesRank',
]

function escapeCsvField(v: string | number): string {
  const s = String(v)
  if (/[,"\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/** Sheet-style CSV of harmonized rows (UTF-8 BOM for Excel + Hebrew). */
export function harmonizedRowsToCsv(rows: UnpivotRow[]): string {
  const header = COLUMNS.join(',')
  const body = rows.map(r => COLUMNS.map(k => escapeCsvField(r[k])).join(',')).join('\r\n')
  return `${header}\r\n${body}`
}

export function downloadHarmonizedCsv(rows: UnpivotRow[], filenameBase = 'harmonized'): void {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const csv = harmonizedRowsToCsv(rows)
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
