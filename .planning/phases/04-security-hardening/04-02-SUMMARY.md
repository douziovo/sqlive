---
phase: 04-security-hardening
plan: 02
subsystem: sqlive-backend
tags: [test, security, attach, pragma, regression]
dependency-graph:
  requires: [04-01]
  provides: [SEC-01-verified]
  affects: [SqlExecutionService, SqlExecutionServiceTest]
tech-stack:
  added: []
  patterns:
    - Pattern.find() for partial-match regex (not matches())
    - Multi-statement test scripts for line-number verification
key-files:
  created: []
  modified:
    - sqlive-backend/src/main/java/com/douzi/sqlive/service/SqlExecutionService.java
    - sqlive-backend/src/test/java/com/douzi/sqlive/service/SqlExecutionServiceTest.java
decisions:
  - Pattern.find() used instead of matches() for ATTACH/PRAGMA blocking -- matches() requires full-string match which blocks nothing for multi-word statements
metrics:
  duration: 13m
  completed-date: 2026-05-30
---

# Phase 04 Plan 02: SEC-01 Test Coverage for ATTACH/PRAGMA Blocking

Added 9 test methods (4 ATTACH, 4 PRAGMA, 1 regression with 4 scenarios) to SqlExecutionServiceTest to verify SEC-01 blocking behavior. Discovered and fixed a critical bug in the production code from 04-01 where `Pattern.matches()` was used instead of `find()`, making the entire blocking logic dead code.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking bug] Pattern.matches() prevents ATTACH/PRAGMA blocking from ever working**

- **Found during:** Task 1 execution -- all 4 ATTACH tests failed with SQLite execution errors instead of security block errors
- **Root cause:** `isBlockedStatement()` used `Matcher.matches()` which requires the ENTIRE string to match the regex pattern. Since ATTACH and PRAGMA statements always have content after the keyword (e.g., `"ATTACH DATABASE 'path' AS aux;"`), `matches()` returns `false` for all real-world inputs.
- **Fix:** Changed `matches()` to `find()` in both `ATTACH_PATTERN.matcher(sql).matches()` and `PRAGMA_PATTERN.matcher(sql).matches()` calls. The `^` anchor in the patterns ensures `find()` only matches at the start of the string, preserving the intended behavior.
- **Files modified:** `SqlExecutionService.java`
- **Commit:** `00f17a7`
- **Impact:** This was a critical security regression from 04-01 -- the ATTACH DATABASE and PRAGMA blocking was entirely non-functional. Users could execute `ATTACH DATABASE '/etc/passwd' AS aux;` to read any server file, and `PRAGMA database_list;` to enumerate databases. Neither was blocked before this fix.

**2. [Plan data dependency bug] Regression test INSERT depends on table from separate DB**

- **Found during:** Task 3 implementation -- the plan specified `INSERT INTO demo VALUES (1)` with dbName `"reg_test_dml"` but the `CREATE TABLE demo` was in a separate call with dbName `"reg_test_ddl"` (different database). The INSERT would fail because the table doesn't exist.
- **Fix:** Combined `CREATE TABLE demo (id INTEGER); INSERT INTO demo VALUES (1); SELECT * FROM demo;` into a single execute call with `"reg_test_ddl"`, and changed the third scenario to a simple `SELECT 2;` with `"reg_test_dml"`.
- **Files modified:** `SqlExecutionServiceTest.java`
- **Commit:** `5321c41`

### Scope Boundary Notes

An old JaCoCo deprecation warning was already present in the build output and is not addressed here (pre-existing, out of scope).

## Results

### Test Methods Added (9 total)

| Test Method | What It Verifies | dbName |
|-------------|------------------|--------|
| `shouldRejectAttachDatabase` | Full ATTACH DATABASE 'path' AS name syntax | attach_test_attachdb |
| `shouldRejectAttachShorthand` | ATTACH ':memory:' AS mem shorthand | attach_test_shorthand |
| `shouldRejectAttachLowercase` | Lowercase 'attach' is also blocked | attach_test_lowercase |
| `shouldRejectAttachInScript` | ATTACH on line 2 of multi-line script, line=2 | attach_test_script |
| `shouldRejectPragmaStatement` | Standard PRAGMA statement, line=1 | pragma_test_std |
| `shouldRejectPragmaWithLeadingWhitespace` | Leading whitespace before PRAGMA | pragma_test_ws |
| `shouldRejectPragmaInScript` | PRAGMA on line 3 of multi-line script, line=3 | pragma_test_script |
| `shouldRejectVariousPragmaNames` | Both journal_mode and cache_size blocked | pragma_test_names1/2 |
| `shouldAllowNormalStatementsDespiteBlockingCheck` | SELECT, CREATE+INSERT+SELECT, SELECT (simple), whitespace-prefixed SELECT all succeed | reg_test_* |

### Verification

- `./gradlew test` -- All existing tests + 9 new tests pass (BUILD SUCCESSFUL in 17s)
- Error message assertions match D-09 (`"ATTACH DATABASE is not allowed for security reasons"`) and D-10 (`"PRAGMA statements are not allowed"`) exactly
- Line number assertions: single-statement is line 1, ATTACH on line 2 in multi-line, PRAGMA on line 3 in multi-line

## Commits

| Commit | Message |
|--------|---------|
| `00f17a7` | fix(04-01): change Pattern.matches() to find() in isBlockedStatement() |
| `db8b93e` | test(04-02): add ATTACH DATABASE blocking test cases |
| `c007257` | test(04-02): add PRAGMA blocking test cases |
| `5321c41` | test(04-02): add regression tests for normal SQL unaffected by blocking |

## Threat Surface

No new threat flags. The production code fix (matches() to find()) restores the intended security posture of SEC-01, which was previously non-functional.

## Self-Check: PASSED

- All files exist and are modified
- All 4 commits verified in git log
- Full test suite passes
