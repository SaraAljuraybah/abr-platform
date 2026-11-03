#!/usr/bin/env bash
# Runs a command up to 3 times, waiting 30s and then 90s between attempts (CI only).
# Usage: scripts/ci/retry.sh <command> [args...]
#
# Only the successful attempt's stdout reaches stdout, so `retry.sh supabase gen types ... > file`
# never mixes a failed attempt's output into the file. Failed attempts' output goes to stderr.
# A registry rate limit ("toomanyrequests") is called out: it is not a code problem.
# RETRY_DELAYS overrides the waits (seconds, space-separated), for local dry runs.
set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "usage: $0 <command> [args...]" >&2
  exit 2
fi

read -r -a delays <<< "${RETRY_DELAYS:-30 90}"
attempts=$((${#delays[@]} + 1))
out="$(mktemp)"
err="$(mktemp)"
trap 'rm -f "$out" "$err"' EXIT

for ((attempt = 1; attempt <= attempts; attempt++)); do
  status=0
  "$@" > "$out" 2> "$err" || status=$?
  if [ "$status" -eq 0 ]; then
    cat "$err" >&2
    cat "$out"
    exit 0
  fi

  echo "Attempt $attempt/$attempts failed (exit $status): $*" >&2
  cat "$out" "$err" >&2
  if grep -q "toomanyrequests" "$out" "$err"; then
    # stderr: the runner reads workflow commands there too, and stdout may be redirected to a file.
    echo "::error::Registry rate limit (toomanyrequests): not a code problem, re-run the job later." >&2
  fi
  if [ "$attempt" -lt "$attempts" ]; then
    wait_for="${delays[$((attempt - 1))]}"
    echo "Retrying in ${wait_for}s..." >&2
    sleep "$wait_for"
  fi
done

exit "$status"
