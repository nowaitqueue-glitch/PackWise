#!/usr/bin/env bash
# PackWise local API smoke test (curl).
#
# Usage (Git Bash / WSL / macOS / Linux — with `npm run dev` running):
#   ./scripts/test-api.sh <trip-uuid>
#   TEST_TRIP_ID=<uuid> ./scripts/test-api.sh
#
# Env (see .env.local.example):
#   BASE_URL          default http://localhost:3000
#   TEST_TRIP_ID      trip UUID if not passed as $1
#   TEST_USER_JWT     Bearer token for POST /api/generate-packing-list
#                     (from: node scripts/create-test-user.mjs --write-env)
#   GEMINI_API_KEY    optional (suitcase scan only; packing uses templates)
#   CRON_SECRET       Bearer token for GET /api/cron/packing-reminders
#
# Loads project-root .env.local when present (does not override existing env).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

is_placeholder() {
  local v="${1:-}"
  v="$(printf '%s' "$v" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' | tr '[:upper:]' '[:lower:]')"
  [[ -z "$v" ]] && return 0
  [[ "$v" == "your_key" || "$v" == "your-key" ]] && return 0
  [[ "$v" == your_* || "$v" == your-* ]] && return 0
  [[ "$v" == "changeme" || "$v" == "replace_me" || "$v" == "todo" ]] && return 0
  [[ "$v" == *"your-project-ref"* || "$v" == *"your-anon-key"* || "$v" == *"your_anon"* ]] && return 0
  [[ "$v" == *"your_openai"* || "$v" == *"your-openai"* ]] && return 0
  [[ "$v" == *"your_gemini"* || "$v" == *"your-gemini"* ]] && return 0
  [[ "$v" == *"your_openweather"* || "$v" == *"your-openweather"* ]] && return 0
  return 1
}

require_env() {
  local name="$1"
  local val="${!name:-}"
  if is_placeholder "$val"; then
    echo "Error: missing or placeholder $name. Set a real value in .env.local (see .env.local.example)." >&2
    exit 1
  fi
}

# Load .env.local if present (KEY=VALUE lines; skips comments / blanks).
if [[ -f .env.local ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      key="${BASH_REMATCH[1]}"
      val="${BASH_REMATCH[2]}"
      if [[ "$val" =~ ^\"(.*)\"$ ]] || [[ "$val" =~ ^\'(.*)\'$ ]]; then
        val="${BASH_REMATCH[1]}"
      fi
      if [[ -z "${!key:-}" ]]; then
        export "$key=$val"
      fi
    fi
  done < .env.local
fi

BASE_URL="${BASE_URL:-${TEST_BASE_URL:-http://localhost:3000}}"
BASE_URL="${BASE_URL%/}"

TRIP_ID="${1:-${TEST_TRIP_ID:-}}"
if [[ -z "$TRIP_ID" ]]; then
  echo "Usage: $0 <trip-uuid>" >&2
  echo "   or: TEST_TRIP_ID=<uuid> $0" >&2
  exit 1
fi

if is_placeholder "${TEST_USER_JWT:-}"; then
  echo "Error: TEST_USER_JWT is required (Bearer for packing generate)." >&2
  echo "Run: node scripts/create-test-user.mjs --write-env" >&2
  exit 1
fi

if is_placeholder "${CRON_SECRET:-}"; then
  echo "Error: CRON_SECRET is required (Bearer token for cron route)." >&2
  exit 1
fi

# Packing generate uses templates — Gemini not required for this smoke script.

print_json() {
  local body="$1"
  if command -v jq >/dev/null 2>&1; then
    printf '%s\n' "$body" | jq .
  else
    printf '%s\n' "$body"
  fi
}

fail_status() {
  local label="$1"
  local status="$2"
  local body="$3"
  echo "✖ $label → HTTP $status (expected 200)" >&2
  print_json "$body" >&2
  exit 1
}

echo "== PackWise API test =="
echo "BASE_URL=$BASE_URL"
echo "TRIP_ID=$TRIP_ID"
echo

# --- 1) POST /api/generate-packing-list ---
echo "[1] POST /api/generate-packing-list"
PACK_BODY_FILE="$(mktemp)"
PACK_STATUS="$(
  curl -sS -o "$PACK_BODY_FILE" -w "%{http_code}" \
    -X POST "$BASE_URL/api/generate-packing-list" \
    -H "Authorization: Bearer ${TEST_USER_JWT}" \
    -H "Content-Type: application/json" \
    -d "{\"tripId\":\"${TRIP_ID}\"}"
)"
PACK_BODY="$(cat "$PACK_BODY_FILE")"
rm -f "$PACK_BODY_FILE"

echo "Status: $PACK_STATUS"
print_json "$PACK_BODY"
if [[ "$PACK_STATUS" != "200" ]]; then
  fail_status "POST /api/generate-packing-list" "$PACK_STATUS" "$PACK_BODY"
fi
echo

# --- 2) GET /api/cron/packing-reminders ---
echo "[2] GET /api/cron/packing-reminders"
CRON_BODY_FILE="$(mktemp)"
CRON_STATUS="$(
  curl -sS -o "$CRON_BODY_FILE" -w "%{http_code}" \
    -X GET "$BASE_URL/api/cron/packing-reminders" \
    -H "Authorization: Bearer ${CRON_SECRET}"
)"
CRON_BODY="$(cat "$CRON_BODY_FILE")"
rm -f "$CRON_BODY_FILE"

echo "Status: $CRON_STATUS"
print_json "$CRON_BODY"
if [[ "$CRON_STATUS" != "200" ]]; then
  fail_status "GET /api/cron/packing-reminders" "$CRON_STATUS" "$CRON_BODY"
fi

echo
echo "✔ All checks passed (HTTP 200)."
