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
  // #region agent log
  fetch('http://127.0.0.1:7257/ingest/07264441-9ece-43b4-ade6-685c9d4f5d70', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '1e84b6' },
    body: JSON.stringify({
      sessionId: '1e84b6',
      hypothesisId: 'H1',
      location: 'sheetsApi.ts:before-sheets-fetch',
      message: 'Context before Sheets API fetch',
      data: {
        href: typeof location !== 'undefined' ? location.href : '',
        docReferrer: typeof document !== 'undefined' ? document.referrer : '',
        baseUrl: import.meta.env.BASE_URL,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion
  // Send full page URL as Referer so GCP keys restricted to .../Elections_Polls/* match (default cross-origin is often origin-only).
  const response = await fetch(url, {
    cache: 'no-store',
    referrerPolicy: 'unsafe-url',
  })
  if (!response.ok) {
    const text = await response.text()
    // #region agent log
    let apiReason = ''
    try {
      const j = JSON.parse(text) as {
        error?: { message?: string; details?: Array<{ reason?: string }> }
      }
      apiReason = j.error?.details?.find((d) => d.reason)?.reason ?? j.error?.message ?? ''
    } catch {
      /* ignore */
    }
    fetch('http://127.0.0.1:7257/ingest/07264441-9ece-43b4-ade6-685c9d4f5d70', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '1e84b6' },
      body: JSON.stringify({
        sessionId: '1e84b6',
        hypothesisId: 'H1-H5',
        location: 'sheetsApi.ts:sheets-fetch-error',
        message: 'Sheets API error response',
        data: { status: response.status, apiReason: String(apiReason).slice(0, 160) },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
    throw new Error(`Google Sheets API failed: ${response.status} ${text}`)
  }
  // #region agent log
  fetch('http://127.0.0.1:7257/ingest/07264441-9ece-43b4-ade6-685c9d4f5d70', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '1e84b6' },
    body: JSON.stringify({
      sessionId: '1e84b6',
      hypothesisId: 'H5',
      location: 'sheetsApi.ts:sheets-fetch-ok',
      message: 'Sheets API success',
      data: { status: response.status },
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion
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
