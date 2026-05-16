"""
One-off: how often does the same pollster appear via another outlet inside the LOO 30-day window?

Reads live UnpivotData from the main spreadsheet (same credentials as run_polls.py).
"""
from __future__ import annotations

import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path

from googleapiclient.discovery import build

_REPO = Path(__file__).resolve().parent.parent
if str(_REPO) not in sys.path:
    sys.path.insert(0, str(_REPO))

import run_polls as rp

WINDOW_DAYS = 30


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass

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
        polls[key] = {"date": date, "pollster": pollster, "outlet": outlet, "pid": pid}

    print("Distinct polls (one row per outlet x Poll ID):", len(polls))

    pid_to_outlets: dict[int, set[str]] = defaultdict(set)
    for v in polls.values():
        pid_to_outlets[v["pid"]].add(v["outlet"])
    multi_pid = {p: outs for p, outs in pid_to_outlets.items() if len(outs) > 1}
    print("Poll IDs listed under >1 distinct outlet:", len(multi_pid))
    if multi_pid:
        for p, outs in sorted(multi_pid.items(), key=lambda x: -len(x[1]))[:20]:
            print(f"  Poll ID {p}: {sorted(outs)}")

    ps_day: dict[tuple[str, str], set[str]] = defaultdict(set)
    for v in polls.values():
        if not v["pollster"]:
            continue
        ps_day[(v["pollster"], v["date"])].add(v["outlet"])
    syn = {k: outs for k, outs in ps_day.items() if len(outs) > 1}
    print()
    print("(Pollster, publication date) with >1 outlet same day:", len(syn))
    for (pst, day), outs in sorted(syn.items(), key=lambda x: x[0][0])[:25]:
        print(f"  {day} | {pst} -> outlets: {sorted(outs)}")

    def parse_d(s: str) -> datetime:
        return datetime.strptime(s, "%Y-%m-%d")

    plist = list(polls.values())
    vals_only: list[int] = []
    for focal in plist:
        d0 = parse_d(focal["date"])
        lo = d0 - timedelta(days=WINDOW_DAYS)
        pster = focal["pollster"]
        if not pster:
            continue
        n = 0
        for other in plist:
            if other["outlet"] == focal["outlet"]:
                continue
            if other["pollster"] != pster:
                continue
            do = parse_d(other["date"])
            if lo <= do <= d0:
                n += 1
        vals_only.append(n)

    print()
    print(
        f"For each focal poll with non-empty pollster: count OTHER outlets’ polls "
        f"by SAME pollster with date in [focal_date-{WINDOW_DAYS}, focal_date]"
    )
    print("  Eligible focal polls:", len(vals_only))
    if vals_only:
        mean_shared = sum(vals_only) / len(vals_only)
        print(f"  Mean count (poll rows from same pollster, other outlets, in window): {mean_shared:.3f}")
        dist = Counter(vals_only)
        print("  Distribution (#shared -> #focal polls):", dict(sorted(dist.items())))
        ge1 = sum(1 for x in vals_only if x >= 1)
        print(f"  Focal polls with >=1 such row: {ge1} ({100 * ge1 / len(vals_only):.1f}%)")

    dup_days_by_pollster = Counter()
    for (pst, _day), outs in syn.items():
        dup_days_by_pollster[pst] += 1
    print()
    print("Pollsters with most distinct calendar dates appearing under multiple outlets:")
    for pst, n in dup_days_by_pollster.most_common(20):
        print(f"  {n:3d} dates | {pst}")


if __name__ == "__main__":
    main()
