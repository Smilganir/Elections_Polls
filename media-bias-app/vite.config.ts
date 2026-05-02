import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dotenv from 'dotenv'
import type { IncomingMessage, ServerResponse } from 'http'
import { URL } from 'url'

const appDir = path.dirname(fileURLToPath(import.meta.url))
const envFilePath = path.join(appDir, '.env')

/** Reads only this app's .env — avoids inheriting stale OS vars. */
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
 * Dev/preview proxy: browser calls /api/sheets-key; this handler forwards the
 * request to Google Sheets with the API key from media-bias-app/.env so the
 * key's HTTP-referrer restriction is satisfied by the actual page URL.
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
        res.end(
          JSON.stringify({
            error:
              'Missing VITE_GOOGLE_SHEETS_API_KEY in media-bias-app/.env. ' +
              'Copy .env.example → .env and add your API key.',
          }),
        )
        return
      }

      // Use the browser's actual Referer so GCP referrer-restricted keys match.
      // If you added only localhost:5173 to GCP, also add http://localhost:5175/*
      // (or whatever port this dev server claims).  Alternatively, set
      // VITE_DEV_REFERER=http://localhost:5173/ in .env to force a known-good value.
      const fileEnvReferer = fileEnv.VITE_DEV_REFERER?.trim()
      const host = req.headers.host || 'localhost:5175'
      const referer =
        fileEnvReferer ||
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
            'Mozilla/5.0 (compatible; media-bias-app-dev-proxy)',
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

/** Catch-all for /api/sheets (JWT path) — not supported in this app. */
function createSheetsFallbackMiddleware() {
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
    if (pathname !== '/api/sheets') {
      next()
      return
    }
    res.writeHead(501, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        error:
          'JWT auth (/api/sheets) is not configured for media-bias-app. ' +
          'Set VITE_GOOGLE_SHEETS_API_KEY in media-bias-app/.env instead.',
      }),
    )
  }
}

function sheetsApiPlugin() {
  const keyMw = createSheetsKeyProxyMiddleware()
  const fallbackMw = createSheetsFallbackMiddleware()
  return {
    name: 'local-sheets-api',
    configureServer(server: {
      middlewares: { use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void }
    }) {
      server.middlewares.use(keyMw)
      server.middlewares.use(fallbackMw)
    },
    configurePreviewServer(server: {
      middlewares: { use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void }
    }) {
      server.middlewares.use(keyMw)
      server.middlewares.use(fallbackMw)
    },
  }
}

/**
 * Serve /media/* and /parties/* from poll-tracker-app/public/ during dev/preview.
 * Production deploy (GitHub Pages): workflow copies this app under poll-tracker `dist/media-bias/`,
 * served at https://…github.io/<repo>/media-bias/ with shared `/media/` and `/parties/` assets.
 */
const SHARED_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
}
const mainPublicDir = path.resolve(appDir, '../poll-tracker-app/public')

function createSharedAssetsMiddleware() {
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
    if (!pathname.startsWith('/media/') && !pathname.startsWith('/parties/')) {
      next()
      return
    }
    const filePath = path.join(mainPublicDir, pathname)
    if (!fs.existsSync(filePath)) {
      next()
      return
    }
    const ext = path.extname(filePath).toLowerCase()
    const mime = SHARED_MIME[ext] || 'application/octet-stream'
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'max-age=3600' })
    fs.createReadStream(filePath).pipe(res as unknown as NodeJS.WritableStream)
  }
}

function sharedAssetsPlugin() {
  const mw = createSharedAssetsMiddleware()
  return {
    name: 'shared-assets',
    configureServer(server: {
      middlewares: { use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void }
    }) {
      server.middlewares.use(mw)
    },
    configurePreviewServer(server: {
      middlewares: { use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void }
    }) {
      server.middlewares.use(mw)
    },
  }
}

const base = process.env.VITE_BASE?.trim() || '/'
const shared = path.resolve(appDir, '../poll-tracker-app/src')

export default defineConfig({
  root: appDir,
  envDir: appDir,
  base,
  plugins: [react(), sheetsApiPlugin(), sharedAssetsPlugin()],
  resolve: {
    alias: { '@shared': shared },
  },
})
