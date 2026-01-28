#!/usr/bin/env bash
set -euo pipefail

cd /repo

export MRBEANBOT_STATE_DIR="/tmp/MrBeanBot-test"
export MRBEANBOT_CONFIG_PATH="${MRBEANBOT_STATE_DIR}/MrBeanBot.json"

echo "==> Seed state"
mkdir -p "${MRBEANBOT_STATE_DIR}/credentials"
mkdir -p "${MRBEANBOT_STATE_DIR}/agents/main/sessions"
echo '{}' >"${MRBEANBOT_CONFIG_PATH}"
echo 'creds' >"${MRBEANBOT_STATE_DIR}/credentials/marker.txt"
echo 'session' >"${MRBEANBOT_STATE_DIR}/agents/main/sessions/sessions.json"

echo "==> Reset (config+creds+sessions)"
pnpm MrBeanBot reset --scope config+creds+sessions --yes --non-interactive

test ! -f "${MRBEANBOT_CONFIG_PATH}"
test ! -d "${MRBEANBOT_STATE_DIR}/credentials"
test ! -d "${MRBEANBOT_STATE_DIR}/agents/main/sessions"

echo "==> Recreate minimal config"
mkdir -p "${MRBEANBOT_STATE_DIR}/credentials"
echo '{}' >"${MRBEANBOT_CONFIG_PATH}"

echo "==> Uninstall (state only)"
pnpm MrBeanBot uninstall --state --yes --non-interactive

test ! -d "${MRBEANBOT_STATE_DIR}"

echo "OK"
