---
plan: 03-01
phase: 03-frontend-reliability
status: completed
duration: 2 min
---

## Plan 03-01: Emit Type Safety + ER Diagram Position Persistence

**Completed:** 2026-05-30

### What was built

**FRONT-01:** `useInlineEdit` emit parameter changed from `(e: string, ...args: any[]) => void` to generic `EmitFn extends (e: string, ...args: any[]) => void`. Callers (TableSection.vue) get full type inference via Vue's `defineEmits` — no caller-side changes needed.

**FRONT-04:** `DataVisualizer.vue` tab conditional chain restructured. All `v-else-if` and `v-else` directives converted to independent `v-if`, and the ER diagram tab uses `v-show` instead of `v-else-if`. This keeps `ErDiagram.vue` mounted across tab switches, preserving vue-flow's internal dagre-computed node positions.

### Tasks completed

| Task | File(s) | Status |
|------|---------|--------|
| 1. Make useInlineEdit emit parameter generic | `useInlineEdit.ts` | Done |
| 2. Restructure DataVisualizer tab chain to v-show for ER | `DataVisualizer.vue` | Done |

### Key files

| File | Change |
|------|--------|
| `sqlive-frontend/src/composables/useInlineEdit.ts` | Added `<EmitFn extends ...>` generic, changed emit param type |
| `sqlive-frontend/src/components/DataVisualizer.vue` | v-else-if chain → independent v-if + v-show for ER |

### Verification

- `npx vitest run`: 32 test files, 511 tests — all passed
- `npx vue-tsc -b --noEmit`: No new errors (5 pre-existing unrelated TS warnings)
- `git diff` clean — no leftover debug code or scaffolding

### Self-Check: PASSED
