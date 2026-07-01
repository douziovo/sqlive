#!/usr/bin/env bash
# verify.sh — one-command verification for sqlive
#
# Usage:
#   ./scripts/verify.sh          # full: gradle test + npm test + npm run build
#   ./scripts/verify.sh --smoke  # smoke: playwright @smoke subset only (< 50% of full)
#
# Exit 0 = all green. Hook (PostToolUse Write|Edit) uses --smoke for fast feedback.
set -e

# Resolve repo root from script location so CWD doesn't matter.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Resolve JAVA_HOME — the system env often carries a Windows-style path
# (e.g. C:\Program Files\Zulu\zulu-21) that bash's gradlew cannot use
# (backslashes break [ -x "$JAVA_HOME/bin/java" ]). Fall back to the MSYS
# path when JAVA_HOME is unset or not usable from bash.
if [ -z "$JAVA_HOME" ] || [ ! -x "$JAVA_HOME/bin/java" ]; then
  export JAVA_HOME="/c/Program Files/Zulu/zulu-21"
fi
export PATH="$JAVA_HOME/bin:$PATH"

if [ "$1" = "--smoke" ]; then
  cd "$ROOT_DIR/sqlive-frontend"
  npx playwright test --config tests/e2e/playwright.config.ts --grep @smoke --project=chrome
  exit 0
fi

# Full verification
cd "$ROOT_DIR/sqlive-backend"
./gradlew test --no-daemon
cd "$ROOT_DIR/sqlive-frontend"
npm test
npm run build
