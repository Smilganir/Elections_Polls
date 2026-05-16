"""
Emit duplicate / overlap detail for pollster sharing across outlets.

Usage:
  python scripts/list_pollster_overlap_duplicates.py

Writes UTF-8: data/pollster-overlap-detail.txt
"""
from __future__ import annotations

import sys
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

from googleapiclient.discovery import build

_REPO = Path(__file__).resolve().parent.parent
if str(_REPO) not in sys.path:
    sys.path.insert(0, str(_REPO))

import run_polls as rp

WINDOW_DAYS = 30


def main() -> None:
    out_path = _REPO / "data" / "pollster-overlap-detail.txt"
    lines_out: list[str] = []

    def out(line: str = "") -> None:
        lines_out.append(line)

    creds = rp._load_credentials()
    svc = build("sheets", "v4", credentials=creds)
    vals = (
        svc.spreadsheets()
        .values()
        .get(spreadsheetId=rp.SPREADSHEET_ID, range="'UnpivotData'!A:I")
        .execute()
        .get("values", [])
    )
    header = vals[0]
    col = {name: header.index(name) for name in header}

    def cell(row: list[str], key: str) -> str:
        i = col[key]
        return row[i] if i < len(row) else ""

    polls: dict[tuple[str, int], dict] = {}
    seen: set[tuple[str, int]] = set()
    for row in vals[1:]:
        try:
            pid = int(float(cell(row, "Poll ID")))
            outlet = cell(row, "Media Outlet").strip()
            pollster = cell(row, "Pollster").strip()
            date = cell(row, "Date")[:10]
        except (ValueError, KeyError):
            continue
        if not outlet or not date:
            continue
        key = (outlet, pid)
        if key in seen:
            continue
        seen.add(key)
        polls[key] = {"pid": pid, "outlet": outlet, "pollster": pollster, "date": date}

    plist = list(polls.values())

    def parse_d(s: str) -> datetime:
        return datetime.strptime(s, "%Y-%m-%d")

    out("=== A) Same pollster + same calendar date, multiple outlets ===\n")
    ps_day: dict[tuple[str, str], list] = defaultdict(list)
    for v in plist:
        if not v["pollster"]:
            continue
        ps_day[(v["pollster"], v["date"])].append(v)
    any_multi = False
    for k in sorted(ps_day.keys(), key=lambda x: (x[1], x[0])):
        lst = ps_day[k]
        if len(lst) <= 1:
            continue
        any_multi = True
        pst, day = k
        out(f"Date {day} | Pollster: {pst}")
        for v in sorted(lst, key=lambda x: x["outlet"]):
            out(f"  Poll ID {v['pid']} | {v['outlet']}")
        out()
    if not any_multi:
        out("(none)\n")

    out(
        f"=== B) Focal polls with >=1 OTHER outlet by SAME pollster "
        f"in [date-{WINDOW_DAYS}, date] ===\n"
    )
    cases: list[tuple[dict, list]] = []
    for focal in plist:
        if not focal["pollster"]:
            continue
        d0 = parse_d(focal["date"])
        lo = d0 - timedelta(days=WINDOW_DAYS)
        matches: list[dict] = []
        for other in plist:
            if other["outlet"] == focal["outlet"]:
                continue
            if other["pollster"] != focal["pollster"]:
                continue
            do = parse_d(other["date"])
            if lo <= do <= d0:
                matches.append(other)
        if matches:
            cases.append((focal, matches))

    out(f"Total focal polls with at least one overlapping pollster row: {len(cases)}\n")
    for focal, matches in sorted(
        cases, key=lambda x: (x[0]["date"], x[0]["pollster"], x[0]["outlet"])
    ):
        out(
            f"--- Focal: {focal['date']} | {focal['outlet']} | "
            f"Poll ID {focal['pid']} | {focal['pollster']} ---"
        )
        for m in sorted(matches, key=lambda x: (x["date"], x["outlet"])):
            out(f"    overlap: {m['date']} | {m['outlet']} | Poll ID {m['pid']}")
        out()

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(lines_out), encoding="utf-8")
    print(f"Wrote {out_path} ({len(lines_out)} lines)")


if __name__ == "__main__":
    main()
