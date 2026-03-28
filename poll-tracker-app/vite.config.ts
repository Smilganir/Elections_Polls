import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dotenv from 'dotenv'
import { google } from 'googleapis'
import type { IncomingMessage, ServerResponse } from 'http'
import { URL } from 'url'

/** App root (folder containing this config + .env), regardless of process.cwd(). */
const appDir = path.dirname(fileURLToPath(import.meta.url))
const envFilePath = path.join(appDir, '.env')

/** Values from poll-tracker-app/.env only — avoids stale GOOGLE_* in OS environment breaking the proxy. */
function readLocalEnvFile(): Record<string, string> {
  try {
    if (!fs.existsSync(envFilePath)) return {}
    return dotenv.parse(fs.readFileSync(envFilePath, 'utf-8'))
  } catch {
    return {}
  }
}

dotenv.config({ path: envFilePath })

const DEFAULT_SPREADSHEET_ID = '1RIqzrv_ViVWBqeXkM-rOAvusoXryyRFX5Xmu2S-uEw4'

function a1RangeForApi(tab: string, cellRange: string): string {
  const escaped = tab.replace(/'/g, "''")
  return `'${escaped}'!${cellRange}`
}

/**
 * Dev/preview: browser calls same-origin /api/sheets-key; Node forwards to Google with the
 * browser's Referer header so HTTP-referrer–restricted API keys accept the request (some
 * browsers omit or trim Referer on cross-origin fetches even with referrerPolicy).
 */
function createSheetsKeyProxyMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
    if (pathname !== '/api/sheets-key') {
      next()
      return
    }

    try {
      const parsed = new URL(req.url ?? '/', 'http://localhost')
      const tab = parsed.searchParams.get('tab') ?? 'UnpivotData'
      const range = parsed.searchParams.get('range') ?? 'A:Z'
      const sidParam = parsed.searchParams.get('spreadsheetId')?.trim()

      const fileEnv = readLocalEnvFile()
      const apiKey = fileEnv.VITE_GOOGLE_SHEETS_API_KEY?.trim()
      const spreadsheetId =
        sidParam ||
        fileEnv.VITE_GOOGLE_SHEETS_SPREADSHEET_ID?.trim() ||
        DEFAULT_SPREADSHEET_ID

      if (!apiKey) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Missing VITE_GOOGLE_SHEETS_API_KEY in poll-tracker-app/.env' }))
        return
      }

      const host = req.headers.host || 'localhost:5173'
      const referer =
        (typeof req.headers.referer === 'string' && req.headers.referer.trim()) ||
        `http://${host}/`

      const rangePath = encodeURIComponent(a1RangeForApi(tab, range))
      const googleUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${rangePath}?key=${encodeURIComponent(apiKey)}`

      const r = await fetch(googleUrl, {
        cache: 'no-store',
        headers: {
          Referer: referer,
          'User-Agent':
            (typeof req.headers['user-agent'] === 'string' && req.headers['user-agent']) ||
            'Mozilla/5.0 (compatible; Elections-Polls-dev-proxy)',
        },
      })

      const text = await r.text()
      if (!r.ok) {
        res.writeHead(r.status, { 'Content-Type': 'application/json' })
        res.end(text.startsWith('{') ? text : JSON.stringify({ error: text.slice(0, 2000) }))
        return
      }

      const data = JSON.parse(text) as { values?: string[][] }
      const rows = data.values ?? []
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0',
      })
      res.end(JSON.stringify({ tab, range, rows }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: message }))
    }
  }
}

function createSheetsJwtMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
    if (pathname !== '/api/sheets') {
      next()
      return
    }

    try {
      const parsed = new URL(req.url ?? '/', 'http://localhost')
      const tab = parsed.searchParams.get('tab') ?? 'UnpivotData'
      const range = parsed.searchParams.get('range') ?? 'A:Z'

      const fileEnv = readLocalEnvFile()
      const clientEmail = fileEnv.GOOGLE_CLIENT_EMAIL
      const privateKey = (fileEnv.GOOGLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n')
      const spreadsheetId = fileEnv.GOOGLE_SHEETS_SPREADSHEET_ID

      if (!clientEmail || !privateKey || !spreadsheetId) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Missing env vars. Check .env file.' }))
        return
      }

      const auth = new google.auth.JWT({
        email: clientEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      })

      const sheets = google.sheets({ version: 'v4', auth })
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${tab}'!${range}`,
      })

      const rows = response.data.values ?? []
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0',
      })
      res.end(JSON.stringify({ tab, range, rows }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: message }))
    }
  }
}

function sheetsApiPlugin() {
  const keyMw = createSheetsKeyProxyMiddleware()
  const jwtMw = createSheetsJwtMiddleware()
  return {
    name: 'local-sheets-api',
    configureServer(server: { middlewares: { use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void } }) {
      server.middlewares.use(keyMw)
      server.middlewares.use(jwtMw)
    },
    configurePreviewServer(server: { middlewares: { use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void } }) {
      server.middlewares.use(keyMw)
      server.middlewares.use(jwtMw)
    },
  }
}

const base = process.env.VITE_BASE?.trim() || '/'

export default defineConfig({
  root: appDir,
  envDir: appDir,
  base,
  plugins: [react(), sheetsApiPlugin()],
})
