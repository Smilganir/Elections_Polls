"""
Compare themadad.com max Poll ID to a cached fingerprint (for GitHub Actions).

Writes GitHub Actions outputs when GITHUB_OUTPUT is set:
  changed=true|false
  fingerprint=<int>   (current max poll id from site, or empty if parse failed)
"""
from __future__ import annotations

import os
import sys

from run_polls import DATA_URL, fetch_html, max_poll_id_from_html

FINGERPRINT_FILE = '.themadad-fingerprint'


def _write_output(changed: bool, fingerprint: int | None) -> None:
    path = os.environ.get('GITHUB_OUTPUT')
    if not path:
        return
    with open(path, 'a', encoding='utf-8') as f:
        f.write(f'changed={"true" if changed else "false"}\n')
        f.write(f'fingerprint={fingerprint if fingerprint is not None else ""}\n')


def main() -> int:
    previous: int | None = None
    if os.path.isfile(FINGERPRINT_FILE):
        try:
            with open(FINGERPRINT_FILE, encoding='utf-8') as fp:
                raw = fp.read().strip()
            if raw:
                previous = int(raw)
        except ValueError:
            previous = None

    print(f'Fetching {DATA_URL} ...')
    html = fetch_html(DATA_URL)
    current = max_poll_id_from_html(html)
    if current is None:
        print('Could not parse poll table or no rows.', file=sys.stderr)
        _write_output(changed=False, fingerprint=None)
        return 1

    print(f'  Max Poll ID on site (after dedupe rules): {current}')
    if previous is not None:
        print(f'  Cached fingerprint: {previous}')

    changed = previous is None or current != previous
    _write_output(changed=changed, fingerprint=current)

    if not changed:
        print('No change — skipping upload.')
    else:
        print('New or updated data — pipeline should run.')

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
