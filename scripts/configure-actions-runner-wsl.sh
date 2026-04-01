#!/usr/bin/env bash
# Register this machine as a repo self-hosted runner (unattended). Run inside WSL Ubuntu.
#
# 1. GitHub → repo Settings → Actions → Runners → New self-hosted runner → copy token
# 2. export RUNNER_TOKEN='paste-token-here'
# 3. bash scripts/configure-actions-runner-wsl.sh
#
set -euo pipefail
REPO_URL="${REPO_URL:-https://github.com/Smilganir/Elections_Polls}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/actions-runner}"
RUNNER_NAME="${RUNNER_NAME:-$(hostname)}"

if [[ -z "${RUNNER_TOKEN:-}" ]]; then
  echo "Set RUNNER_TOKEN to the registration token from GitHub (Settings → Actions → Runners)."
  echo "Example: export RUNNER_TOKEN='...' && bash $0"
  exit 1
fi

cd "${INSTALL_DIR}"
if [[ ! -f config.sh ]]; then
  echo "Run scripts/install-actions-runner-wsl.sh first."
  exit 1
fi

./config.sh --url "${REPO_URL}" --token "${RUNNER_TOKEN}" --name "${RUNNER_NAME}" --unattended --replace

echo ""
echo "Configured. Start the runner (leave running, or use svc.sh install):"
echo "  cd ${INSTALL_DIR} && ./run.sh"
