#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Optional: load production env (CAPACITOR_SERVER_URL, CAPACITOR_ALLOW_NAVIGATION, …)
if [[ -f "${LINE_ROOM_CAP_ENV_FILE:-}" ]]; then
  # shellcheck disable=SC1090
  set -a && source "$LINE_ROOM_CAP_ENV_FILE" && set +a
elif [[ -f "$ROOT/.env.production.local" ]]; then
  set -a && source "$ROOT/.env.production.local" && set +a
fi

if [[ -z "${CAPACITOR_SERVER_URL:-}" && -z "${NEXT_PUBLIC_APP_URL:-}" && -z "${NEXT_PUBLIC_SITE_URL:-}" ]]; then
  echo "Set CAPACITOR_SERVER_URL or NEXT_PUBLIC_APP_URL before release sync." >&2
  exit 1
fi

if [[ -z "${CAPACITOR_ALLOW_NAVIGATION:-}" ]]; then
  echo "Warning: CAPACITOR_ALLOW_NAVIGATION is empty — OAuth/Stripe redirects may fail in the WebView." >&2
fi

npx cap sync ios
