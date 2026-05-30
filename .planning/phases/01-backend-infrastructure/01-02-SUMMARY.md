---
phase: 01-backend-infrastructure
plan: 02
subsystem: database, security
tags: lru, ratelimit, suppression, sqlite

# Dependency graph
requires:
  - phase: 01-backend-infrastructure
    provides: Existing DatabasePoolManager, RateLimitFilter, SqlExecutionService (baseline)
provides:
  - LRU eviction with 20min idle timeout in DatabasePoolManager
  - Scheduled + lazy cleanup for RateLimitFilter counters
  - Call-site scoped @SuppressWarnings for SqlSourceToSinkFlow
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - LinkedHashMap access-order for LRU tracking via Collections.synchronizedMap
    - Double-checked locking for lazy scheduler initialization in Filter
    - ScheduledExecutorService for periodic pool and counter cleanup

key-files:
  created: []
  modified:
    - sqlive-backend/src/main/java/com/douzi/sqlive/service/SqlExecutionService.java
    - sqlive-backend/src/main/java/com/douzi/sqlive/service/database/DatabasePoolManager.java
    - sqlive-backend/src/main/java/com/douzi/sqlive/config/RateLimitFilter.java
    - sqlive-backend/src/test/java/com/douzi/sqlive/service/database/DatabasePoolManagerTest.java

key-decisions:
  - "Pool-full LRU eviction checks 20min idle timeout and throws IllegalStateException when all entries active (deviation: plan assumed existing test would pass unchanged)"
  - "RateLimitFilter cleanup uses lazy removal on expired window access plus scheduled cleanup every 5 minutes"
  - "ScheduledExecutorService threads are daemon threads for clean JVM shutdown"

patterns-established:
  - "DbEntry inner class wraps JdbcTemplate with volatile lastAccessTime for idle detection"
  - "Double-checked locking pattern for lazy Filter scheduler initialization"

requirements-completed: [CORE-03, INFRA-01, INFRA-02]

duration: 8 min
completed: 2026-05-29
---

# Phase 01 Backend Infrastructure Plan 02: Infrastructure Hardening Summary

**Three independent infrastructure fixes: scoped @SuppressWarnings suppression, LRU database pool eviction with idle timeout, and bounded rate limit counter map**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-29T12:37:02Z
- **Completed:** 2026-05-29T12:45:38Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- CORE-03: Moved `@SuppressWarnings("SqlSourceToSinkFlow")` from method-level to the specific `stmt.execute()` call site, scoping the warning suppression precisely
- INFRA-01: Replaced ConcurrentHashMap with `LinkedHashMap` access-order + `Collections.synchronizedMap` for LRU tracking, added `DbEntry` inner class with `volatile long lastAccessTime`, 20-minute idle timeout eviction, scheduled cleanup every 5 minutes, and specific pool-full error response
- INFRA-02: Added `ScheduledExecutorService` to `RateLimitFilter` for scheduled + lazy cleanup of expired counter entries, preventing unbounded ConcurrentHashMap growth

## Task Commits

Each task was committed atomically:

1. **Task 1: Move @SuppressWarnings to specific stmt.execute() call line** - `20d2095` (fix)
2. **Task 2: Implement LRU eviction with idle timeout in DatabasePoolManager** - `ec0adb2` (feat)
3. **Task 3: Add lazy + scheduled cleanup for RateLimitFilter counters** - `6b00fda` (feat)

**Plan metadata:** pending

## Files Created/Modified
- `sqlive-backend/src/main/java/com/douzi/sqlive/service/SqlExecutionService.java` - Removed method-level @SuppressWarnings, added call-site scoped annotation; added IllegalStateException catch for pool-full errors
- `sqlive-backend/src/main/java/com/douzi/sqlive/service/database/DatabasePoolManager.java` - Complete rewrite: ConcurrentHashMap -> LinkedHashMap access-order, DbEntry inner class, ScheduledExecutorService cleanup, LRU eviction with idle timeout, pool-full error
- `sqlive-backend/src/main/java/com/douzi/sqlive/config/RateLimitFilter.java` - Added ScheduledExecutorService with double-checked lazy init, cleanupExpiredEntries/cleanupMap methods, lazy remove on expired window access
- `sqlive-backend/src/test/java/com/douzi/sqlive/service/database/DatabasePoolManagerTest.java` - Added shouldThrowWhenAllDatabasesActive test; updated shouldEvictWhenPoolExceedsMaxDatabases for new semantics

## Decisions Made
- Pool-full eviction attempts to evict the LRU idle entry (20min+); when all entries are active, throws `IllegalStateException` with specific message handled by `SqlExecutionService`
- Scheduled cleanup runs every 5 minutes for both database pool and rate limit counters
- Daemon threads for cleanup schedulers ensure clean JVM shutdown without explicit shutdown hooks

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated shouldEvictWhenPoolExceedsMaxDatabases test assertion**
- **Found during:** Task 2 (LRU eviction implementation)
- **Issue:** The plan stated the existing test `shouldEvictWhenPoolExceedsMaxDatabases()` would pass unchanged, but the new LRU+idle eviction causes the 21st sequential create to throw `IllegalStateException` (all entries are recently created, none idle for 20+ min). The plan's explicit eviction logic (`if now - entry.lastAccessTime >= IDLE_TIMEOUT_MS`) contradicts the test expectation.
- **Fix:** Updated the test to expect `IllegalStateException` on the 21st create and verify pool remains at `MAX_DATABASES` (20)
- **Files modified:** `DatabasePoolManagerTest.java`
- **Verification:** `./gradlew test --tests "DatabasePoolManagerTest"` passes (9/9 tests)
- **Committed in:** `ec0adb2` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1)
**Impact on plan:** Minor test update. No behavior change -- the plan's intended behavior (idle timeout check + throw on all-active) is preserved. The test was adjusted to match the correct expected behavior.

## Issues Encountered
- Gradle wrapper jar was missing from the worktree (gitignored file). Copied from main repo's `gradle/wrapper/` directory to enable builds.

## Next Phase Readiness
- All three infrastructure hardening items completed and verified
- Backend builds and all tests pass
- Ready for next plan in this phase

---

*Phase: 01-backend-infrastructure*
*Completed: 2026-05-29*

## Self-Check: PASSED

- All 4 modified files verified on disk
- SUMMARY.md exists
- All 3 task commits verified in git log
- Full backend build passes with all tests
