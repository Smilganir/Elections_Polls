# Poll Tracker App

Vite + React + TypeScript app replicating Tableau dashboards:
- `Election Polls In Israel`
- `Political Poll Tracker`

## Local setup

1. Install deps:
```bash
npm install
```

2. Create `.env.local` from `.env.example` and fill values:
- `GOOGLE_SHEETS_SPREADSHEET_ID`
- `GOOGLE_CLIENT_EMAIL`
- `GOOGLE_PRIVATE_KEY`

3. Start dev server:
```bash
npm run dev
```

## Icons

The app expects:
- media icons in `public/media`
- party icons in `public/parties`

## Build

```bash
npm run build
```

## Deploy (Vercel)

Set the same env vars in Vercel project settings, then deploy.
