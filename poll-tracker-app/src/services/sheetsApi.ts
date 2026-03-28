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
  // Send full page URL as Referer so GCP keys restricted to .../Repo/* match when the browser would otherwise send origin-only.
  const response = await fetch(url, {
    cache: 'no-store',
    referrerPolicy: 'unsafe-url',
  })
  if (!response.ok) {
    const text = await response.text()
    const referrerBlocked = text.includes('API_KEY_HTTP_REFERRER_BLOCKED')
    const originHint =
      typeof location !== 'undefined' ? `${location.origin}/*` : 'https://YOUR_USERNAME.github.io/*'
    const hint = referrerBlocked
      ? ` Add this line under Website restrictions for the same API key, Save, wait up to 5 minutes: ${originHint}`
      : ''
    throw new Error(`Google Sheets API failed: ${response.status} ${text}${hint}`)
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

/** Dev/preview: Vite forwards to Google with your Referer so GCP website key restrictions match. */
async function fetchSheetViaSheetsKeyProxy(
  tab: string,
  range: string,
  spreadsheetId: string,
): Promise<SheetResponse> {
  const params = new URLSearchParams({ tab, range, spreadsheetId })
  const response = await fetch(`/api/sheets-key?${params.toString()}`, {
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
 * In dev/preview, uses `/api/sheets-key` so the server forwards Referer (fixes GCP referrer keys).
 * Falls back to `/api/sheets` JWT proxy when the API key is unset in .env.
 */
export async function fetchSheet(
  tab: string,
  range = 'A:Z',
): Promise<SheetResponse> {
  const spreadsheetId =
    import.meta.env.VITE_GOOGLE_SHEETS_SPREADSHEET_ID?.trim() || DEFAULT_SPREADSHEET_ID
  const apiKey = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY?.trim()

  const isVitePreview =
    typeof window !== 'undefined' &&
    import.meta.env.PROD &&
    window.location.port === '4173'

  if (import.meta.env.DEV || isVitePreview) {
    if (apiKey) {
      return fetchSheetViaSheetsKeyProxy(tab, range, spreadsheetId)
    }
    return fetchSheetViaDevProxy(tab, range)
  }

  if (apiKey) {
    return fetchSheetViaSheetsApi(tab, range, spreadsheetId, apiKey)
  }

  throw new Error(
    'Missing Google Sheets API key. For GitHub Pages: add the Actions secret VITE_GOOGLE_SHEETS_API_KEY ' +
      '(Settings → Secrets and variables → Actions). Optional: VITE_GOOGLE_SHEETS_SPREADSHEET_ID for a different sheet. ' +
      'See poll-tracker-app/.env.example. The spreadsheet must be viewable by anyone with the link.',
  )
}
