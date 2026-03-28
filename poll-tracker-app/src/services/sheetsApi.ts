export type SheetResponse = {
  tab: string
  range: string
  rows: string[][]
}

function a1RangeForApi(tab: string, cellRange: string): string {
  const escaped = tab.replace(/'/g, "''")
  return `'${escaped}'!${cellRange}`
}

async function fetchSheetViaSheetsApi(
  tab: string,
  range: string,
  spreadsheetId: string,
  apiKey: string,
): Promise<SheetResponse> {
  const rangePath = encodeURIComponent(a1RangeForApi(tab, range))
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${rangePath}?key=${encodeURIComponent(apiKey)}`
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Google Sheets API failed: ${response.status} ${text}`)
  }
  const data = (await response.json()) as { values?: string[][] }
  const rows = data.values ?? []
  return { tab, range, rows }
}

async function fetchSheetViaDevProxy(tab: string, range: string): Promise<SheetResponse> {
  const params = new URLSearchParams({ tab, range })
  const response = await fetch(`/api/sheets?${params.toString()}`, {
    cache: 'no-store',
  })
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Sheet API failed: ${response.status} ${errorText}`)
  }
  return response.json()
}

/**
 * Loads sheet tabs at runtime (live data on GitHub Pages) when
 * `VITE_GOOGLE_SHEETS_SPREADSHEET_ID` + `VITE_GOOGLE_SHEETS_API_KEY` are set.
 * In dev, falls back to the Vite `/api/sheets` proxy + service account when those are unset.
 */
export async function fetchSheet(
  tab: string,
  range = 'A:Z',
): Promise<SheetResponse> {
  const spreadsheetId = import.meta.env.VITE_GOOGLE_SHEETS_SPREADSHEET_ID
  const apiKey = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY

  if (spreadsheetId && apiKey) {
    return fetchSheetViaSheetsApi(tab, range, spreadsheetId, apiKey)
  }

  if (import.meta.env.DEV) {
    return fetchSheetViaDevProxy(tab, range)
  }

  throw new Error(
    'Missing VITE_GOOGLE_SHEETS_SPREADSHEET_ID or VITE_GOOGLE_SHEETS_API_KEY. ' +
      'Add them for production (see .env.example). The spreadsheet must be viewable by anyone with the link (or public).',
  )
}
