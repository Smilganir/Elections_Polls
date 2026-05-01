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


def _prefer_n12_split_arabs_on_same_day(data_df: pd.DataFrame) -> pd.DataFrame:
    """
    N12 duplicate-day rule: when חדשות 12 (N12) publishes 2+ polls on the same date,
    prefer the row that **splits the Arab vote** into the detail columns
    (``Joint Arab List`` == 0 with any of ``Hadash Ta'al`` / ``Ra'am`` / ``Balad`` > 0)
    over a row that **lumps** them into ``Joint Arab List``. The rolling-window
    narrative and party-line trends rely on the split columns; a lumped row loses
    those parties to the Arab bloc aggregate.

    Runs **before** the generic ``(Date, Media Outlet)`` dedupe so the generic rule
    has nothing to do for N12 on those days. Poll ID is **not** the tie-breaker:
    the correctly-split poll can have a lower Poll ID (e.g. 2026-04-23 keeps
    **562** and drops **563**). When multiple split rows share a date (rare),
    fall back to the highest Poll ID among them.
    """
    out = data_df.copy()
    mo = out['Media Outlet'].astype(str).str.strip()
    day_iso = pd.to_datetime(out['Date'], errors='coerce', dayfirst=True, format='mixed').dt.strftime('%Y-%m-%d')
    sel = mo == 'חדשות 12'
    if not sel.any():
        return out

    sub = out.loc[sel].copy()
    sub['_day'] = day_iso.loc[sub.index]

    def _num(v: object) -> float:
        x = pd.to_numeric(v, errors='coerce')
        return 0.0 if pd.isna(x) else float(x)

    def _is_split(row) -> bool:
        jal = _num(row.get('Joint Arab List', 0))
        detail = sum(_num(row.get(c, 0)) for c in ("Hadash Ta'al", "Ra'am", 'Balad'))
        return jal == 0 and detail > 0

    to_drop: list[int] = []
    for date_str, grp in sub.groupby('_day', dropna=True):
        if len(grp) < 2 or not isinstance(date_str, str) or not date_str:
            continue
        flags = grp.apply(_is_split, axis=1)
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
            f'  N12 same-day split-Arabs preference: {date_str} kept poll {kept_id} '
            f'(Arab parties split); dropped {dropped_ids} (lumped Arab vote).'
        )

    if to_drop:
        out = out.drop(index=to_drop).copy()
    return out


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


def max_poll_id_from_html(html: str) -> int | None:
    """
    Same table parse + dedupe rules as process_data(); returns max Poll ID we would upload.
    Used by CI to detect new polls without uploading.
    """
    dataframes = pd.read_html(StringIO(html), encoding='utf-8')
    data_df = max(dataframes, key=lambda df: len(df.columns)).copy()
    # No iloc[1:] skip: site now serves newest-first with a proper <thead>, so row 0 is
    # the latest poll. The old skip was only safe when Poll ID 1 was always at row 0.
    # Poll ID 1 is prepended manually below and then filtered out by 'Poll ID > 1'.

    expected_cols = len(HEADERS)
    if len(data_df.columns) > expected_cols:
        data_df = data_df.iloc[:, :expected_cols]
    elif len(data_df.columns) < expected_cols:
        return None

    data_df.columns = HEADERS

    poll_1_df = pd.DataFrame(POLL_ID_1_DATA)
    data_df = pd.concat([poll_1_df, data_df], ignore_index=True)

    data_df['Poll ID'] = pd.to_numeric(data_df['Poll ID'], errors='coerce')
    data_df['Date'] = pd.to_datetime(data_df['Date'], errors='coerce', dayfirst=True, format='mixed')

    dup = (data_df['Media Outlet'] == 'ערוץ 14') & (data_df['Poll ID'] == 153)
    data_df = data_df[~dup].copy()
    data_df = _apply_ch12_558_instead_of_559_wide(data_df)
    data_df = _prefer_n12_split_arabs_on_same_day(data_df)

    data_df = data_df[data_df['Poll ID'] > 1].copy()

    data_df[VALUE_VARS] = data_df[VALUE_VARS].apply(pd.to_numeric, errors='coerce')
    data_df = data_df.dropna(subset=['Date']).copy()
    data_df['Poll ID'] = data_df['Poll ID'].fillna(-999).astype(int)

    data_df = data_df.sort_values('Poll ID', ascending=False)
    data_df = data_df.drop_duplicates(subset=['Date', 'Media Outlet'], keep='first').copy()

    if data_df.empty:
        return None
    return int(data_df['Poll ID'].max())


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

    dataframes = pd.read_html(StringIO(html), encoding='utf-8')
    data_df = max(dataframes, key=lambda df: len(df.columns)).copy()
    # No iloc[1:] skip: site now serves newest-first with a proper <thead>, so row 0 is
    # the latest poll. The old skip was only safe when Poll ID 1 was always at row 0.
    # Poll ID 1 is prepended manually below and then filtered out by 'Poll ID > 1'.

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
    data_df = _prefer_n12_split_arabs_on_same_day(data_df)

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


def process_data():
    """Fetch, clean, sort, filter, unpivot."""
    data_df = get_wide_polls_dataframe(verbose=True)
    if data_df is None:
        return None, None

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

    return orig_values, unpivot_values


def upload():
    print("Starting fetch-transform-upload pipeline ...\n")
    orig, unpivot = process_data()

    if orig is None or len(orig) <= 1:
        print("No data. Aborting.")
        return

    print(f"\nProcessed {len(orig)-1} wide rows, {len(unpivot)-1} unpivot rows.")

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
    print("\nAll done!")


if __name__ == '__main__':
    upload()
