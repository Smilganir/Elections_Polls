#!/usr/bin/env bash
# Download GitHub Actions runner (Linux x64) into ~/actions-runner — run inside WSL Ubuntu.
set -euo pipefail
RUNNER_VERSION="${RUNNER_VERSION:-2.333.1}"
RUNNER_TGZ="actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
RUNNER_URL="https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${RUNNER_TGZ}"
EXPECTED_SHA256="${EXPECTED_SHA256:-18f8f68ed1892854ff2ab1bab4fcaa2f5abeedc98093b6cb13638991725cab74}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/actions-runner}"

mkdir -p "${INSTALL_DIR}"
cd "${INSTALL_DIR}"

if [[ -f config.sh ]]; then
  echo "Runner already present at ${INSTALL_DIR} (config.sh exists). Skipping download."
else
  echo "Downloading ${RUNNER_URL} ..."
  curl -fsSL -o "${RUNNER_TGZ}" "${RUNNER_URL}"
  echo "${EXPECTED_SHA256}  ${RUNNER_TGZ}" | shasum -a 256 -c
  tar xzf "${RUNNER_TGZ}"
  rm -f "${RUNNER_TGZ}"
  echo "Extracted to ${INSTALL_DIR}"
fi

ls -la config.sh run.sh
