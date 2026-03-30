"""
Fetch Israeli election polls from themadad.com, transform, and upload to Google Sheets.

Credentials (pick one):
  • CI: env GOOGLE_SERVICE_ACCOUNT_JSON = full JSON string (GitHub Actions secret).
  • Local: place your key file next to this script as google-sheets-service-account.json
    (gitignored), or set env GOOGLE_SERVICE_ACCOUNT_KEY_FILE to another path.
"""
import json
import os
from pathlib import Path

import pandas as pd
import requests
from io import StringIO
import numpy as np
from google.oauth2 import service_account
from googleapiclient.discovery import build

_SCOPES = ['https://www.googleapis.com/auth/spreadsheets']


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


def fetch_html(url: str) -> str:
    """
    Fetch the polls page. Prefer curl_cffi (Chrome TLS/JA3 impersonation) so GitHub Actions
    datacenter IPs are less likely to get 403 from WAFs; fall back to requests if unavailable.
    """
    extra_headers = {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,he;q=0.8',
        'Referer': 'https://themadad.com/',
    }
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
                '403 often means datacenter IP blocked despite TLS fingerprint)',
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
    resp = session.get(url, timeout=30)
    resp.raise_for_status()
    return resp.text


def max_poll_id_from_html(html: str) -> int | None:
    """
    Same table parse + dedupe rules as process_data(); returns max Poll ID we would upload.
    Used by CI to detect new polls without uploading.
    """
    dataframes = pd.read_html(StringIO(html), encoding='utf-8')
    data_df = max(dataframes, key=lambda df: len(df.columns)).copy()
    data_df = data_df.iloc[1:].copy()

    expected_cols = len(HEADERS)
    if len(data_df.columns) > expected_cols:
        data_df = data_df.iloc[:, :expected_cols]
    elif len(data_df.columns) < expected_cols:
        return None

    data_df.columns = HEADERS

    poll_1_df = pd.DataFrame(POLL_ID_1_DATA)
    data_df = pd.concat([poll_1_df, data_df], ignore_index=True)

    data_df['Poll ID'] = pd.to_numeric(data_df['Poll ID'], errors='coerce')
    data_df['Date'] = pd.to_datetime(data_df['Date'], errors='coerce')

    dup = (data_df['Media Outlet'] == 'ערוץ 14') & (data_df['Poll ID'] == 153)
    data_df = data_df[~dup].copy()

    data_df = data_df[data_df['Poll ID'] > 1].copy()

    data_df[VALUE_VARS] = data_df[VALUE_VARS].apply(pd.to_numeric, errors='coerce')
    data_df = data_df.dropna(subset=['Date']).copy()
    data_df['Poll ID'] = data_df['Poll ID'].fillna(-999).astype(int)

    data_df = data_df.sort_values('Poll ID', ascending=False)
    data_df = data_df.drop_duplicates(subset=['Date', 'Media Outlet'], keep='first').copy()

    if data_df.empty:
        return None
    return int(data_df['Poll ID'].max())


def process_data():
    """Fetch, clean, sort, filter, unpivot."""
    print("Fetching data from themadad.com ...")
    html = fetch_html(DATA_URL)
    print(f"  HTML fetched: {len(html):,} chars")

    dataframes = pd.read_html(StringIO(html), encoding='utf-8')
    data_df = max(dataframes, key=lambda df: len(df.columns)).copy()
    data_df = data_df.iloc[1:].copy()

    expected_cols = len(HEADERS)
    if len(data_df.columns) > expected_cols:
        data_df = data_df.iloc[:, :expected_cols]
    elif len(data_df.columns) < expected_cols:
        print(f"Error: scraped data has {len(data_df.columns)} columns, expected {expected_cols}.")
        return None, None

    data_df.columns = HEADERS

    # Inject Poll ID 1 then exclude it (keeps structure consistent)
    poll_1_df = pd.DataFrame(POLL_ID_1_DATA)
    data_df = pd.concat([poll_1_df, data_df], ignore_index=True)

    data_df['Poll ID'] = pd.to_numeric(data_df['Poll ID'], errors='coerce')
    data_df['Date'] = pd.to_datetime(data_df['Date'], errors='coerce')

    # Remove known duplicate
    dup = (data_df['Media Outlet'] == 'ערוץ 14') & (data_df['Poll ID'] == 153)
    data_df = data_df[~dup].copy()

    # Exclude Poll ID 1
    data_df = data_df[data_df['Poll ID'] > 1].copy()

    # Numeric cleanup on party columns
    data_df[VALUE_VARS] = data_df[VALUE_VARS].apply(pd.to_numeric, errors='coerce')
    data_df = data_df.dropna(subset=['Date']).copy()
    data_df['Poll ID'] = data_df['Poll ID'].fillna(-999).astype(int)

    # When same Date + Media Outlet has multiple polls, keep only the highest Poll ID
    before = len(data_df)
    data_df = data_df.sort_values('Poll ID', ascending=False)
    data_df = data_df.drop_duplicates(subset=['Date', 'Media Outlet'], keep='first').copy()
    dropped = before - len(data_df)
    if dropped:
        print(f"  Deduplicated: dropped {dropped} lower Poll IDs for same Date + Media Outlet")

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
    sheet.values().clear(spreadsheetId=SPREADSHEET_ID,
                         range="'Elections Polls Data'!A:Z").execute()
    sheet.values().clear(spreadsheetId=SPREADSHEET_ID,
                         range="'UnpivotData'!A:Z").execute()

    # Upload wide data
    print(f"Uploading wide data to {ORIGINAL_SHEET_RANGE} ...")
    sheet.values().update(
        spreadsheetId=SPREADSHEET_ID, range=ORIGINAL_SHEET_RANGE,
        valueInputOption='USER_ENTERED', body={'values': orig}
    ).execute()
    print("  Wide data done.")

    # Upload unpivot data
    print(f"Uploading unpivot data to {UNPIVOT_SHEET_RANGE} ...")
    result = sheet.values().update(
        spreadsheetId=SPREADSHEET_ID, range=UNPIVOT_SHEET_RANGE,
        valueInputOption='USER_ENTERED', body={'values': unpivot}
    ).execute()
    print(f"  Unpivot done. Cells updated: {result.get('updatedCells')}")
    print("\nAll done!")


if __name__ == '__main__':
    upload()
