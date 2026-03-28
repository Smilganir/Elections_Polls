export type SheetResponse = {
  tab: string
  range: string
  rows: string[][]
}

/** Project default sheet; override with `VITE_GOOGLE_SHEETS_SPREADSHEET_ID` if needed. */
const DEFAULT_SPREADSHEET_ID = '1RIqzrv_ViVWBqeXkM-rOAvusoXryyRFX5Xmu2S-uEw4'

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
 * `VITE_GOOGLE_SHEETS_API_KEY` (and optionally `VITE_GOOGLE_SHEETS_SPREADSHEET_ID`) are set at build time.
 * If the spreadsheet ID is omitted, the app uses the project default sheet.
 * In dev, falls back to the Vite `/api/sheets` proxy + service account when the API key is unset.
 */
export async function fetchSheet(
  tab: string,
  range = 'A:Z',
): Promise<SheetResponse> {
  const spreadsheetId =
    import.meta.env.VITE_GOOGLE_SHEETS_SPREADSHEET_ID?.trim() || DEFAULT_SPREADSHEET_ID
  const apiKey = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY?.trim()

  if (apiKey) {
    return fetchSheetViaSheetsApi(tab, range, spreadsheetId, apiKey)
  }

  if (import.meta.env.DEV) {
    return fetchSheetViaDevProxy(tab, range)
  }

  throw new Error(
    'Missing Google Sheets API key. For GitHub Pages: add the Actions secret VITE_GOOGLE_SHEETS_API_KEY ' +
      '(Settings → Secrets and variables → Actions). Optional: VITE_GOOGLE_SHEETS_SPREADSHEET_ID for a different sheet. ' +
      'See poll-tracker-app/.env.example. The spreadsheet must be viewable by anyone with the link.',
  )
}
