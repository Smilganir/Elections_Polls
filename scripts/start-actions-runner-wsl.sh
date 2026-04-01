#!/usr/bin/env bash
# Start the GitHub Actions runner if it is not already running (WSL Ubuntu).
set -euo pipefail
INSTALL_DIR="${INSTALL_DIR:-$HOME/actions-runner}"
cd "${INSTALL_DIR}"
if pgrep -f Runner.Listener >/dev/null 2>&1; then
  echo "Runner already listening (Runner.Listener running)."
  exit 0
fi
nohup ./run.sh >> /tmp/actions-runner.log 2>&1 &
echo $! | tee /tmp/actions-runner.pid
echo "Started. Tail log: tail -f /tmp/actions-runner.log"
