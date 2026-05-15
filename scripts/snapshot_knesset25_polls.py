"""
One-off static snapshot: scrape themadad.com/allpolls25/, map to the same wide + unpivot
schema as run_polls.py (Elections Polls Data / UnpivotData), write CSVs, optionally upload
two new tabs on the main spreadsheet.

Does NOT modify run_polls.py. Reuses fetch_html, dedupe helpers, credentials, and SPREADSHEET_ID.

Party mapping (Hebrew themadad Knesset 25 → HEADERS):
  הליכוד → Likud
  יהדות התורה → UTJ
  ש\"ס → Shas
  ישראל ביתנו → Yisrael Beiteinu
  יש עתיד → Yesh Atid
  עוצמה → Otzma Yehudit
  רע\"מ → Ra'am
  המשותפת → Joint Arab List (Joint List block)
  הציונות הדתית + הרוח הציונית → Religious Zionism (summed)
  המחנה הממלכתי + תקווה חדשה → Blue & White (summed; NM vs NH as listed separately)
  מרצ + עבודה → The Democrats (summed; historical Labor + Meretz → nearest modern column)
  המפלגה הכלכלית → Balad column (source table is all zeros on snapshot scrape)
  Hadash Ta'al, Bennett's Party, Yashar!, The Reservists → 0 (not broken out in this table)

Media outlet labels unified before dedupe:
  ערוץ 13 → חדשות 13; ערוץ 12 / קשת 12 → חדשות 12; כאן 11 → כאן חדשות.

Usage:
  python scripts/snapshot_knesset25_polls.py              # CSV only (default)
  python scripts/snapshot_knesset25_polls.py --upload-sheets
"""
from __future__ import annotations

import argparse
import sys
from io import StringIO
from pathlib import Path

import pandas as pd
from googleapiclient.discovery import build

# Repo root (parent of scripts/)
_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

import run_polls as rp

DATA_URL_KNESSET_25 = "https://themadad.com/allpolls25/"

# Unify legacy/alternate commissioning labels to canonical outlet names (before Date+outlet dedupe).
_MEDIA_OUTLET_UNIFY_KNESSET25: dict[str, str] = {
    "ערוץ 13": "חדשות 13",
    "ערוץ 12": "חדשות 12",
    "קשת 12": "חדשות 12",
    "כאן 11": "כאן חדשות",
}

HE_COLS = [
    "מספר הסקר",
    "תאריך",
    "משיבים",
    "כלי תקשורת",
    "עורך משאלים",
    "הליכוד",
    "הציונות הדתית",
    "יהדות התורה",
    'ש"ס',
    "ישראל ביתנו",
    "המחנה הממלכתי",
    "יש עתיד",
    "מרצ",
    "עבודה",
    "עוצמה",
    "המפלגה הכלכלית",
    "המשותפת",
    'רע"מ',
    "הרוח הציונית",
    "תקווה חדשה",
]

WIDE_TAB = "Elections Polls Data-Kneset 25"
UNPIVOT_TAB = "UnpivotData-Kneset 25"


def _num(s: pd.Series) -> pd.Series:
    return pd.to_numeric(s, errors="coerce").fillna(0)


def hebrew_table_to_wide(df_he: pd.DataFrame) -> pd.DataFrame:
    missing = [c for c in HE_COLS if c not in df_he.columns]
    if missing:
        raise ValueError(f"Unexpected poll25 table: missing columns {missing}")

    mo = df_he["כלי תקשורת"].astype(str).str.strip()
    mo = mo.replace(_MEDIA_OUTLET_UNIFY_KNESSET25)

    out = pd.DataFrame(
        {
            "Poll ID": pd.to_numeric(df_he["מספר הסקר"], errors="coerce"),
            "Date": pd.to_datetime(
                df_he["תאריך"], errors="coerce", dayfirst=True, format="mixed"
            ),
            "Respondents": pd.to_numeric(df_he["משיבים"], errors="coerce"),
            "Media Outlet": mo,
            "Pollster": df_he["עורך משאלים"].astype(str).str.strip(),
            "Likud": _num(df_he["הליכוד"]),
            "UTJ": _num(df_he["יהדות התורה"]),
            "Shas": _num(df_he['ש"ס']),
            "Blue & White": _num(df_he["המחנה הממלכתי"]) + _num(df_he["תקווה חדשה"]),
            "Yesh Atid": _num(df_he["יש עתיד"]),
            "Hadash Ta'al": 0,
            "Yisrael Beiteinu": _num(df_he["ישראל ביתנו"]),
            "The Democrats": _num(df_he["מרצ"]) + _num(df_he["עבודה"]),
            "Religious Zionism": _num(df_he["הציונות הדתית"])
            + _num(df_he["הרוח הציונית"]),
            "Ra'am": _num(df_he['רע"מ']),
            "Balad": _num(df_he["המפלגה הכלכלית"]),
            "Otzma Yehudit": _num(df_he["עוצמה"]),
            "Bennett's Party": 0,
            "Yashar!": 0,
            "The Reservists": 0,
            "Joint Arab List": _num(df_he["המשותפת"]),
        }
    )
    return out


def apply_same_wide_pipeline(data_df: pd.DataFrame, verbose: bool = True) -> pd.DataFrame:
    """Mirror run_polls.get_wide_polls_dataframe cleaning after column rename (no Poll ID 1 row)."""
    data_df = data_df.copy()
    data_df["Poll ID"] = pd.to_numeric(data_df["Poll ID"], errors="coerce")
    data_df["Date"] = pd.to_datetime(
        data_df["Date"], errors="coerce", dayfirst=True, format="mixed"
    )

    dup = (data_df["Media Outlet"] == "ערוץ 14") & (data_df["Poll ID"] == 153)
    data_df = data_df[~dup].copy()
    data_df = rp._apply_ch12_558_instead_of_559_wide(data_df)
    data_df = rp._prefer_n12_split_arabs_on_same_day(data_df)

    data_df = data_df[data_df["Poll ID"].notna() & (data_df["Poll ID"] > 0)].copy()

    data_df[rp.VALUE_VARS] = data_df[rp.VALUE_VARS].apply(pd.to_numeric, errors="coerce")
    data_df = data_df.dropna(subset=["Date"]).copy()
    data_df["Poll ID"] = data_df["Poll ID"].fillna(-999).astype(int)

    before = len(data_df)
    data_df = data_df.sort_values("Poll ID", ascending=False)
    data_df = data_df.drop_duplicates(subset=["Date", "Media Outlet"], keep="first").copy()
    dropped = before - len(data_df)
    if verbose and dropped:
        print(f"  Deduplicated: dropped {dropped} lower Poll IDs for same Date + Media Outlet")
    return data_df


def wide_to_unpivot_values(data_df: pd.DataFrame) -> tuple[list, list]:
    """Same as run_polls.process_data unpivot leg; data_df Date must be datetime."""
    value_vars = rp.VALUE_VARS
    id_vars = rp.ID_VARS

    temp = data_df.melt(
        id_vars=["Media Outlet", "Poll ID"],
        value_vars=value_vars,
        var_name="Party",
        value_name="V",
    )
    temp["V"] = pd.to_numeric(temp["V"], errors="coerce").fillna(0)
    hist_avg = temp.groupby(["Media Outlet", "Party"])["V"].mean().reset_index()
    hist_avg.rename(columns={"V": "HistAvg"}, inplace=True)

    unpivot_df = data_df.copy()
    idx = unpivot_df.sort_values(by=["Date", "Poll ID"]).copy()
    idx["Media Index"] = idx.groupby("Media Outlet").cumcount() + 1
    unpivot_df = unpivot_df.merge(
        idx[["Poll ID", "Date", "Media Index"]], on=["Poll ID", "Date"], how="left"
    )

    wide_display = data_df.copy()
    wide_display["Date"] = wide_display["Date"].dt.strftime("%Y-%m-%d")
    wide_display["Poll ID"] = wide_display["Poll ID"].astype(int)
    wide_display["Respondents"] = (
        pd.to_numeric(wide_display["Respondents"], errors="coerce").fillna(0).astype(int)
    )
    for c in value_vars:
        wide_display[c] = (
            pd.to_numeric(wide_display[c], errors="coerce").fillna(0).round().astype(int)
        )
    wide_display["Media Outlet"] = wide_display["Media Outlet"].fillna("")
    wide_display["Pollster"] = wide_display["Pollster"].fillna("")

    unpivot_df["Date"] = unpivot_df["Date"].dt.strftime("%Y-%m-%d")

    unpivot_df = unpivot_df.melt(
        id_vars=id_vars + ["Media Index"],
        value_vars=value_vars,
        var_name="Party",
        value_name="Votes_Final",
    )
    unpivot_df["Votes"] = (
        pd.to_numeric(unpivot_df["Votes_Final"], errors="coerce").fillna(0).astype(int)
    )

    unpivot_df = unpivot_df.merge(hist_avg, on=["Media Outlet", "Party"], how="left")
    unpivot_df = unpivot_df.sort_values(
        by=["Poll ID", "Votes", "HistAvg"], ascending=[True, False, False]
    )
    unpivot_df["Votes_Rank"] = unpivot_df.groupby("Poll ID").cumcount() + 1
    unpivot_df["Votes_Rank"] = unpivot_df["Votes_Rank"].astype(int)
    unpivot_df = unpivot_df.drop(columns=["HistAvg", "Votes_Final"])

    final_cols = [
        "Poll ID",
        "Date",
        "Respondents",
        "Media Outlet",
        "Pollster",
        "Media Index",
        "Party",
        "Votes",
        "Votes_Rank",
    ]
    unpivot_df = unpivot_df[final_cols].copy()

    wide_display = wide_display.sort_values(by="Poll ID", ascending=False)
    unpivot_df = unpivot_df.sort_values(by="Poll ID", ascending=False)

    orig_values = [wide_display.columns.tolist()] + wide_display.values.tolist()
    unpivot_values = [unpivot_df.columns.tolist()] + unpivot_df.values.tolist()
    return orig_values, unpivot_values


def ensure_sheet_title(spreadsheet_api, spreadsheet_id: str, title: str) -> None:
    meta = spreadsheet_api.get(spreadsheetId=spreadsheet_id).execute()
    existing = {s["properties"]["title"] for s in meta.get("sheets", [])}
    if title in existing:
        print(f"  Sheet tab exists: {title!r}")
        return
    print(f"  Adding sheet tab: {title!r}")
    rp._execute_sheets(
        spreadsheet_api.batchUpdate(
            spreadsheetId=spreadsheet_id,
            body={"requests": [{"addSheet": {"properties": {"title": title}}}]},
        ),
        what=f"addSheet {title}",
    )


def upload_tabs(orig_values: list, unpivot_values: list) -> None:
    creds = rp._load_credentials()
    service = build("sheets", "v4", credentials=creds)
    sheet = service.spreadsheets()

    ensure_sheet_title(sheet, rp.SPREADSHEET_ID, WIDE_TAB)
    ensure_sheet_title(sheet, rp.SPREADSHEET_ID, UNPIVOT_TAB)

    wide_range = f"'{WIDE_TAB}'!A1"
    unpivot_range = f"'{UNPIVOT_TAB}'!A1"

    print(f"  Clearing {WIDE_TAB!r} …")
    rp._execute_sheets(
        sheet.values().clear(
            spreadsheetId=rp.SPREADSHEET_ID,
            range=f"'{WIDE_TAB}'!A:ZZ",
        ),
        what=f"Clear {WIDE_TAB}",
    )
    print(f"  Clearing {UNPIVOT_TAB!r} …")
    rp._execute_sheets(
        sheet.values().clear(
            spreadsheetId=rp.SPREADSHEET_ID,
            range=f"'{UNPIVOT_TAB}'!A:ZZ",
        ),
        what=f"Clear {UNPIVOT_TAB}",
    )

    print(f"  Uploading wide → {wide_range} …")
    rp._execute_sheets(
        sheet.values().update(
            spreadsheetId=rp.SPREADSHEET_ID,
            range=wide_range,
            valueInputOption="USER_ENTERED",
            body={"values": orig_values},
        ),
        what="Update Knesset25 wide",
    )
    print(f"  Uploading unpivot → {unpivot_range} …")
    res = rp._execute_sheets(
        sheet.values().update(
            spreadsheetId=rp.SPREADSHEET_ID,
            range=unpivot_range,
            valueInputOption="USER_ENTERED",
            body={"values": unpivot_values},
        ),
        what="Update Knesset25 unpivot",
    )
    print(f"  Unpivot cells updated: {res.get('updatedCells')}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Knesset 25 poll snapshot (themadad poll25).")
    parser.add_argument(
        "--upload-sheets",
        action="store_true",
        help="Create/update tabs on Google Sheets (needs service account like run_polls).",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=_REPO_ROOT / "data",
        help="Directory for CSV exports (default: ./data)",
    )
    args = parser.parse_args()

    print(f"Fetching {DATA_URL_KNESSET_25} …")
    html = rp.fetch_html(DATA_URL_KNESSET_25)
    print(f"  HTML: {len(html):,} chars")

    tables = pd.read_html(StringIO(html), encoding="utf-8")
    df_he = max(tables, key=lambda d: len(d.columns))
    print(f"  Parsed table: {len(df_he)} rows × {len(df_he.columns)} cols")

    wide = hebrew_table_to_wide(df_he)
    wide = apply_same_wide_pipeline(wide, verbose=True)
    if wide.empty:
        print("No rows after cleaning; abort.")
        return 1

    orig_values, unpivot_values = wide_to_unpivot_values(wide)

    args.out_dir.mkdir(parents=True, exist_ok=True)
    wide_csv = args.out_dir / "elections-polls-knesset25-wide.csv"
    unpivot_csv = args.out_dir / "elections-polls-knesset25-unpivot.csv"

    wide_out = pd.DataFrame(orig_values[1:], columns=orig_values[0])
    unpivot_out = pd.DataFrame(unpivot_values[1:], columns=unpivot_values[0])
    wide_out.to_csv(wide_csv, index=False, encoding="utf-8-sig")
    unpivot_out.to_csv(unpivot_csv, index=False, encoding="utf-8-sig")
    print(f"Wrote {wide_csv}")
    print(f"Wrote {unpivot_csv}")
    print(f"Wide rows: {len(wide_out)}, unpivot rows: {len(unpivot_out)}")

    if args.upload_sheets:
        print("Uploading to Google Sheets …")
        upload_tabs(orig_values, unpivot_values)
        print("Sheets upload done.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
