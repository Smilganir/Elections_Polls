# AGENTS.md

## Cursor Cloud specific instructions

This repo is a monorepo of Israeli election polling tools. There are **two independent
Vite + React apps** plus **Python data-sync tooling** at the repo root. There is **no root
`package.json`** — install/run each app from its own directory. Toolchain: Node 22, Python 3.12.

### Services

| Service | Dir | Dev command | Port | Notes |
|---|---|---|---|---|
| Poll Tracker | `poll-tracker-app/` | `npm run dev` | 5173 (strict) | `dev` runs `vite --open`; the `--open` is harmless/no-op in headless. |
| Media Bias | `media-bias-app/` | `npm run dev` | 5175 (strict) | Depends on the poll-tracker app at dev time (see below). |
| Python poll sync | repo root | `python run_polls.py` | — | Scrapes themadad.com → Google Sheets. See caveat below. |

Standard scripts live in each app's `package.json` (`dev`, `build`, `lint`, `preview`). No test
suite exists in this repo (no Vitest/Jest/pytest).

### Data source (most important gotcha)

Both apps read live data from a public Google Sheet (default ID
`1RIqzrv_ViVWBqeXkM-rOAvusoXryyRFX5Xmu2S-uEw4`). The committed app code fetches via the
**Google Sheets API v4, which requires an API key**. For local dev, put
`VITE_GOOGLE_SHEETS_API_KEY=<key>` in `poll-tracker-app/.env` and `media-bias-app/.env`
(see each app's `.env.example`). The poll-tracker app also supports a service-account JWT
fallback (`GOOGLE_CLIENT_EMAIL` / `GOOGLE_PRIVATE_KEY` / `GOOGLE_SHEETS_SPREADSHEET_ID`) via
its `/api/sheets` dev proxy. Without any of these, the dev data fetch fails and the UI shows a
"Missing Google Sheets API key" error — the apps otherwise start fine.

Non-obvious: the underlying spreadsheet is also readable **without a key** via the public gviz
CSV export (`https://docs.google.com/spreadsheets/d/<id>/gviz/tq?tqx=out:csv&sheet=<Tab>`).
This is only useful for quick data verification / temporary local testing; do not commit code
that switches the app off the Sheets-API path.

### Cross-app coupling (media-bias-app)

`media-bias-app` is not fully standalone in dev:
- It imports shared logic via the `@shared` alias → `poll-tracker-app/src`.
- Its Vite dev server proxies `/media/*` and `/parties/*` from `poll-tracker-app/public/`.

So keep `poll-tracker-app`'s dependencies installed and its `public/` assets present even when
you only work on the media-bias app.

### Lint / build status

`npm run lint` runs correctly in both apps but currently reports **pre-existing** ESLint errors
in the app source (not an environment problem). `npm run build` (`tsc -b && vite build`) passes
for both apps.

### Python tooling caveat

`run_polls.py` / `check_themadad.py` require a Google service account
(`google-sheets-service-account.json` or `GOOGLE_SERVICE_ACCOUNT_JSON`) and network access to
themadad.com, which blocks datacenter IPs — so the sync generally cannot run from a cloud VM
without a proxy. It is not needed to develop or run the web apps (the Sheet already holds data).
