---
plan: 03-03
phase: 03-frontend-reliability
status: completed
duration: 2 min
---

## Plan 03-03: Ghost Row Persistence on Failed Insert

**Completed:** 2026-05-30

### What was built

**FRONT-03:** When a user fills the ghost row and submits, the row is no longer cleared immediately. Instead, success is detected by watching the target table's row count increase. On failure (executionError becomes non-null), the ghost row stays visible with red-tinted background (`bg-destructive/5`, `border-dashed border-destructive/30`) and error hint text "插入失败，检查数据后重试". The submit button remains visible so the user can edit and retry.

### Tasks completed

| Task | File(s) | Status |
|------|---------|--------|
| 1. Implement ghost row pending state, success/failure detection, failure styling | `TableSection.vue` | Done |

### Key files

| File | Change |
|------|--------|
| `TableSection.vue` | Injects `error` from SQL_CONTEXT_KEY; adds ghostPending/ghostFailed refs; onGhostSubmit sets pending flag; success watch on data.length; failure watch on error ref; dynamic :class for failure styling; error hint row |

### Verification

- `npx vitest run`: 32 test files, 511 tests — all passed

### Self-Check: PASSED
