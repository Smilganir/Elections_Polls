#!/usr/bin/env bash
# One-time WSL setup without sudo: user pip + virtualenv on Linux $HOME (not /mnt/c).
set -euo pipefail
export PATH="${HOME}/.local/bin:${PATH}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "${SCRIPT_DIR}/.." && pwd)"
VENV_DIR="${HOME}/.venvs/elections-polls"

if [[ ! -x "${HOME}/.local/bin/pip" ]]; then
  curl -sS https://bootstrap.pypa.io/get-pip.py -o /tmp/get-pip.py
  python3 /tmp/get-pip.py --user --break-system-packages
fi
if [[ ! -x "${HOME}/.local/bin/virtualenv" ]]; then
  python3 -m pip install --user --break-system-packages "virtualenv>=20"
fi

rm -rf "${VENV_DIR}"
virtualenv "${VENV_DIR}"
# shellcheck source=/dev/null
source "${VENV_DIR}/bin/activate"
pip install -r "${REPO}/requirements-polls.txt"
cd "${REPO}"
python check_themadad.py
echo ""
echo "Done. Use this venv from WSL:"
echo "  source ${VENV_DIR}/bin/activate"
echo "  cd ${REPO}"
