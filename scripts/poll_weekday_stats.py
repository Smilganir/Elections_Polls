#!/usr/bin/env python3
"""
Poll release weekday stats from themadad.com (same wide-table dedupe as run_polls.py).

Run from repo root:
  python scripts/poll_weekday_stats.py

Uses HTTPS_PROXY / HTTP_PROXY if set (same as run_polls).
"""
from __future__ import annotations

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import pandas as pd

from run_polls import get_wide_polls_dataframe

WEEK_ORDER = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
]


def main() -> int:
    df = get_wide_polls_dataframe(verbose=True)
    if df is None or df.empty:
        print("No poll rows to analyze.", file=sys.stderr)
        return 1

    d = df.copy()
    d["weekday"] = pd.Categorical(d["Date"].dt.day_name(), categories=WEEK_ORDER, ordered=True)
    poll_counts = d["weekday"].value_counts().reindex(WEEK_ORDER).fillna(0).astype(int)

    start = d["Date"].min().normalize()
    end = d["Date"].max().normalize()
    cal = pd.date_range(start, end, freq="D")
    cal_weekdays = pd.Categorical(cal.day_name(), categories=WEEK_ORDER, ordered=True)
    day_occurrences = pd.Series(cal_weekdays).value_counts().reindex(WEEK_ORDER).fillna(0).astype(int)

    avg_per_weekday_in_range = poll_counts / day_occurrences.replace(0, pd.NA)

    print()
    print(f"Date span (poll dates): {start.date()} .. {end.date()}  ({len(cal)} calendar days)")
    print(f"Poll rows (deduped Date + Media Outlet): {len(d)}")
    print()
    out = pd.DataFrame(
        {
            "weekday": WEEK_ORDER,
            "polls": poll_counts.values,
            "calendar_days_that_weekday": day_occurrences.values,
            "avg_polls_per_that_weekday": avg_per_weekday_in_range.round(3).values,
        }
    )
    # Pretty print without scientific notation
    pd.set_option("display.max_columns", None)
    pd.set_option("display.width", 120)
    print(out.to_string(index=False))
    print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
