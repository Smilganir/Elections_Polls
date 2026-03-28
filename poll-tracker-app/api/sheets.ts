import { google } from 'googleapis'

type Row = string[]

function readRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing env var: ${name}`)
  }
  return value
}

function parsePrivateKey(value: string): string {
  return value.replace(/\\n/g, '\n')
}

async function getRows(range: string): Promise<Row[]> {
  const clientEmail = readRequiredEnv('GOOGLE_CLIENT_EMAIL')
  const privateKey = parsePrivateKey(readRequiredEnv('GOOGLE_PRIVATE_KEY'))
  const spreadsheetId = readRequiredEnv('GOOGLE_SHEETS_SPREADSHEET_ID')

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })

  const sheets = google.sheets({ version: 'v4', auth })
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  })

  return response.data.values ?? []
}

export default async function handler(req: any, res: any) {
  try {
    const tab = typeof req.query.tab === 'string' ? req.query.tab : 'UnpivotData'
    const range = typeof req.query.range === 'string' ? req.query.range : 'A:Z'
    const rows = await getRows(`'${tab}'!${range}`)
    res.setHeader('Cache-Control', 'no-store, max-age=0')
    res.status(200).json({ tab, range, rows })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    res.status(500).json({ error: message })
  }
}
