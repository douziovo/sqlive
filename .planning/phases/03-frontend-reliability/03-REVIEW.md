---
phase: 03-frontend-reliability
reviewed: 2026-05-30T18:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - sqlive-frontend/src/utils/sqlStatements.ts
  - sqlive-frontend/src/utils/tupleParser.ts
  - sqlive-frontend/src/composables/useBidirectionalSync.ts
  - sqlive-frontend/src/composables/useInlineEdit.ts
  - sqlive-frontend/src/composables/useTablePipeline.ts
  - sqlive-frontend/src/composables/useSortFilter.ts
  - sqlive-frontend/src/components/DataVisualizer.vue
  - sqlive-frontend/src/components/TableSection.vue
  - sqlive-frontend/src/__tests__/utils/sqlStatements.test.ts
findings:
  critical: 0
  warning: 10
  info: 0
  total: 10
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-05-30T18:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Reviewed 6 source files and 3 utility/composable files for the frontend reliability phase (emit type safety, VARCHAR truncation, ghost row persistence). The code is well-structured overall but contains several logic bugs and quality defects that could cause incorrect behavior at runtime. Ten warnings identified covering state machine inconsistency, silent error handling, resource leaks, and fragile SQL matching logic.

## Warnings

### WR-01: State machine stranded in `reconciling` on tuple-not-found

**File:** `sqlive-frontend/src/composables/useBidirectionalSync.ts:92, 110`

**Issue:** Both `updateRow()` and `deleteRow()` call `beginReconcile()` (line 36-38), which transitions `mode.value` to `'reconciling'`. If `findTupleInBatch()` returns null (no matching VALUES tuple found), the functions return without a transition back to `'user'`. This leaves the state machine stuck in `'reconciling'`, blocking all future edits. The `console.warn` on line 106 acknowledges the failure path but does not restore the mode.

**Fix:** Either reset the mode in the not-found path, or defer `beginReconcile()` until after `findTupleInBatch()` confirms a match:

```typescript
// Option A: Reset mode on failure
const updateRow = (tableName: string, oldRow: Row, newRowData: Row) => {
  beginReconcile()
  const statements = getCanonicalStatements() ?? extractSqlStatements(code.value)
  for (const stmt of statements) {
    const match = findTupleInBatch(stmt.text, tableName, oldRow)
    if (match) {
      // ... existing replacement logic ...
      return
    }
  }
  mode.value = 'user'  // <-- restore mode on failure
  console.warn('...')
}

// Option B (better): Call beginReconcile() only after confirming match
```

---

### WR-02: Line comment stripping corrupts string literals containing `--`

**File:** `sqlive-frontend/src/composables/useBidirectionalSync.ts:53`

**Issue:** `findTupleInBatch()` strips line comments with a naïve regex `stmtText.replace(/--.*$/gm, '')` that does not respect string boundaries. If a VALUES tuple contains a string literal with `--` (e.g., `INSERT INTO t VALUES ('hello -- world')`), the regex removes `-- world')` from the statement, corrupting the SQL. This causes `extractTuplesWithDepth()` to misparse the tuples and `splitTupleContent()` to produce wrong values.

**Fix:** Implement line-comment removal that tracks quote state, or skip the `cleanStmt` step and handle comments inline during tuple parsing. Since `extractTuplesWithDepth` already tracks string state, the clean step can be removed and comment awareness added to the tuple parser:

```typescript
// In tupleParser.ts: add line-comment awareness to extractTuplesWithDepth
// The existing code already tracks inString. Add:
let inLineComment = false

while (i < sql.length) {
  const c = sql[i]
  const next = sql[i + 1] || ''

  if (inLineComment) {
    if (c === '\n') inLineComment = false
    i++
    continue
  }

  if (!inString && c === '-' && next === '-') {
    inLineComment = true
    i += 2
    continue
  }
  // ... rest of existing logic
}
```

---

### WR-03: `findTupleInBatch` does not escape tableName for regex interpolation

**File:** `sqlive-frontend/src/composables/useBidirectionalSync.ts:54`

**Issue:** The `tableName` variable is interpolated directly into a RegExp constructor without escaping special characters. If a table name contains regex metacharacters (e.g., `.`, `+`, `*`, `$`), the regex would produce incorrect matches or fail. Compare with `dropTableUI()` on line 184, which correctly escapes the table name via `tableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`.

**Fix:** Apply the same escaping used in `dropTableUI`:

```typescript
const escapedTable = tableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const insertRegex = new RegExp(`INSERT\\s+INTO\\s+(?:[\`"']?)${escapedTable}(?:[\`"']?)\\b`, 'i')
```

---

### WR-04: `indexOf` tuple position lookup targets wrong tuple for duplicate values

**File:** `sqlive-frontend/src/composables/useBidirectionalSync.ts:81`

**Issue:** `findTupleInBatch` locates the matched tuple's position via `stmtText.indexOf(`(${tuple.content})`)`. This always returns the first occurrence of the tuple content in the statement. If two VALUES tuples have identical content (duplicate rows), and the user edits the row corresponding to the second tuple, the code replaces the first tuple instead. After re-execution, the first row is modified and the second remains unchanged.

**Fix:** Use the positional information already available from `extractTuplesWithDepth` (`tuple.start`), which correctly indexes each tuple by its actual position. The `findTupleInBatch` return value should use `tuple.start` (relative to `stmtText`) instead of re-resolving via `indexOf`:

```typescript
// Use tuple.start from extractTuplesWithDepth instead of stmtText.indexOf(...)
if (isMatch) {
  return {
    start: tuple.start,
    end: tuple.end,
    explicitCols: compareCols
  }
}
```

---

### WR-05: `insertRowUI` crashes on missing column type entry

**File:** `sqlive-frontend/src/composables/useBidirectionalSync.ts:154`

**Issue:** The filter on virtual columns accesses `table.columnTypes[c].includes('VIRTUAL')`. If `c` is not a key in `columnTypes`, this evaluates to `undefined.includes(...)` which throws `TypeError: Cannot read properties of undefined`. The `addNewTable` function has the same pattern at line 170.

**Fix:** Add optional chaining:

```typescript
const physicalColumns = table.columns.filter((c) => !table.columnTypes[c]?.includes('VIRTUAL'))
```

---

### WR-06: Debug artifact `console.warn` violates Biome rules

**File:** `sqlive-frontend/src/composables/useBidirectionalSync.ts:106`

**Issue:** The `console.warn('...')` call on line 106 is flagged by Biome's `noConsole` rule (configured to warn severity, allowing only `console.log` per CLAUDE.md). This is a debug artifact that should not ship to production.

**Fix:** Remove or replace with a silent no-op. The failure path should also restore the state machine mode (see WR-01):

```typescript
// Remove the console.warn or replace with import.meta.env.DEV guard
if (import.meta.env.DEV) {
  console.warn('无法定位原始代码行 (Batch Mode)')
}
```

---

### WR-07: Truncation tooltip timeout not cleaned up on unmount

**File:** `sqlive-frontend/src/components/TableSection.vue:461-467`

**Issue:** The `setTimeout` inside the `onTruncation` callback auto-clears truncation warnings after 5 seconds, but the timer ID is never stored nor cleared in `onUnmounted`. If the component unmounts before the timeout fires, the callback executes on a detached component, attempting to update `truncatedCells.value`. While Vue 3 may handle this gracefully, it is a resource leak and can produce development-mode warnings.

**Fix:** Store the timeout ID and clear it in `onUnmounted`:

```typescript
const truncationTimers = ref<ReturnType<typeof setTimeout>[]>([])

// In the callback:
const timer = setTimeout(() => { ... }, 5000)
truncationTimers.value.push(timer)

onUnmounted(() => {
  truncationTimers.value.forEach(clearTimeout)
  // ... existing cleanup
})
```

---

### WR-08: Ghost row error watch reacts to ALL execution errors

**File:** `sqlive-frontend/src/components/TableSection.vue:500-504`

**Issue:** The watch on `error` sets `ghostFailed = true` whenever ANY execution error occurs while `ghostPending` is true. Since SQL execution follows a full-script re-execution model, an error in any unrelated statement (e.g., a typo in an earlier SELECT) after a ghost insert submit would falsely mark the insert as failed. The user sees "插入失败，检查数据后重试" and the ghost row remains visible, even though the INSERT itself succeeded.

**Fix:** The `error` context does not currently carry correlation information (which statement failed). A pragmatic improvement is to reset `ghostPending` on ANY error to avoid stale state, without automatically marking `ghostFailed`:

```typescript
watch(error, (err) => {
  if (ghostPending.value) {
    ghostPending.value = false
    // Only set ghostFailed if we can correlate the error to the insert
    // For now, reset ghostPending without marking as failed;
    // the user can verify the ghost row manually
  }
})
```

Alternatively, store the `previousRowCount` before the insert and check if the row count actually decreased (implying the entire script failed and the insert was rolled back), rather than reacting to any error.

---

### WR-09: `handleBlur` silently discards invalid user input

**File:** `sqlive-frontend/src/composables/useInlineEdit.ts:28, 32`

**Issue:** Two validation checks silently return without updating the cell, providing zero user feedback:
- Line 28: Non-numeric value entered into a numeric column — the edit is silently rejected.
- Line 32: Empty value entered for a NOT NULL column — the edit is silently rejected.

In both cases, the textarea still shows the invalid value (because the bound value is not updated), creating a confusing UX where the user types but the value reverts unpredictably.

**Fix:** Provide a visual feedback mechanism (e.g., a flash on the cell, a console warning in dev mode, or reverting the textarea value to the original immediately):

```typescript
if (isNumericType(typeUpper) && newVal !== '') {
  if (Number.isNaN(Number(newVal))) {
    target.value = String(oldVal) // revert
    return
  }
}

if (typeUpper.includes('NOT NULL')) {
  if (newVal === '' || newVal.trim() === '') {
    target.value = String(oldVal) // revert
    return
  }
}
```

---

### WR-10: Event emit chain violates 3-layer guideline

**File:** `sqlive-frontend/src/components/TableSection.vue:454` / `DataVisualizer.vue:42-47`

**Issue:** The `update-cell` event originates from `useInlineEdit.handleBlur` inside `TableSection.vue`, is re-emitted by `TableSection`'s `emit`, then re-emitted again by `DataVisualizer.vue` (lines 42-47), and finally handled by the parent component. This is a 3-layer emit chain that violates the project's CLAUDE.md guideline: "Props/events 3+ layers deep -> provide/inject." The same pattern applies to `delete-row`, `insert-row`, and `drop-table`.

**Fix:** Use `provide`/`inject` with a callback function instead of chained emits. For example, inject an `onUpdateCell` function from the parent context into `DataVisualizer` and `TableSection`:

```typescript
// In the parent (App.vue or useSqlEngine provider):
provide('onUpdateCell', (payload: CellUpdateEvent) => { ... })

// In TableSection:
const onUpdateCell = inject('onUpdateCell')!
// Use directly instead of emit('update-cell', ...)
```

---

_Reviewed: 2026-05-30T18:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
