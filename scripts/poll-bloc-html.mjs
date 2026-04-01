/**
 * Static HTML report for poll bloc summary (dashboard-style bars, outlet icons).
 * Icons load from GitHub Pages by default; override with POLL_SUMMARY_ICON_BASE.
 */

const KNESSET = 120
const COAL_COLOR = '#0166DF'
const ANTI_COLOR = '#E8EAED'
const MAJ_LINE = '#F5C542'

/** Sheet "Media Outlet" key → filename under /media/ on deployed app */
const MEDIA_ICON_FILE = {
  'i24 news': '_0006_Layer-6.png',
  וואלה: '_0005_Layer-8.png',
  'זמן ישראל': '_0007_Layer-5.png',
  'חדשות 12': '_0010_Layer-2.png',
  'חדשות 13': '_0009_Layer-16.png',
  'ישראל היום': '_0004_Layer-10.png',
  'כאן חדשות': '_0003_Layer-15.png',
  'מכונת האמת': '_0002_Layer-12.png',
  מעריב: '_0011_Layer-1.png',
  'ערוץ 7': '_0000_Layer-14.png',
  'ערוץ 14': '_0008_Layer-4.png',
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmtDelta(n) {
  if (n === 0) return '0'
  return (n > 0 ? '+' : '') + n
}

function deltaClass(n) {
  if (n > 0) return 'delta-pos'
  if (n < 0) return 'delta-neg'
  return 'delta-zero'
}

function iconBaseUrl() {
  const b = process.env.POLL_SUMMARY_ICON_BASE?.trim()
  if (b) return b.endsWith('/') ? b : `${b}/`
  return 'https://smilganir.github.io/Elections_Polls/media/'
}

function outletIconEl(mediaKey, displayName) {
  const file = MEDIA_ICON_FILE[mediaKey]
  const ch = escapeHtml(String(displayName || mediaKey || '?').trim().charAt(0))
  if (!file) {
    return `<div class="outlet-ico fallback" aria-hidden="true"><span>${ch}</span></div>`
  }
  const src = escapeHtml(`${iconBaseUrl()}${file}`)
  return `<div class="outlet-ico" data-ch="${ch}"><img src="${src}" alt="" width="44" height="44" loading="lazy" decoding="async" onerror="this.remove();var p=this.parentNode;var s=document.createElement('span');s.textContent=p.getAttribute('data-ch');p.classList.add('fallback');p.appendChild(s);" /></div>`
}

/** Stacked horizontal bar: coalition (blue) | anti-bloc (light); yellow line at 61. */
function blocBar(coal, anti, { mini = false } = {}) {
  const c = Math.max(0, Number(coal) || 0)
  const a = Math.max(0, Number(anti) || 0)
  const sum = c + a
  const scale = sum > KNESSET ? KNESSET / sum : 1
  const cw = ((c * scale) / KNESSET) * 100
  const aw = ((a * scale) / KNESSET) * 100
  const majPct = (61 / KNESSET) * 100
  const cls = mini ? 'bloc-bar mini' : 'bloc-bar'
  return `<div class="${cls}" role="img" aria-label="Coalition ${c}, anti-bloc ${a}">
  <div class="bloc-track">
    <div class="bloc-seg bloc-coal" style="width:${cw}%"><span>${c}</span></div>
    <div class="bloc-seg bloc-anti" style="width:${aw}%"><span>${a}</span></div>
    <div class="maj-line" style="left:${majPct}%" title="61 seats"></div>
  </div>
</div>`
}

function trendEl(n) {
  const x = Number(n)
  if (x > 0) return `<span class="trend up">↗ ${fmtDelta(x)}</span>`
  if (x < 0) return `<span class="trend down">↘ ${Math.abs(x)}</span>`
  return `<span class="trend flat">— 0</span>`
}

function segmentPillClass(seg) {
  if (seg === 'Coalition') return 'seg-Coalition'
  if (seg === 'Arabs') return 'seg-Arabs'
  return 'seg-Opposition'
}

export function buildPollBlocHtml(r) {
  const v = r.vsPreviousPollSameOutlets
  const leadBloc =
    r.avgCoalition > r.avgAntiBloc
      ? 'Coalition'
      : r.avgCoalition < r.avgAntiBloc
        ? 'Opposition + Arabs (anti-bloc)'
        : 'Even (tie)'
  const narrative = `Across <strong>${r.outlets}</strong> outlets whose latest poll is within <strong>${r.maxStaleDays}</strong> days of <strong>${escapeHtml(r.referenceDateUtc)}</strong>, the simple mean is <strong>${r.avgCoalition}</strong> coalition seats vs <strong>${r.avgAntiBloc}</strong> for opposition plus Arab-segment parties (spread <strong>${r.coalitionLeadSeats}</strong> seats to coalition). <strong>${r.outletsCoalition61}</strong> outlets show coalition ≥61; <strong>${r.outletsAntiBloc61}</strong> show the combined anti-bloc ≥61. Cross-outlet “momentum” heuristic (date quartiles): <strong>${escapeHtml(r.momentum)}</strong>. Versus each outlet’s prior poll, mean coalition moved <strong>${fmtDelta(v.deltaAvgLatestMinusPrevious.coalition)}</strong> and mean anti-bloc <strong>${fmtDelta(v.deltaAvgLatestMinusPrevious.antiBloc)}</strong> (coalition lead vs anti-bloc: <strong>${fmtDelta(v.deltaAvgLatestMinusPrevious.coalitionMinusAnti)}</strong>).`

  const meanLatestHero = `
<section class="mean-hero" aria-label="Cross-outlet average">
  <div class="mean-hero-kicker">Cross-outlet mean · ${r.outlets} outlets</div>
  <h2 class="mean-hero-title">Latest polls (${r.maxStaleDays}d)</h2>
  <div class="mean-hero-bar-wrap">${blocBar(r.avgCoalition, r.avgAntiBloc)}</div>
  <div class="mean-hero-nums">
    <div class="mean-stat coal"><span class="mean-stat-n">${r.avgCoalition}</span><span class="mean-stat-l">קואליציה / Coalition avg</span></div>
    <div class="mean-stat anti"><span class="mean-stat-n">${r.avgAntiBloc}</span><span class="mean-stat-l">אופוזיציה+ערבים / Anti-bloc avg</span></div>
    <div class="mean-stat lead"><span class="mean-stat-n ${deltaClass(r.coalitionLeadSeats)}">${fmtDelta(r.coalitionLeadSeats)}</span><span class="mean-stat-l">Coalition lead (C − anti)</span></div>
  </div>
</section>`

  const dashRowsLatest = r.perOutlet
    .map((o) => {
      const leadC = o.coalitionMinusAnti > 0 ? 'delta-pos' : o.coalitionMinusAnti < 0 ? 'delta-neg' : 'delta-zero'
      return `<div class="dash-row">
  <div class="dash-ico">${outletIconEl(o.mediaKey, o.media)}</div>
  <div class="dash-body">
    <div class="dash-head">
      <span class="dash-name">${escapeHtml(o.media)}</span>
      <span class="dash-meta">Poll <strong>${o.pollId}</strong> · ${escapeHtml(o.date)}</span>
    </div>
    <div class="dash-labels">
      <span class="dl coal">${o.coalition} <small>קואליציה</small></span>
      <span class="dl anti">${o.antiBloc} <small>אנטי־בלוק</small></span>
      <span class="dl lead ${leadC}">C−A: ${fmtDelta(o.coalitionMinusAnti)}</span>
    </div>
    ${blocBar(o.coalition, o.antiBloc)}
  </div>
</div>`
    })
    .join('')

  const outletBreakdownHtml = r.perOutlet
    .map((o) => {
      const partyRows = (o.parties ?? [])
        .map(
          (p) =>
            `<tr><td>${escapeHtml(p.party)}</td><td><span class="segment-pill ${segmentPillClass(p.segment)}">${escapeHtml(p.segment)}</span></td><td class="num">${p.votes}</td></tr>`,
        )
        .join('')
      return `<section class="outlet-block">
  <div class="outlet-block-h"><span class="ob-ico">${outletIconEl(o.mediaKey, o.media)}</span><div><h3>${escapeHtml(o.media)}</h3>
  <p class="outlet-meta">Poll <strong>${o.pollId}</strong> · ${escapeHtml(o.date)} · C ${o.coalition} · O ${o.opposition} · A ${o.arabs} · Anti ${o.antiBloc}</p></div></div>
  ${blocBar(o.coalition, o.antiBloc, { mini: true })}
  <table>
    <thead><tr><th>Party</th><th>Segment</th><th class="num">Seats</th></tr></thead>
    <tbody>${partyRows || '<tr><td colspan="3" class="sub">No rows</td></tr>'}</tbody>
  </table>
</section>`
    })
    .join('')

  const meanVsHero = `
<section class="mean-hero mean-vs" aria-label="Mean comparison previous vs latest">
  <div class="mean-hero-kicker">Same outlets · prior poll vs latest</div>
  <h2 class="mean-hero-title">Cross-outlet average</h2>
  <div class="mean-vs-grid">
    <div class="mean-vs-col">
      <div class="mean-vs-h">Previous (mean)</div>
      ${blocBar(v.previousAvgAmongComparable.coalition, v.previousAvgAmongComparable.antiBloc)}
      <div class="mean-vs-foot"><span class="coal">${v.previousAvgAmongComparable.coalition}</span> / <span class="anti">${v.previousAvgAmongComparable.antiBloc}</span></div>
    </div>
    <div class="mean-vs-col mean-vs-mid">
      <div class="mean-vs-deltas">
        <span>Δ Coal ${trendEl(v.deltaAvgLatestMinusPrevious.coalition)}</span>
        <span>Δ Anti ${trendEl(v.deltaAvgLatestMinusPrevious.antiBloc)}</span>
        <span>Δ Lead ${trendEl(v.deltaAvgLatestMinusPrevious.coalitionMinusAnti)}</span>
      </div>
    </div>
    <div class="mean-vs-col">
      <div class="mean-vs-h">Latest (mean)</div>
      ${blocBar(v.latestAvgAmongComparable.coalition, v.latestAvgAmongComparable.antiBloc)}
      <div class="mean-vs-foot"><span class="coal">${v.latestAvgAmongComparable.coalition}</span> / <span class="anti">${v.latestAvgAmongComparable.antiBloc}</span></div>
    </div>
  </div>
</section>`

  const dashRowsVs = v.perOutlet
    .map((o) => {
      const d = o.deltaLatestMinusPrevious
      return `<div class="dash-row vs">
  <div class="dash-ico">${outletIconEl(o.mediaKey, o.media)}</div>
  <div class="dash-body">
    <div class="dash-head">
      <span class="dash-name">${escapeHtml(o.media)}</span>
      <span class="dash-meta">Latest <strong>${escapeHtml(o.latest.date)}</strong> · Prior <strong>${escapeHtml(o.previous.date)}</strong></span>
    </div>
    <div class="vs-mini">
      <span class="vs-mini-l">Prior</span>
      ${blocBar(o.previous.coalition, o.previous.antiBloc, { mini: true })}
    </div>
    <div class="dash-labels">
      <span class="dl coal">${o.latest.coalition} קואליציה ${trendEl(d.coalition)}</span>
      <span class="dl anti">${o.latest.antiBloc} אנטי־בלוק ${trendEl(d.antiBloc)}</span>
      <span class="dl lead ${deltaClass(d.coalitionMinusAnti)}">Δ lead ${trendEl(d.coalitionMinusAnti)}</span>
    </div>
    ${blocBar(o.latest.coalition, o.latest.antiBloc)}
  </div>
</div>`
    })
    .join('')

  const rowsEx = r.excludedStaleOutlets
    .map(
      (o) =>
        `<tr><td>${escapeHtml(o.media)}</td><td>${escapeHtml(o.date)}</td><td class="num">${o.ageDays}</td></tr>`,
    )
    .join('')

  const css = `
    :root {
      --bg: #0c1017;
      --surface: #151b26;
      --surface2: #1c2433;
      --border: #2a3548;
      --text: #f0f3f8;
      --muted: #8b9cb3;
      --coal: ${COAL_COLOR};
      --anti: ${ANTI_COLOR};
      --maj: ${MAJ_LINE};
      --pos: #2ecc71;
      --neg: #e74c3c;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.45;
      min-height: 100vh;
    }
    .wrap { max-width: 920px; margin: 0 auto; padding: 1.25rem 1rem 2.5rem; }
    h1 { font-size: 1.4rem; font-weight: 700; margin: 0 0 0.35rem; letter-spacing: -0.02em; }
    .sub { color: var(--muted); font-size: 0.85rem; margin-bottom: 1rem; }
    .tabs { display: flex; gap: 0.2rem; flex-wrap: wrap; border-bottom: 1px solid var(--border); margin-bottom: 1rem; }
    .tabs button {
      background: transparent; border: none; color: var(--muted);
      padding: 0.55rem 0.9rem; cursor: pointer; font-size: 0.88rem;
      border-radius: 8px 8px 0 0; border: 1px solid transparent; border-bottom: none;
    }
    .tabs button:hover { color: var(--text); background: var(--surface); }
    .tabs button.active { color: var(--text); background: var(--surface2); border-color: var(--border); font-weight: 600; }
    .panel { display: none; }
    .panel.active { display: block; animation: fade 0.2s ease; }
    @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
    .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 0.65rem; margin-bottom: 1rem; }
    .card { background: var(--surface2); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem 0.9rem; }
    .card .label { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted); }
    .card .value { font-size: 1.25rem; font-weight: 700; margin-top: 0.15rem; }
    .card .hint { font-size: 0.72rem; color: var(--muted); margin-top: 0.2rem; }
    .narrative { background: var(--surface2); border: 1px solid var(--border); border-radius: 12px; padding: 1rem 1.1rem; font-size: 0.9rem; }
    .narrative strong { color: var(--coal); font-weight: 600; }
    .mean-hero {
      background: linear-gradient(165deg, var(--surface2) 0%, #121a28 100%);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 1.25rem 1.35rem 1.35rem;
      margin-bottom: 1.35rem;
      box-shadow: 0 8px 32px rgba(0,0,0,0.35);
    }
    .mean-hero-kicker { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); margin-bottom: 0.35rem; }
    .mean-hero-title { font-size: 1.15rem; font-weight: 700; margin: 0 0 1rem; }
    .mean-hero-bar-wrap { margin-bottom: 1rem; }
    .mean-hero-nums { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; }
    @media (max-width: 640px) { .mean-hero-nums { grid-template-columns: 1fr; } }
    .mean-stat { text-align: center; padding: 0.65rem; background: rgba(0,0,0,0.2); border-radius: 10px; border: 1px solid var(--border); }
    .mean-stat-n { display: block; font-size: 1.65rem; font-weight: 800; font-variant-numeric: tabular-nums; }
    .mean-stat.coal .mean-stat-n { color: #4da3ff; }
    .mean-stat.anti .mean-stat-n { color: #dfe3ea; }
    .mean-stat-l { display: block; font-size: 0.72rem; color: var(--muted); margin-top: 0.25rem; line-height: 1.3; }
    .mean-vs-grid { display: grid; grid-template-columns: 1fr auto 1fr; gap: 1rem; align-items: center; }
    @media (max-width: 720px) { .mean-vs-grid { grid-template-columns: 1fr; } .mean-vs-mid { order: -1; } }
    .mean-vs-h { font-size: 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.5rem; }
    .mean-vs-foot { margin-top: 0.5rem; font-size: 0.9rem; text-align: center; }
    .mean-vs-foot .coal { color: #4da3ff; font-weight: 700; }
    .mean-vs-foot .anti { color: #dfe3ea; font-weight: 700; }
    .mean-vs-deltas { display: flex; flex-direction: column; gap: 0.4rem; font-size: 0.85rem; text-align: center; color: var(--muted); }
    .bloc-bar { width: 100%; }
    .bloc-track {
      position: relative; display: flex; height: 36px; border-radius: 8px; overflow: hidden;
      background: #0a0e14; border: 1px solid var(--border);
    }
    .bloc-bar.mini .bloc-track { height: 22px; border-radius: 6px; }
    .bloc-seg { display: flex; align-items: center; justify-content: center; min-width: 0; transition: width 0.25s ease; }
    .bloc-seg span { font-weight: 800; font-size: 0.9rem; font-variant-numeric: tabular-nums; text-shadow: 0 1px 2px rgba(0,0,0,0.5); }
    .bloc-bar.mini .bloc-seg span { font-size: 0.72rem; }
    .bloc-coal { background: var(--coal); color: #fff; }
    .bloc-anti { background: linear-gradient(180deg, #5c6570 0%, #3d4450 100%); color: #111; }
    .bloc-anti span { color: #0c0c0c; text-shadow: none; }
    .maj-line {
      position: absolute; top: 0; bottom: 0; width: 3px; margin-left: -1.5px;
      background: var(--maj); box-shadow: 0 0 8px rgba(245,197,66,0.6); z-index: 2; pointer-events: none;
    }
    .dash-row { display: flex; gap: 0.85rem; align-items: flex-start; padding: 1rem 0; border-bottom: 1px solid var(--border); }
    .dash-row:last-child { border-bottom: none; }
    .dash-ico { flex-shrink: 0; }
    .outlet-ico {
      width: 44px; height: 44px; border-radius: 50%; overflow: hidden; border: 2px solid var(--border);
      background: var(--surface2); display: flex; align-items: center; justify-content: center;
    }
    .outlet-ico img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .outlet-ico.fallback, .outlet-ico.fallback span {
      font-weight: 800; font-size: 1rem; color: var(--muted); background: #252d3d;
    }
    .dash-body { flex: 1; min-width: 0; }
    .dash-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.5rem 1rem; margin-bottom: 0.45rem; }
    .dash-name { font-weight: 700; font-size: 1rem; }
    .dash-meta { font-size: 0.78rem; color: var(--muted); }
    .dash-labels { display: flex; flex-wrap: wrap; gap: 0.65rem 1.2rem; margin-bottom: 0.45rem; font-size: 0.82rem; }
    .dash-labels .dl.coal { color: #6eb6ff; }
    .dash-labels .dl.anti { color: #dfe3ea; }
    .dash-labels .dl.lead { font-weight: 700; }
    .dash-labels small { display: block; font-size: 0.65rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }
    .vs-mini { margin-bottom: 0.5rem; opacity: 0.85; }
    .vs-mini-l { font-size: 0.68rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; display: block; margin-bottom: 0.25rem; }
    .trend { font-weight: 700; font-size: 0.78rem; margin-left: 0.25rem; }
    .trend.up { color: var(--pos); }
    .trend.down { color: var(--neg); }
    .trend.flat { color: var(--muted); }
    .delta-pos { color: var(--pos) !important; }
    .delta-neg { color: var(--neg) !important; }
    .delta-zero { color: var(--muted) !important; }
    table { width: 100%; border-collapse: collapse; font-size: 0.82rem; background: var(--surface2); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; margin-top: 0.5rem; }
    th, td { padding: 0.5rem 0.65rem; text-align: left; border-bottom: 1px solid var(--border); }
    th { background: #1e2738; color: var(--muted); font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.05em; }
    tr:last-child td { border-bottom: none; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .outlet-block { margin-bottom: 1.5rem; padding-bottom: 1.25rem; border-bottom: 1px solid var(--border); }
    .outlet-block:last-child { border-bottom: none; }
    .outlet-block-h { display: flex; gap: 0.75rem; align-items: flex-start; margin-bottom: 0.5rem; }
    .outlet-block h3 { margin: 0; font-size: 1rem; color: #6eb6ff; }
    .outlet-meta { margin: 0.25rem 0 0; font-size: 0.78rem; color: var(--muted); }
    .segment-pill { font-size: 0.65rem; font-weight: 700; padding: 0.12rem 0.4rem; border-radius: 4px; text-transform: uppercase; }
    .seg-Coalition { background: rgba(1,102,223,0.25); color: #7eb8ff; }
    .seg-Opposition { background: rgba(255,255,255,0.08); color: #e0e4ea; }
    .seg-Arabs { background: rgba(113,121,130,0.35); color: #c5cad3; }
    footer { margin-top: 2rem; font-size: 0.72rem; color: var(--muted); }
    code { background: #1e2738; padding: 0.12rem 0.35rem; border-radius: 4px; font-size: 0.8em; }
  `

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Poll bloc summary — ${escapeHtml(r.referenceDateUtc)}</title>
  <style>${css}</style>
</head>
<body>
  <div class="wrap">
    <h1>Poll bloc summary</h1>
    <p class="sub">Reference (UTC): ${escapeHtml(r.referenceDateUtc)} · ${r.outlets} outlets · &lt;${r.maxStaleDays}d · Lead (avg): ${escapeHtml(leadBloc)} · Icons: <code>POLL_SUMMARY_ICON_BASE</code> optional</p>

    <nav class="tabs" role="tablist">
      <button type="button" class="active" data-tab="overview" role="tab" aria-selected="true">Overview</button>
      <button type="button" data-tab="latest" role="tab" aria-selected="false">Latest by outlet</button>
      <button type="button" data-tab="breakdown" role="tab" aria-selected="false">Outlet breakdown</button>
      <button type="button" data-tab="vsprev" role="tab" aria-selected="false">vs previous poll</button>
      <button type="button" data-tab="excluded" role="tab" aria-selected="false">Excluded (stale)</button>
    </nav>

    <div id="panel-overview" class="panel active" role="tabpanel">
      ${meanLatestHero}
      <div class="cards">
        <div class="card"><div class="label">Avg opposition</div><div class="value">${r.avgOpposition}</div></div>
        <div class="card"><div class="label">Avg Arabs</div><div class="value">${r.avgArabs}</div></div>
        <div class="card"><div class="label">Coalition ≥61</div><div class="value">${r.outletsCoalition61}</div><div class="hint">outlets</div></div>
        <div class="card"><div class="label">Anti-bloc ≥61</div><div class="value">${r.outletsAntiBloc61}</div><div class="hint">outlets</div></div>
        <div class="card"><div class="label">Momentum</div><div class="value">${escapeHtml(r.momentum)}</div></div>
        <div class="card"><div class="label">Δ coal (mean)</div><div class="value ${deltaClass(v.deltaAvgLatestMinusPrevious.coalition)}">${fmtDelta(v.deltaAvgLatestMinusPrevious.coalition)}</div></div>
        <div class="card"><div class="label">Δ anti (mean)</div><div class="value ${deltaClass(v.deltaAvgLatestMinusPrevious.antiBloc)}">${fmtDelta(v.deltaAvgLatestMinusPrevious.antiBloc)}</div></div>
      </div>
      <div class="narrative" style="margin-top:1rem">${narrative}</div>
    </div>

    <div id="panel-latest" class="panel" role="tabpanel">
      ${meanLatestHero}
      <div class="dash-list">${dashRowsLatest}</div>
    </div>

    <div id="panel-breakdown" class="panel" role="tabpanel">
      <p class="sub" style="margin-top:0">Party seats per outlet (latest poll, &lt;${r.maxStaleDays}d). Segment from Parties Dim.</p>
      ${outletBreakdownHtml}
    </div>

    <div id="panel-vsprev" class="panel" role="tabpanel">
      <p class="sub" style="margin-top:0">${escapeHtml(v.description)}</p>
      ${meanVsHero}
      <div class="dash-list">${dashRowsVs}</div>
    </div>

    <div id="panel-excluded" class="panel" role="tabpanel">
      <p class="sub" style="margin-top:0">Excluded from averages (latest poll &gt; ${r.maxStaleDays} days old).</p>
      <table>
        <thead><tr><th>Outlet</th><th>Latest date</th><th>Age (days)</th></tr></thead>
        <tbody>${rowsEx || '<tr><td colspan="3">None</td></tr>'}</tbody>
      </table>
    </div>

    <footer>
      Regenerate: <code>node scripts/summarize-latest-blocs.mjs</code> · Optional: <code>POLL_SUMMARY_ICON_BASE=https://…/media/</code>
    </footer>
  </div>
  <script>
    document.querySelectorAll('.tabs button').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var tab = btn.getAttribute('data-tab');
        document.querySelectorAll('.tabs button').forEach(function(b) {
          b.classList.toggle('active', b === btn);
          b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
        });
        document.querySelectorAll('.panel').forEach(function(p) {
          p.classList.toggle('active', p.id === 'panel-' + tab);
        });
      });
    });
  </script>
</body>
</html>`
}
