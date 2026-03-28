"""One-off: verify VITE_GOOGLE_SHEETS_API_KEY in .env works (does not print the key)."""
from __future__ import annotations

import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENV = ROOT / ".env"
SID = "1RIqzrv_ViVWBqeXkM-rOAvusoXryyRFX5Xmu2S-uEw4"


def main() -> int:
    key = ""
    for line in ENV.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if s.startswith("#") or "=" not in s:
            continue
        name, _, val = s.partition("=")
        if name.strip() != "VITE_GOOGLE_SHEETS_API_KEY":
            continue
        key = val.strip().strip('"').strip("'")
        break
    if not key:
        print("FAIL: VITE_GOOGLE_SHEETS_API_KEY is empty in .env")
        return 1

    rp = urllib.parse.quote("'UnpivotData'!A1:A2", safe="")
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{SID}/values/{rp}?key={urllib.parse.quote(key)}"
    try:
        # API keys restricted by HTTP referrer reject requests with no Referer (unlike the browser).
        req = urllib.request.Request(
            url,
            headers={"Referer": "http://localhost:5173/"},
        )
        with urllib.request.urlopen(req, timeout=30) as r:
            body = r.read()
        print("OK: Sheets API HTTP", r.status, "-", len(body), "bytes")
        return 0
    except urllib.error.HTTPError as e:
        print("FAIL: HTTP", e.code, e.read()[:600].decode("utf-8", "replace"))
        return 1
    except OSError as e:
        print("FAIL:", type(e).__name__, str(e)[:300])
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
