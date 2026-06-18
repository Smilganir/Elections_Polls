"""
Fetch Israeli election polls from themadad.com, transform, and upload to Google Sheets.

Credentials (pick one):
  • CI: env GOOGLE_SERVICE_ACCOUNT_JSON = full JSON string (GitHub Actions secret).
  • Local: place your key file next to this script as google-sheets-service-account.json
    (gitignored), or set env GOOGLE_SERVICE_ACCOUNT_KEY_FILE to another path.

themadad.com /allpolls/ often returns HTTP 403 from GitHub-hosted runner IPs (WAF / IP
reputation), even with curl_cffi TLS impersonation. Practical options:
  • Run this script on a home PC on a schedule (Task Scheduler / cron) — same code, usually works.
  • Actions: workflow_dispatch only, or attach a self-hosted runner to the repo.
  • Set HTTPS_PROXY (or HTTP_PROXY) to a residential proxy URL if you use one (also as a secret on CI).
"""
import hashlib
import json
import os
import time
from io import StringIO
from pathlib import Path

import numpy as np
import pandas as pd
import requests
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

_SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

# Google sometimes returns 5xx on values.clear / values.update; retry before failing CI.
_RETRYABLE_SHEETS_HTTP = frozenset({429, 500, 502, 503, 504})


def _execute_sheets(request, *, what: str, max_attempts: int = 6) -> object:
    """Call request.execute() with backoff on rate limits and transient server errors."""
    delay = 1.5
    for attempt in range(max_attempts):
        try:
            return request.execute()
        except HttpError as e:
            status = getattr(e.resp, 'status', None) or 0
            last = attempt == max_attempts - 1
            if status not in _RETRYABLE_SHEETS_HTTP or last:
                raise
            print(
                f"  {what}: HTTP {status} (retryable). "
                f'Sleeping {delay:.1f}s ({attempt + 1}/{max_attempts}) ...'
            )
            time.sleep(delay)
            delay = min(60.0, delay * 2)


def _load_credentials():
    """Service account from GOOGLE_SERVICE_ACCOUNT_JSON (CI) or local JSON file path."""
    raw = os.environ.get('GOOGLE_SERVICE_ACCOUNT_JSON', '').strip()
    if raw:
        info = json.loads(raw)
        return service_account.Credentials.from_service_account_info(info, scopes=_SCOPES)
    key_path = os.environ.get('GOOGLE_SERVICE_ACCOUNT_KEY_FILE', '').strip() or KEY_FILE
    if not os.path.isfile(key_path):
        raise FileNotFoundError(
            f'Service account JSON not found at {key_path!r}. '
            'Add google-sheets-service-account.json next to run_polls.py, set '
            'GOOGLE_SERVICE_ACCOUNT_KEY_FILE, or GOOGLE_SERVICE_ACCOUNT_JSON (CI).'
        )
    return service_account.Credentials.from_service_account_file(key_path, scopes=_SCOPES)

# ======================= CONFIGURATION =========================
_REPO_DIR = Path(__file__).resolve().parent
SPREADSHEET_ID = '1RIqzrv_ViVWBqeXkM-rOAvusoXryyRFX5Xmu2S-uEw4'
KEY_FILE = str(_REPO_DIR / 'google-sheets-service-account.json')
DATA_URL = 'https://themadad.com/allpolls/'
FINGERPRINT_FILE = str(_REPO_DIR / '.themadad-fingerprint')

ORIGINAL_SHEET_RANGE = "'Elections Polls Data'!A1"
UNPIVOT_SHEET_RANGE = "'UnpivotData'!A1"

HEADERS = [
    "Poll ID", "Date", "Respondents", "Media Outlet", "Pollster",
    "Likud", "UTJ", "Shas", "Blue & White", "Yesh Atid", "Hadash Ta'al",
    "Yisrael Beiteinu", "The Democrats", "Religious Zionism", "Ra'am",
    "Balad", "Otzma Yehudit", "Bennett's Party", "Yashar!", "The Reservists",
    "Joint Arab List"
]

ID_VARS = ["Poll ID", "Date", "Respondents", "Media Outlet", "Pollster"]
VALUE_VARS = HEADERS[5:]  # 16 party columns

# Manual row for Poll ID 1 (included for structure, then excluded by filter)
POLL_ID_1_DATA = {
    "Poll ID": [1], "Date": ['2022-12-23'], "Respondents": [500],
    "Media Outlet": ['מעריב'], "Pollster": ['מנחם לזר'],
    "Likud": [35], "UTJ": [8], "Shas": [9],
    "Blue & White": [10], "Yesh Atid": [26], "Hadash Ta'al": [0],
    "Yisrael Beiteinu": [4], "The Democrats": [4], "Religious Zionism": [12],
    "Ra'am": [4], "Balad": [4], "Otzma Yehudit": [12],
    "Bennett's Party": [4], "Yashar!": [0], "The Reservists": [4],
    "Joint Arab List": [0]
}


def _apply_ch12_558_instead_of_559_wide(data_df: pd.DataFrame) -> pd.DataFrame:
    """
    One-time ETL from themadad → Sheets: חדשות 12 poll 559 on 2026-04-16 is superseded by 558.

    If a scraped row for poll 558 exists for that outlet, copy its party / pollster /
    respondents onto the 2026-04-16 row, set Poll ID to 558, and drop the other 558 row(s).
    If poll 558 is missing from the scrape, drop the 559 row only.
    """
    out = data_df.copy()
    mo = out['Media Outlet'].astype(str).str.strip()
    day = pd.to_datetime(out['Date'], errors='coerce', dayfirst=True, format='mixed').dt.strftime('%Y-%m-%d')
    bad = (mo == 'חדשות 12') & (out['Poll ID'] == 559) & (day == '2026-04-16')
    if not bad.any():
        return out
    bad_ix = out.index[bad].tolist()
    good = (mo == 'חדשות 12') & (out['Poll ID'] == 558)
    if good.any():
        src = out.loc[good].sort_values('Date', ascending=False).iloc[0]
        copy_cols = ['Respondents', 'Pollster', *VALUE_VARS]
        for ix in bad_ix:
            out.loc[ix, 'Poll ID'] = 558
            for c in copy_cols:
                out.loc[ix, c] = src[c]
        good_ix = out.index[good].tolist()
        drop_ix = [i for i in good_ix if i not in bad_ix]
        if drop_ix:
            out = out.drop(index=drop_ix)
        print(
            '  One-time fix: Channel 12 (N12) — 2026-04-16 row now uses poll 558 from themadad; '
            'removed duplicate 559 / spare 558 wide row(s).',
        )
        return out
    print('  One-time fix: Channel 12 (N12) — dropped poll 559 (2026-04-16); no poll 558 in scrape.')
    return out.loc[~bad].copy()


_ARAB_DETAIL_COLS = ("Hadash Ta'al", "Ra'am", "Balad")


def _console_safe(text: str) -> str:
    """ASCII-safe text for Windows consoles that cannot print Hebrew."""
    return text.encode('ascii', 'backslashreplace').decode('ascii')


def _poll_num(v: object) -> float:
    x = pd.to_numeric(v, errors='coerce')
    return 0.0 if pd.isna(x) else float(x)


def _is_split_arabs_row(row) -> bool:
    """Row splits Arab vote into detail columns instead of Joint Arab List."""
    jal = _poll_num(row.get('Joint Arab List', 0))
    detail = sum(_poll_num(row.get(c, 0)) for c in _ARAB_DETAIL_COLS)
    return jal == 0 and detail > 0


def _prefer_split_arabs_on_same_day(data_df: pd.DataFrame) -> pd.DataFrame:
    """
    Same-day duplicate rule (all outlets): when 2+ polls share Date + Media Outlet,
    prefer the row that **splits the Arab vote** into ``Hadash Ta'al`` / ``Ra'am`` /
    ``Balad`` over a row that **lumps** them into ``Joint Arab List``. Party-line
    trends and rolling-window deltas rely on the split columns; a lumped row loses
    per-party detail.

    Runs **before** generic ``(Date, Media Outlet)`` dedupe. Poll ID is **not** the
    primary tie-breaker when one row is split and another lumped: the split row can
    have a lower Poll ID. When multiple split rows share a date (rare), keep the
    highest Poll ID among them. When no row is split, or all rows are split, defer
    to generic dedupe.
    """
    out = data_df.copy()
    mo = out['Media Outlet'].astype(str).str.strip()
    day_iso = pd.to_datetime(out['Date'], errors='coerce', dayfirst=True, format='mixed').dt.strftime('%Y-%m-%d')

    to_drop: list[int] = []
    keys = pd.DataFrame({'mo': mo, 'day': day_iso}, index=out.index)
    for (outlet, date_str), grp_ix in keys.groupby(['mo', 'day']).groups.items():
        if len(grp_ix) < 2 or not isinstance(date_str, str) or not date_str:
            continue
        grp = out.loc[list(grp_ix)]
        flags = grp.apply(_is_split_arabs_row, axis=1)
        if not flags.any() or flags.all():
            continue  # no lumped row, or all rows split — leave to generic dedupe
        split_ix = flags[flags].index.tolist()
        lump_ix = [i for i in grp.index if i not in split_ix]
        if len(split_ix) == 1:
            pick_ix = split_ix[0]
        else:
            pick_ix = out.loc[split_ix, 'Poll ID'].astype(float).idxmax()
        extras = [i for i in split_ix if i != pick_ix]
        dropped_here = lump_ix + extras
        to_drop.extend(dropped_here)
        kept_id = int(float(out.loc[pick_ix, 'Poll ID']))
        dropped_ids = sorted(
            int(float(pid)) for pid in out.loc[dropped_here, 'Poll ID'].tolist()
        )
        print(
            f'  Same-day split-Arabs preference ({_console_safe(outlet)}, {date_str}): '
            f'kept poll {kept_id} (Arab parties split); '
            f'dropped {dropped_ids} (lumped Arab vote).'
        )

    if to_drop:
        out = out.drop(index=to_drop).copy()
    return out


# Backward-compatible alias (was N12-only; now applies to all outlets).
_prefer_n12_split_arabs_on_same_day = _prefer_split_arabs_on_same_day


def _request_proxies() -> dict | None:
    p = (os.environ.get('HTTPS_PROXY') or os.environ.get('HTTP_PROXY') or '').strip()
    if not p:
        return None
    return {'http': p, 'https': p}


def fetch_html(url: str) -> str:
    """
    Fetch the polls page HTML (fragment containing the <table>).

    Uses curl_cffi Chrome impersonation when available; otherwise requests.
    Optional HTTPS_PROXY / HTTP_PROXY for a residential proxy if datacenter IPs get 403.
    """
    extra_headers = {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,he;q=0.8',
        'Referer': 'https://themadad.com/',
    }
    proxies = _request_proxies()
    try:
        from curl_cffi import requests as cf_requests
    except ImportError:
        cf_requests = None

    if cf_requests is not None:
        last: tuple[str, int | str] | None = None
        for impersonate in ('chrome131', 'chrome124', 'chrome120', 'chrome'):
            try:
                r = cf_requests.get(
                    url,
                    impersonate=impersonate,
                    headers=extra_headers,
                    timeout=45,
                    proxies=proxies,
                )
            except Exception as ex:
                last = (impersonate, str(ex))
                continue
            last = (impersonate, r.status_code)
            if r.status_code == 200:
                return r.text
        imp, info = last if last else ('?', '?')
        if isinstance(info, int):
            raise requests.HTTPError(
                f'{info} Client Error for url: {url} (curl_cffi last impersonate={imp!r}; '
                '403 often means datacenter IP blocked despite TLS fingerprint). '
                'Try HTTPS_PROXY, a self-hosted runner, or run run_polls.py from a home network.',
            )
        raise RuntimeError(
            f'curl_cffi fetch failed for {url} (impersonate={imp!r}): {info}',
        )

    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                       '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        **extra_headers,
    })
    resp = session.get(url, timeout=30, proxies=proxies)
    resp.raise_for_status()
    return resp.text


def _wide_polls_from_html(html: str, *, verbose: bool = False) -> pd.DataFrame | None:
    """
    Parse themadad HTML → wide table after outlet corrections and (Date, Media Outlet) dedupe.
    Same rules as ``process_data()`` / upload. ``Date`` is timezone-naive datetime.
    """
    dataframes = pd.read_html(StringIO(html), encoding='utf-8')
    data_df = max(dataframes, key=lambda df: len(df.columns)).copy()
    # No iloc[1:] skip: site serves newest-first with a proper <thead>. Poll ID 1 is
    # prepended manually below and filtered out by ``Poll ID > 1``.

    expected_cols = len(HEADERS)
    if len(data_df.columns) > expected_cols:
        data_df = data_df.iloc[:, :expected_cols]
    elif len(data_df.columns) < expected_cols:
        if verbose:
            print(f"Error: scraped data has {len(data_df.columns)} columns, expected {expected_cols}.")
        return None

    data_df.columns = HEADERS

    poll_1_df = pd.DataFrame(POLL_ID_1_DATA)
    data_df = pd.concat([poll_1_df, data_df], ignore_index=True)

    data_df['Poll ID'] = pd.to_numeric(data_df['Poll ID'], errors='coerce')
    data_df['Date'] = pd.to_datetime(data_df['Date'], errors='coerce', dayfirst=True, format='mixed')

    dup = (data_df['Media Outlet'] == 'ערוץ 14') & (data_df['Poll ID'] == 153)
    data_df = data_df[~dup].copy()
    data_df = _apply_ch12_558_instead_of_559_wide(data_df)
    data_df = _prefer_split_arabs_on_same_day(data_df)

    data_df = data_df[data_df['Poll ID'] > 1].copy()

    data_df[VALUE_VARS] = data_df[VALUE_VARS].apply(pd.to_numeric, errors='coerce')
    data_df = data_df.dropna(subset=['Date']).copy()
    data_df['Poll ID'] = data_df['Poll ID'].fillna(-999).astype(int)

    before = len(data_df)
    data_df = data_df.sort_values('Poll ID', ascending=False)
    data_df = data_df.drop_duplicates(subset=['Date', 'Media Outlet'], keep='first').copy()
    dropped = before - len(data_df)
    if verbose and dropped:
        print(f"  Deduplicated: dropped {dropped} lower Poll IDs for same Date + Media Outlet")

    if data_df.empty:
        return None
    return data_df


def sync_fingerprint_from_wide(data_df: pd.DataFrame) -> str:
    """
    Stable content fingerprint for the wide table we upload.
    Format: ``{maxPollId}:{rowCount}:{sha256hex20}`` — detects new polls, row drops, and vote edits.
    """
    lines: list[str] = []
    for _, row in data_df.sort_values(['Poll ID', 'Media Outlet', 'Date']).iterrows():
        day = pd.Timestamp(row['Date']).strftime('%Y-%m-%d')
        mo = str(row['Media Outlet']).strip()
        pid = int(row['Poll ID'])
        votes = ';'.join(f"{c}={int(_poll_num(row[c]))}" for c in VALUE_VARS)
        lines.append(f"{pid}|{day}|{mo}|{votes}")
    digest = hashlib.sha256('\n'.join(lines).encode('utf-8')).hexdigest()[:20]
    max_id = int(data_df['Poll ID'].max())
    return f"{max_id}:{len(data_df)}:{digest}"


def sync_fingerprint_from_html(html: str) -> str | None:
    """Fingerprint after the same ETL rules as upload; None if parse fails."""
    data_df = _wide_polls_from_html(html, verbose=False)
    if data_df is None:
        return None
    return sync_fingerprint_from_wide(data_df)


def max_poll_id_from_fingerprint(fingerprint: str) -> int | None:
    try:
        return int(fingerprint.strip().split(':', 1)[0])
    except ValueError:
        return None


def sync_fingerprints_differ(previous: str | None, current: str) -> bool:
    """
    True when upload should run. Legacy fingerprints (max Poll ID only) compare on max ID;
    v2 fingerprints (``max:rows:hash``) compare the full string.
    """
    if previous is None:
        return True
    prev = previous.strip()
    if not prev:
        return True
    cur = current.strip()
    if ':' not in prev:
        prev_max = max_poll_id_from_fingerprint(prev)
        cur_max = max_poll_id_from_fingerprint(cur)
        if prev_max is None or cur_max is None:
            return True
        return prev_max != cur_max
    return prev != cur


def write_sync_fingerprint(fingerprint: str, path: str | None = None) -> None:
    target = path or FINGERPRINT_FILE
    with open(target, 'w', encoding='utf-8') as fp:
        fp.write(fingerprint.strip())
        fp.write('\n')


def max_poll_id_from_html(html: str) -> int | None:
    """
    Max Poll ID after dedupe rules (same table as upload). Prefer ``sync_fingerprint_from_html``.
    """
    fp = sync_fingerprint_from_html(html)
    if fp is None:
        return None
    return max_poll_id_from_fingerprint(fp)


def get_wide_polls_dataframe(verbose: bool = True) -> pd.DataFrame | None:
    """
    Fetch themadad wide table: one row per (Date, Media Outlet) after Poll ID dedupe.
    ``Date`` is timezone-naive datetime. Returns None if fetch/parse fails or no rows.
    """
    if verbose:
        print("Fetching data from themadad.com ...")
    html = fetch_html(DATA_URL)
    if verbose:
        print(f"  HTML fetched: {len(html):,} chars")
    return _wide_polls_from_html(html, verbose=verbose)


def process_data():
    """Fetch, clean, sort, filter, unpivot. Returns (wide values, unpivot values, sync fingerprint)."""
    data_df = get_wide_polls_dataframe(verbose=True)
    if data_df is None:
        return None, None, None

    sync_fp = sync_fingerprint_from_wide(data_df)

    # Historical average votes per party per media outlet (for rank tie-breaking)
    temp = data_df.melt(id_vars=['Media Outlet', 'Poll ID'], value_vars=VALUE_VARS,
                        var_name='Party', value_name='V')
    temp['V'] = pd.to_numeric(temp['V'], errors='coerce').fillna(0)
    hist_avg = temp.groupby(['Media Outlet', 'Party'])['V'].mean().reset_index()
    hist_avg.rename(columns={'V': 'HistAvg'}, inplace=True)

    # Unpivot
    unpivot_df = data_df.copy()
    idx = unpivot_df.sort_values(by=['Date', 'Poll ID']).copy()
    idx['Media Index'] = idx.groupby('Media Outlet').cumcount() + 1
    unpivot_df = unpivot_df.merge(idx[['Poll ID', 'Date', 'Media Index']],
                                  on=['Poll ID', 'Date'], how='left')

    # Format dates
    data_df['Date'] = data_df['Date'].dt.strftime('%Y-%m-%d')
    unpivot_df['Date'] = unpivot_df['Date'].dt.strftime('%Y-%m-%d')
    data_df = data_df.fillna('')

    unpivot_df = unpivot_df.melt(
        id_vars=ID_VARS + ['Media Index'],
        value_vars=VALUE_VARS,
        var_name='Party',
        value_name='Votes_Final'
    )
    unpivot_df['Votes'] = pd.to_numeric(unpivot_df['Votes_Final'], errors='coerce').fillna(0).astype(int)

    # Merge historical avg for ranking tie-break
    unpivot_df = unpivot_df.merge(hist_avg, on=['Media Outlet', 'Party'], how='left')
    unpivot_df = unpivot_df.sort_values(by=['Poll ID', 'Votes', 'HistAvg'],
                                        ascending=[True, False, False])
    unpivot_df['Votes_Rank'] = unpivot_df.groupby('Poll ID').cumcount() + 1
    unpivot_df['Votes_Rank'] = unpivot_df['Votes_Rank'].astype(int)
    unpivot_df = unpivot_df.drop(columns=['HistAvg', 'Votes_Final'])

    FINAL_COLS = ['Poll ID', 'Date', 'Respondents', 'Media Outlet', 'Pollster',
                  'Media Index', 'Party', 'Votes', 'Votes_Rank']
    unpivot_df = unpivot_df[FINAL_COLS].copy()

    # Sort descending by Poll ID
    data_df = data_df.sort_values(by='Poll ID', ascending=False)
    unpivot_df = unpivot_df.sort_values(by='Poll ID', ascending=False)

    orig_values = [data_df.columns.tolist()] + data_df.values.tolist()
    unpivot_values = [unpivot_df.columns.tolist()] + unpivot_df.values.tolist()

    return orig_values, unpivot_values, sync_fp


def upload():
    print("Starting fetch-transform-upload pipeline ...\n")
    orig, unpivot, sync_fp = process_data()

    if orig is None or len(orig) <= 1:
        print("No data. Aborting.")
        return

    print(f"\nProcessed {len(orig)-1} wide rows, {len(unpivot)-1} unpivot rows.")
    print(f"  Sync fingerprint: {sync_fp}")

    creds = _load_credentials()
    service = build('sheets', 'v4', credentials=creds)
    sheet = service.spreadsheets()

    # Clear existing data before writing
    print("Clearing existing sheet data ...")
    _execute_sheets(
        sheet.values().clear(
            spreadsheetId=SPREADSHEET_ID, range="'Elections Polls Data'!A:Z"
        ),
        what="Clear 'Elections Polls Data'",
    )
    _execute_sheets(
        sheet.values().clear(spreadsheetId=SPREADSHEET_ID, range="'UnpivotData'!A:Z"),
        what="Clear 'UnpivotData'",
    )

    # Upload wide data
    print(f"Uploading wide data to {ORIGINAL_SHEET_RANGE} ...")
    _execute_sheets(
        sheet.values().update(
            spreadsheetId=SPREADSHEET_ID,
            range=ORIGINAL_SHEET_RANGE,
            valueInputOption='USER_ENTERED',
            body={'values': orig},
        ),
        what='Update wide sheet',
    )
    print("  Wide data done.")

    # Upload unpivot data
    print(f"Uploading unpivot data to {UNPIVOT_SHEET_RANGE} ...")
    result = _execute_sheets(
        sheet.values().update(
            spreadsheetId=SPREADSHEET_ID,
            range=UNPIVOT_SHEET_RANGE,
            valueInputOption='USER_ENTERED',
            body={'values': unpivot},
        ),
        what='Update unpivot sheet',
    )
    print(f"  Unpivot done. Cells updated: {result.get('updatedCells')}")
    write_sync_fingerprint(sync_fp)
    print(f"  Fingerprint written to {FINGERPRINT_FILE}")
    print("\nAll done!")


if __name__ == '__main__':
    upload()
