---
phase: 02-parser-unification-data-layer
plan: 02
name: Backend canonical statements + frontend consumption
subsystem: parser-unification
tags: [backend, frontend, sql-parser, bidirectional-sync, canonical-statements]
dependency-graph:
  requires: [02-01]
  provides: [02-03]
  affects: [SqlParser, SqlResponse, SqlExecutionService, DatabaseTypes, ApiTypes, useSqlEngine, useBidirectionalSync]
tech-stack:
  added: []
  patterns: [backend-exposes-canonical-boundaries, frontend-falls-back-to-local-parser]
key-files:
  created: []
  modified:
    - sqlive-backend/src/main/java/com/douzi/sqlive/service/sql/SqlParser.java
    - sqlive-backend/src/main/java/com/douzi/sqlive/dto/SqlResponse.java
    - sqlive-backend/src/main/java/com/douzi/sqlive/service/SqlExecutionService.java
    - sqlive-frontend/src/model/DatabaseTypes.ts
    - sqlive-frontend/src/model/ApiTypes.ts
    - sqlive-frontend/src/composables/useSqlEngine.ts
    - sqlive-frontend/src/composables/useBidirectionalSync.ts
decisions: []
metrics:
  duration: ~15 min
  completed_date: 2026-05-29
---

# Phase 02 Plan 02: Backend canonical statements + frontend consumption SUMMARY

Unify SQL parsing between frontend and backend by having the backend expose canonical statement character offsets that the frontend uses instead of its own parser for inline cell editing operations.

## Commits

| Hash | Message |
|------|---------|
| `7908098` | feat(02-parser-unification-data-layer-02): add startPos to SqlStatement, CanonicalStatement DTO, canonicalStatements in response |
| `cb400d4` | feat(02-parser-unification-data-layer-02): wire canonicalStatements through frontend to useBidirectionalSync |

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Backend — add startPos to SqlStatement and canonicalStatements to SqlResponse | `7908098` | SqlParser.java, SqlResponse.java, SqlExecutionService.java |
| 2 | Frontend — CanonicalStatement type, useSqlEngine pass-through, useBidirectionalSync consumption | `cb400d4` | DatabaseTypes.ts, ApiTypes.ts, useSqlEngine.ts, useBidirectionalSync.ts |

## Deviations from Plan

### Deferred (pre-existing)

**1. Pre-existing test failure: `useSqlEngine.test.ts` URL assertion**
- **Issue:** Test at line 312 asserts `fetch` was called with `'http://localhost:8080/api/execute'` but the actual code calls with `'/api/execute'` (config.ts fallback when `VITE_API_URL` env var is not set in test environment).
- **Root cause:** Config mismatch between test-utils.ts (hardcoded full URL) and config.ts (relative path fallback). Pre-existing — reproduced with all plan changes stashed.
- **Scope:** Not caused by this plan's changes. Out of scope per executor rules.

## Known Stubs

None — all changes are fully wired. No placeholder or mock data paths.
No new dependencies introduced. No security-relevant surface created beyond the planned canonicalStatements response field.

## Threat Flags

None found — canonicalStatements are derived from user-submitted SQL boundaries, no new attack surface.

## Verification Summary

| Check | Result |
|-------|--------|
| `./gradlew test` | PASS (23s, all tests green) |
| `npx vue-tsc --noEmit` | PASS (no errors) |
| `npm run test` | 510/511 pass; 1 pre-existing failure unrelated to plan |
| `CanonicalStatement` in SqlResponse.java | Found (2 occurrences) |
| `startPos` in SqlParser.java | Found (1 occurrence) |
| `getCanonicalStatements` in useBidirectionalSync.ts | Found (4 occurrences) |
| `extractSqlStatements` fallback in useBidirectionalSync.ts | Preserved (4 occurrences: 1 import + 3 fallback usages) |

## Success Criteria Met

- [x] CORE-01: Backend /api/execute includes canonicalStatements [{start, end}] in data payload
- [x] CORE-01: Frontend useBidirectionalSync uses canonicalStatements when available, falls back to extractSqlStatements when absent
- [x] CORE-01: TypeScript compilation + all tests pass (1 pre-existing failure excluded)
- [x] CORE-01: extractSqlStatements preserved (not removed per D-05)

## Self-Check: PASSED

All 7 files verified modified. Both commits verified in git log (`7908098`, `cb400d4`).
