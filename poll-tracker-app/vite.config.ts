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

function sheetsApiPlugin() {
  return {
    name: 'local-sheets-api',
    configureServer(server: { middlewares: { use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void } }) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        if (!req.url?.startsWith('/api/sheets')) {
          next()
          return
        }

        try {
          const parsed = new URL(req.url, 'http://localhost')
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
      })
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
