"""
Compare themadad.com sync fingerprint to the cached copy (for GitHub Actions + local).

Fingerprint format (v2): ``{maxPollId}:{rowCount}:{sha20}`` — full wide-table content hash
after ETL dedupe rules. Legacy files with only a Poll ID still work (max-ID compare only).

Writes GitHub Actions outputs when GITHUB_OUTPUT is set:
  changed=true|false
  fingerprint=<string>
"""
from __future__ import annotations

import os
import sys

from run_polls import (
    DATA_URL,
    FINGERPRINT_FILE,
    fetch_html,
    max_poll_id_from_fingerprint,
    sync_fingerprint_from_html,
    sync_fingerprints_differ,
)

FINGERPRINT_FILE_LEGACY = '.themadad-fingerprint'


def _write_output(changed: bool, fingerprint: str | None) -> None:
    path = os.environ.get('GITHUB_OUTPUT')
    if not path:
        return
    with open(path, 'a', encoding='utf-8') as f:
        f.write(f'changed={"true" if changed else "false"}\n')
        f.write(f'fingerprint={fingerprint if fingerprint is not None else ""}\n')


def _read_previous_fingerprint() -> str | None:
    path = FINGERPRINT_FILE if os.path.isfile(FINGERPRINT_FILE) else FINGERPRINT_FILE_LEGACY
    if not os.path.isfile(path):
        return None
    with open(path, encoding='utf-8') as fp:
        raw = fp.read().strip()
    return raw or None


def main() -> int:
    previous = _read_previous_fingerprint()

    print(f'Fetching {DATA_URL} ...')
    html = fetch_html(DATA_URL)
    current = sync_fingerprint_from_html(html)
    if current is None:
        print('Could not parse poll table or no rows.', file=sys.stderr)
        _write_output(changed=False, fingerprint=None)
        return 1

    max_id = max_poll_id_from_fingerprint(current)
    print(f'  Sync fingerprint: {current}')
    if max_id is not None:
        print(f'  Max Poll ID (after dedupe): {max_id}')
    if previous is not None:
        print(f'  Cached fingerprint: {previous}')

    changed = sync_fingerprints_differ(previous, current)
    _write_output(changed=changed, fingerprint=current)

    if not changed:
        print('No change — skipping upload.')
    else:
        print('New or updated data — pipeline should run.')

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
