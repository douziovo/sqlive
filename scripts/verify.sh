#!/usr/bin/env bash
# 用法和验证范围见 docs/TESTING.md。
set -eu

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if command -v cygpath >/dev/null 2>&1 && [ -n "${JAVA_HOME:-}" ]; then
  export JAVA_HOME="$(cygpath -u "$JAVA_HOME")"
fi

if [ "$#" -gt 1 ] || { [ "$#" -eq 1 ] && [ "$1" != "--smoke" ]; }; then
  echo "Usage: $0 [--smoke]" >&2
  exit 2
fi

if [ "${1:-}" = "--smoke" ]; then
  cd "$ROOT_DIR/sqlive-frontend"
  exec pnpm run test:e2e -- --grep @smoke
fi

cd "$ROOT_DIR/sqlive-backend"
./gradlew test --no-daemon
cd "$ROOT_DIR/sqlive-frontend"
pnpm test
pnpm run build
