"""Panel-equivalent mean Likud LOO residual for ערוץ 14 on static Knesset25 unpivot CSV."""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd

_REPO = Path(__file__).resolve().parent.parent
CSV = _REPO / "data" / "elections-polls-knesset25-unpivot.csv"


def main() -> None:
    df = pd.read_csv(CSV)
    rows: list[dict] = []
    for _, row in df.iterrows():
        rows.append(
            {
                "pollId": int(row["Poll ID"]),
                "date": str(row["Date"])[:10],
                "mediaOutlet": str(row["Media Outlet"]).strip(),
                "party": str(row["Party"]).strip(),
                "votes": float(row["Votes"]),
            }
        )

    JOINT = "Joint Arab List"
    HADASH = "Hadash Ta'al"
    RAAM = "Ra'am"
    BALAD = "Balad"
    ARAB = {JOINT, HADASH, RAAM, BALAD}

    non_arab = [r for r in rows if r["party"] not in ARAB]
    arab_groups: dict[tuple[str, int], list] = defaultdict(list)
    for r in rows:
        if r["party"] in ARAB:
            arab_groups[(r["mediaOutlet"], r["pollId"])].append(r)

    combined_arab: list[dict] = []
    for grp in arab_groups.values():
        joint = next((x for x in grp if x["party"] == JOINT), None)
        hadash = next((x for x in grp if x["party"] == HADASH), None)
        raam = next((x for x in grp if x["party"] == RAAM), None)
        balad = next((x for x in grp if x["party"] == BALAD), None)

        def fv(x):
            return x["votes"] if x is not None else None

        seats = None
        jv = fv(joint)
        if jv is not None and jv > 0:
            seats = jv
        else:
            h, rm, bd = fv(hadash), fv(raam), fv(balad)
            if any(v is not None for v in (h, rm, bd)):
                seats = (h or 0) + (rm or 0) + (bd or 0)
        if seats is None:
            continue
        ref = grp[0]
        combined_arab.append({**ref, "party": "Arab List (combined)", "votes": seats})

    rows_h = non_arab + combined_arab

    BP = "Bennett's Party"
    YA = "Yesh Atid"
    passthrough = [r for r in rows_h if r["party"] not in (BP, YA)]
    merge_groups: dict[tuple[str, int], list] = defaultdict(list)
    for r in rows_h:
        if r["party"] in (BP, YA):
            merge_groups[(r["mediaOutlet"], r["pollId"])].append(r)
    merged_y: list[dict] = []
    for grp in merge_groups.values():
        total = sum(r["votes"] for r in grp)
        ref = next((r for r in grp if r["party"] == BP), grp[0])
        merged_y.append({**ref, "party": BP, "votes": total})

    rows_m = passthrough + merged_y

    polls_per: dict[str, set[int]] = defaultdict(set)
    for r in rows_m:
        polls_per[r["mediaOutlet"]].add(r["pollId"])
    min_p = 5
    keep = {o for o, s in polls_per.items() if len(s) >= min_p}
    filt = [r for r in rows_m if r["mediaOutlet"] in keep]

    window_days = 30

    def parse_d(s: str) -> datetime:
        return datetime.strptime(s, "%Y-%m-%d")

    def loo_baseline_likud(focal_outlet: str, poll_date: str) -> float | None:
        pd_dt = parse_d(poll_date)
        lo = pd_dt - timedelta(days=window_days)
        pool = [
            r
            for r in filt
            if r["party"] == "Likud"
            and r["mediaOutlet"] != focal_outlet
            and lo <= parse_d(r["date"]) <= pd_dt
        ]
        if not pool:
            return None
        return sum(r["votes"] for r in pool) / len(pool)

    c14 = "ערוץ 14"
    resids: list[float] = []
    for r in filt:
        if r["mediaOutlet"] != c14 or r["party"] != "Likud":
            continue
        b = loo_baseline_likud(c14, r["date"])
        if b is None:
            continue
        resids.append(r["votes"] - b)

    print(
        "Knesset 25 unpivot CSV — harmonize arabs, merge YA→Bennett, "
        f"minPolls>={min_p}, {window_days}d LOO"
    )
    print(f"Outlets passing filter: {len(keep)}")
    print(f"Outlet: {c14} | Party: Likud")
    print(f"N polls with baseline: {len(resids)}")
    if resids:
        print(f"Mean raw residual (Likud − LOO baseline): {sum(resids) / len(resids):.4f}")


if __name__ == "__main__":
    main()
