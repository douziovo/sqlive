---
phase: 02-parser-unification-data-layer
plan: 01
subsystem: backend
tags: spring-boot, sqlite, jdbc, regex, topological-sort, validation

# Dependency graph
requires:
  - phase: 01-backend-infrastructure
    provides: Existing SqlRequest.java, SqlExecutionService.java, DatabasePoolManager, MetadataExtractor
provides:
  - Unified dbName validation regex across DTO and pool layers (CORE-04)
  - FK-safe clearDatabase() with topological drop ordering (CORE-02)
affects: [04-security-hardening] # SEC-01 also modifies SqlExecutionService

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Kahn's algorithm (topological sort) for FK-safe DROP TABLE ordering"
    - "Consistent dbName validation regex shared by DTO @Pattern and pool layer DB_NAME_PATTERN"

key-files:
  created: []
  modified:
    - sqlive-backend/src/main/java/com/douzi/sqlive/dto/SqlRequest.java
    - sqlive-backend/src/main/java/com/douzi/sqlive/service/SqlExecutionService.java

key-decisions:
  - "Used MetadataExtractor.extractForeignKeys() as the single FK data source for topological sort — no separate FK query"
  - "Extracted topological sort to private method for testability and lambda-capture safety"
  - "Natural Kahn's output (leaf-first) matches correct DROP TABLE order — no reversal needed"

patterns-established:
  - "Topological FK sort: clearDatabase() builds adjacency list from ForeignKeyInfo.fromTable to ForeignKeyInfo.toTable, then applies Kahn's algorithm for leaf-to-root DROP order"

requirements-completed: [CORE-04, CORE-02]

# Metrics
duration: 15min
completed: 2026-05-29
---

# Phase 02 Plan 01: Infrastructure Hardening Summary

**Unified dbName validation regex across SqlRequest and DatabasePoolManager; FK-safe DROP TABLE ordering in clearDatabase() using Kahn's topological sort**

## Performance

- **Duration:** 15 min
- **Started:** 2026-05-29T22:50:00Z
- **Completed:** 2026-05-29T23:05:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- **CORE-04 (Unified dbName regex):** SqlRequest.java `@Pattern` annotation changed from `^[^?&=#;/\\:]{0,64}$` to `^[a-zA-Z0-9_-]{1,64}$`, exactly matching `DatabasePoolManager.DB_NAME_PATTERN`. Invalid dbNames now produce consistent 4xx validation errors at the DTO layer instead of reaching the pool layer for 500 rejection.
- **CORE-02 (FK-safe clearDatabase):** Removed `PRAGMA foreign_keys = OFF/ON` calls from `clearDatabase()`, eliminating the race window on shared connections. Implemented `topologicalSortTables()` using Kahn's algorithm (O(V+E)) that orders DROP TABLE by FK dependency leaf-to-root (referencing tables before referenced tables). FK cycles trigger a `log.warn` with the involved table names and fall back to arbitrary-order drops.

## Task Commits

Each task was committed atomically:

1. **Task 1: Unify dbName validation regex (CORE-04)** - `2ecd15a` (fix/02-parser-unification-data-layer-01)
2. **Task 2: FK-safe clearDatabase() with topological sort (CORE-02)** - `aab2a49` (fix/02-parser-unification-data-layer-01)

## Files Created/Modified

- `sqlive-backend/src/main/java/com/douzi/sqlive/dto/SqlRequest.java` - `@Pattern` regex changed to `^[a-zA-Z0-9_-]{1,64}$` with descriptive error message
- `sqlive-backend/src/main/java/com/douzi/sqlive/service/SqlExecutionService.java` - `clearDatabase()` rewritten: PRAGMA calls removed, topological sort via `topologicalSortTables()`, imports consolidated to `java.util.*`

## Decisions Made

- **Extracted topological sort to private method** — avoids Java lambda effective-final capture issue with reassigned variables, improves testability
- **MetadataExtractor.extractForeignKeys() as FK data source** — reuses existing infrastructure rather than adding a separate FK query path
- **Natural Kahn's output (leaf-first) IS the correct DROP order** — referencing tables (fromTable) have inDegree 0 and come first; referenced tables (toTable) come last

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- **Java lambda capture of non-final variable (Task 2):** The initial inline implementation assigned `sortedTableNames` in both the cycle-handling and normal branches, making the variable not effectively final for the lambda in `jdbc.execute()`. Fixed by extracting the topological sort logic to a private `topologicalSortTables()` method that returns the computed list.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 02 Plan 02 (canonical statement boundary frontend unification) can proceed
- Phase 04 (SEC-01: ATTACH DATABASE disable) must account for the refactored `clearDatabase()` — no longer has a transactional wrapper with PRAGMA calls, drops are still inside `jdbc.execute()`

---
*Phase: 02-parser-unification-data-layer*
*Completed: 2026-05-29*
