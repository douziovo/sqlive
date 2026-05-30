# Phase 3: Frontend Reliability - Research

**Researched:** 2026-05-30
**Domain:** Vue 3 frontend reliability (emit type safety, VARCHAR truncation warning, ghost row state persistence, ER diagram position preservation)
**Confidence:** HIGH

## Summary

Phase 3 comprises 4 independent frontend bug fixes, all in the TypeScript/Vue layer. No backend changes, no new dependencies, and minimal changes per fix. Each fix addresses a distinct reliability issue: (1) type-safe emit signatures, (2) silent VARCHAR truncation now warns the user, (3) failed row inserts preserve user input, and (4) ER diagram nodes maintain positions across tab switches.

The fixes touch 5 files, with the most complex changes in `TableSection.vue` (ghost row lifecycle + truncation warning display) and `sqlStatements.ts` + `useInlineEdit.ts` (truncation detection pipeline). FRONT-04 (ER diagram) is the simplest change -- a single `v-else-if` to `v-show` swap plus restructuring of the tab conditional chain.

**Primary recommendation:** Apply the 4 fixes in order FRONT-01, FRONT-04, FRONT-02, FRONT-03 (least risk first), then verify with `npm run test` and manual checks against the success criteria.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `useInlineEdit` emit parameter changed to generic: `emit: EmitFn` where `EmitFn extends (e: string, ...args: any[]) => void`
- **D-02:** Only fix `useInlineEdit.ts`, no full-chain emit audit
- **D-03:** `enforceTypeConstraints` return value changed from bare `val` to `{ value: any, truncated?: { originalLength: number, maxLength: number } }`
- **D-04:** Truncation warning UI uses inline tooltip near the edited cell
- **D-05:** `handleBlur` detects truncated field, propagates to `TableSection`
- **D-06:** `onGhostSubmit` no longer clears `ghostRow` immediately, only after confirmed successful insert
- **D-07:** Insert success detected by `TableSection` watching `db.tables` for target table `rows.length` increase
- **D-08:** On `executionError` non-null, `ghostRow` stays, user can retry
- **D-09:** `DataVisualizer.vue` ER tab changes `v-else-if="activeTab === 'er'"` to `v-show="activeTab === 'er'"`
- **D-10:** Component stays mounted, vue-flow positions persist naturally

### Claude's Discretion

- `EmitFn` generic constraint implementation style (`extends` vs direct generic parameter)
- Inline truncation warning UI specifics (CSS tooltip vs short text hint vs hover-card)
- Truncation info propagation from `useInlineEdit` to `TableSection` (new ref vs callback param)
- Ghost row clear watch implementation (deep watch `db.tables` vs explicit target table row count watch)
- Whether `onPaneReady` initial layout logic needs adjustment after `v-show` change (retain -- first render still needs it)

### Deferred Ideas (OUT OF SCOPE)

- None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FRONT-01 | `useInlineEdit` emit parameter changed to generic TypeScript, preserving type safety | `useInlineEdit.ts` line 7 uses `emit: (e: string, ...args: any[]) => void` -- change to `emit: EmitFn` with `EmitFn extends (e: string, ...args: any[]) => void`. Caller `TableSection.vue` line 424 passes `emit` from `defineEmits`. Only 1 file changed. |
| FRONT-02 | `enforceTypeConstraints` truncation warning via inline tooltip, no silent data loss | `sqlStatements.ts` `enforceTypeConstraints` (line 74-84) return type changes from bare `val` to `{ value, truncated? }`. `useInlineEdit.ts` `handleBlur` adds truncation detection. `TableSection.vue` renders alert-triangle icon + shadcn Tooltip. `useBidirectionalSync.ts` line 45 destructures `{ value }` to unwrap new return type. |
| FRONT-03 | Failed insert preserves ghost row state for retry | `TableSection.vue` `onGhostSubmit` (line 433-438) stops clearing `ghostRow`. Insert success detected via watch on `props.table.data.length` or injected `db.tables`. Failure detected via injected `error` ref from `SQL_CONTEXT_KEY`. Failure styling: `bg-destructive/5`, `border-dashed border-destructive/30`, hint text. |
| FRONT-04 | ER diagram nodes maintain dagre positions across tab switches | `DataVisualizer.vue` line 59: `v-else-if="activeTab === 'er'"` to `v-show="activeTab === 'er'"`. The `v-if`/`v-else-if` chain must be restructured (all other tabs change to independent `v-if`). `ErDiagram.vue` `onPaneReady` fires once on mount; positions persist in vue-flow internal state. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Emit type safety (FRONT-01) | Frontend composable | -- | Pure TypeScript generic constraint in `useInlineEdit.ts`; no rendering impact |
| Truncation detection (FRONT-02) | Frontend util | Frontend composable | `enforceTypeConstraints` is a pure function in `sqlStatements.ts`; detection logic in `useInlineEdit.handleBlur` |
| Truncation warning display (FRONT-02) | Frontend component | -- | `TableSection.vue` renders inline tooltip; uses existing `ui/tooltip` shadcn components |
| Ghost row persistence (FRONT-03) | Frontend component | Frontend composable | `TableSection.vue` owns `ghostRow` reactive state and insertion lifecycle; `useInlineEdit` provides ghost row helpers (`autoResizeGhost`, `handleBlur`) |
| ER diagram position (FRONT-04) | Frontend component | -- | `DataVisualizer.vue` tab switching controls component mount; vue-flow internal state persists positions when component stays mounted |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vue 3 | 3.5.34 | Reactive UI framework, `<script setup>` | Project tech stack locked [VERIFIED: package.json] |
| TypeScript | 6.0.3 | Type-safe JavaScript with `strict: true` | Project tech stack, enforced via `tsconfig.app.json` [VERIFIED: package.json] |
| Vitest | 4.1.6 | Unit test runner | Project test framework [VERIFIED: package.json] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-vue-next` | ^1.0.0 | Icon library for alert-triangle in truncation warning | FRONT-02 inline warning indicator [VERIFIED: package.json] |
| `reka-ui` (shadcn-vue) | ^2.9.7 | Headless UI primitives including Tooltip | FRONT-02 truncation tooltip via existing `ui/tooltip` components [VERIFIED: package.json + source] |
| `@vue-flow/core` | ^1.48.2 | Vue Flow graph rendering for ER diagram | FRONT-04: component stays mounted, positions persist internally [VERIFIED: package.json] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Generic emit constraint | Explicit emit type alias | Generic is simpler (no separate type def), same effect -- within Claude's discretion |
| shadcn Tooltip for truncation warning | Custom CSS tooltip | Tooltip is already available in the project, pre-styled, accessible; custom would duplicate effort |
| Deep watch `db.tables` for ghost row success | Watch `props.table.data.length` | Both work; shallow watch on prop is simpler and avoids injecting `db` into `TableSection` -- within Claude's discretion |
| `v-show` for ER + restructure chain | Keep chain + move ER to separate absolute-positioned layer | Restructuring chain is clearer and maintains natural DOM order |

**No new dependencies introduced.** All fixes use existing libraries.

## Package Legitimacy Audit

> No new packages to install. Phase uses existing dependencies only (Vue 3, reka-ui, lucide-vue-next, @vue-flow/core are all already installed and verified in Phase 0/1).

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DataVisualizer.vue                           │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Tab Bar: tables | er | indexes | views | triggers | results  │ │
│  └──────────┬─────────────────────────────────────────────────────┘ │
│             │ activeTab                                             │
│             ▼                                                       │
│  ┌────────────────────┐   ┌─────────────────────┐                   │
│  │ v-if="activeTab    │   │ v-show="activeTab   │                   │
│  │   === 'tables'"    │   │   === 'er'"         │                   │
│  │                    │   │                     │                   │
│  │  TableSection x N  │   │   ErDiagram         │ ◄── FRONT-04     │
│  │                    │   │   (always mounted)  │  (v-else-if→v-show│
│  │  ┌─────────────┐   │   │   vue-flow         │   + chain break)  │
│  │  │ Ghost row   │◄──┼───┤   dagre positions  │                   │
│  │  │ (FRONT-03)  │   │   │   persist          │                   │
│  │  └─────────────┘   │   └─────────────────────┘                   │
│  └──────────┬──────────┘                                           │
│             │ inject: db, error (SQL_CONTEXT_KEY)                    │
│             ▼                                                       │
│  ┌──────────────────────────────────────────────┐                  │
│  │ App.vue                                      │                  │
│  │  handleInsertRow → engine.insertRowUI        │                  │
│  │  handleUpdateCell → engine.updateRow         │                  │
│  └──────────┬───────────────────────────────────┘                  │
│             │                                                       │
│             ▼                                                       │
│  ┌──────────────────────────────────────────────┐                  │
│  │ useSqlEngine.ts                              │                  │
│  │  code watch → executeSqlRemote → db updated  │                  │
│  │  executionError set on failure               │                  │
│  └──────────────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Truncation Detection Pipeline (FRONT-02)                           │
│                                                                     │
│  TableSection cell textarea                                         │
│       │ @blur                                                       │
│       ▼                                                             │
│  useInlineEdit.handleBlur()                                         │
│       │ calls enforceTypeConstraints(val, rawType)                  │
│       │   └── sqlStatements.ts: now returns {value, truncated?}     │
│       │ if truncated detected:                                      │
│       │   propagate to TableSection (return value / callback)       │
│       ▼                                                             │
│  TableSection renders alert-triangle icon + Tooltip                 │
│  "值已截断：{originalLength} 字符 → {maxLength} 字符"              │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Ghost Row Lifecycle (FRONT-03)                                     │
│                                                                     │
│  User fills ghost row → click submit                                │
│       │ onGhostSubmit()                                             │
│       │   emit('insert-row', ...)  (fire-and-forget)                │
│       │   DO NOT clear ghostRow  ◄─── CHANGED                      │
│       │   set ghostSubmitPending = true                             │
│       ▼                                                             │
│  App.vue handleInsertRow → engine.insertRowUI                      │
│       │ modifies code.value (adds INSERT)                           │
│       │ triggers watch(code) → debouncedExecuteSql()                │
│       ▼                                                             │
│  ┌───────────────┐     ┌─────────────────────┐                     │
│  │ Success path  │     │  Error path          │                     │
│  │ db updated    │     │  executionError set  │                     │
│  │ props.table   │     │  mode→rollback       │                     │
│  │ data.length↑  │     │  code restored       │                     │
│  └───────┬───────┘     └──────────┬──────────┘                     │
│          ▼                        ▼                                 │
│  watch detects length↑    watch(error) detects non-null             │
│  → clear ghostRow         → ghostRow stays                          │
│    (Object.keys delete)      bg-destructive/5 tint                  │
│                              "插入失败，检查数据后重试"             │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
src/
├── composables/
│   └── useInlineEdit.ts        # FRONT-01: generic emit, FRONT-02: truncation detection
├── utils/
│   └── sqlStatements.ts        # FRONT-02: enforceTypeConstraints return type change
├── components/
│   ├── TableSection.vue        # FRONT-02: truncation warning UI, FRONT-03: ghost row persistence
│   ├── DataVisualizer.vue      # FRONT-04: v-else-if -> v-show for ER tab
│   └── er/
│       └── ErDiagram.vue       # FRONT-04: reference only (no changes needed)
```

### Pattern 1: Generic Emit Constraint (FRONT-01)
**What:** `useInlineEdit` accepts a generic `emit` parameter so TypeScript preserves the exact emit type from the caller instead of widening to `(string, ...any[]) => void`.
**When to use:** Any composable that receives an emit function from a Vue component and wants to retain type safety on the emit call signature.
**Example:**
```typescript
// Source: CONTEXT.md D-01 / current code at useInlineEdit.ts line 7
export function useInlineEdit<EmitFn extends (e: string, ...args: any[]) => void>(
  tableName: string,
  columnTypes: Record<string, string>,
  emit: EmitFn
) {
```
**Key details:** TypeScript infers `EmitFn` from the call site. `TableSection.vue` passes `emit` from `defineEmits`, which is already a properly typed Vue emit function. The constraint `extends (e: string, ...args: any[]) => void` ensures backward compatibility with any emit-like function.

### Pattern 2: Truncation-Aware Return Type (FRONT-02)
**What:** `enforceTypeConstraints` returns an object instead of a bare value, so callers can detect and propagate truncation metadata.
**When to use:** Any type-constraint function where the caller needs to know if the value was modified.
**Implementation:**
```typescript
// Source: CONTEXT.md D-03 / current code at sqlStatements.ts line 74-84
export const enforceTypeConstraints = (val: any, rawType: string): { value: any; truncated?: { originalLength: number; maxLength: number } } => {
  if (val === null || val === undefined) return { value: val }
  const strVal = String(val)
  const typeUpper = parsePrimaryType(rawType).toUpperCase()
  const charMatch = typeUpper.match(/(?:VARCHAR|CHAR)\s*\((\d+)\)/)
  if (charMatch) {
    const maxLength = parseInt(charMatch[1], 10)
    if (strVal.length > maxLength) {
      return {
        value: strVal.substring(0, maxLength),
        truncated: { originalLength: strVal.length, maxLength }
      }
    }
  }
  return { value: val }
}
```

### Pattern 3: Ghost Row with Pending State (FRONT-03)
**What:** `onGhostSubmit` emits the insert event but defers ghost row cleanup until success is confirmed.
**When to use:** Any async submission where user input should be preserved on failure.
**Flow:**
1. `onGhostSubmit` emits `insert-row`, sets `ghostPending = true`
2. Watch `error` from `SQL_CONTEXT_KEY`: on non-null, apply failure styling
3. Watch target table row count: on increase, clear ghostRow
4. User can edit ghost row values and retry on failure

### Anti-Patterns to Avoid
- **Clearing ghostRow after failed insert:** Current code at `TableSection.vue` line 436 clears `Object.keys(ghostRow).forEach(k => delete ghostRow[k])` immediately after emitting. This loses user input on failure. FRONT-03 defers this.
- **Using `v-else-if` for ER tab:** Causes `ErDiagram.vue` to be destroyed/recreated on tab switch, losing dagre positions. FRONT-04 uses `v-show` instead.
- **Any cast/assertion on emit parameter type:** FRONT-01 uses generic constraint instead of runtime checks or type assertions.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Inline tooltip for truncation warning | Custom CSS tooltip with own positioning/accessibility | Existing `components/ui/tooltip/` shadcn-vue components | Already configured with reka-ui primitives, CSS animations, arrow, portal support; matches design system |
| Truncation detection in cell edit | Custom character-count logic in template | `enforceTypeConstraints` in `sqlStatements.ts` | Already handles all VARCHAR/CHAR type variants, `parsePrimaryType` extraction; extending the return type is minimal change |
| ER diagram graph layout | Custom position persistence | vue-flow internal state | vue-flow already stores node positions in its internal state; keeping the component mounted (`v-show`) naturally preserves all positions without additional code |

**Key insight:** This phase has zero hand-roll risk. All 4 fixes use existing infrastructure (generic constraints, pure functions, reka-ui components, vue-flow internals). No new patterns are introduced.

## Runtime State Inventory

> Not applicable -- this is a pure frontend code change phase with no rename/refactor/migration.

## Common Pitfalls

### Pitfall 1: Breaking the `v-if`/`v-else-if` Chain (FRONT-04)
**What goes wrong:** Simply changing `v-else-if="activeTab === 'er'"` to `v-show="activeTab === 'er'"` in-place breaks the conditional chain. The remaining `v-else-if` divs no longer have a preceding `v-if`/`v-else-if` sibling, causing Vue compilation errors or unexpected rendering.
**Why it happens:** Vue 3 requires `v-else-if` to be immediately preceded by a `v-if` or `v-else-if` sibling. A `v-show` element in between breaks this adjacency requirement.
**How to avoid:** Restructure all tab divs to use independent `v-if` directives instead of a chain. Change `v-else-if` to `v-if` for indexes, views, triggers tabs, and change the final `v-else` to `v-if="activeTab === 'results'"`. Keep the ER tab as `v-show`.
**Warning signs:** Vue compiler error about `v-else-if` without matching `v-if`, or only the tables tab rendering while others collapse.

### Pitfall 2: `enforceTypeConstraints` Return Type Breaking `useBidirectionalSync` (FRONT-02)
**What goes wrong:** `enforceTypeConstraints` is called in `useBidirectionalSync.ts` line 45 as `val = enforceTypeConstraints(val, rawType)`. Changing the return type from bare `val` to `{ value: val }` breaks this assignment.
**Why it happens:** The function is called in a different composable (`useBidirectionalSync`) that doesn't need truncation info -- it only needs the truncated value.
**How to avoid:** All callers must be updated. `useBidirectionalSync.ts` needs `const { value: val } = enforceTypeConstraints(val, rawType)`. Every call site must be grepped and fixed.
**Call sites to update:**
- `useBidirectionalSync.ts` line 45: `val = enforceTypeConstraints(val, rawType)` -> `const result = enforceTypeConstraints(val, rawType); val = result.value`

### Pitfall 3: Ghost Row Success Detection Timing (FRONT-03)
**What goes wrong:** The watch on `props.table.data.length` fires BEFORE the ghost row submit completes, or fires multiple times, causing false success detection.
**Why it happens:** The data pipeline is async (debounced SQL execution, network round-trip). The watch fires on every `db.tables` update, including updates from other edits (not just ghost row submissions).
**How to avoid:** Use a `ghostPending` flag that is set in `onGhostSubmit` and cleared after success/failure detection. Always `return` early from the watcher if `ghostPending` is false.
**Warning signs:** Ghost row clears when the user edits another cell (false positive), or ghost row never clears (failure detection path missed).

### Pitfall 4: `executionError` from Non-Ghost Sources (FRONT-03)
**What goes wrong:** The ghost row watch detects an `executionError` that came from a different code edit (not a ghost row submit), and incorrectly applies failure styling.
**Why it happens:** Any SQL execution error sets the same `executionError` ref.
**How to avoid:** Again, the `ghostPending` flag is essential. Apply failure styling only when `ghostPending && error !== null`.

### Pitfall 5: Emit Generic Type Mismatch with Vue 3 `defineEmits` (FRONT-01)
**What goes wrong:** The generic constraint `EmitFn extends (e: string, ...args: any[]) => void` doesn't match Vue 3's emit function type from `defineEmits`, causing a TypeScript error.
**Why it happens:** Vue 3's `defineEmits` returns a function that may not have an exact `(e: string, ...args: any[]) => void` signature -- it may use a more specific functional overload type.
**How to avoid:** Test the generic constraint with the actual Vue 3 emit type. The string-based `defineEmits(['update-cell', ...])` returns a compatible type. If issues arise, adjust the constraint to use `(...args: any[]) => any` or use a mapped type.
**Verification:** Run `vue-tsc -b` after the change to confirm no type errors.

## Code Examples

### FRONT-01: Generic Emit in `useInlineEdit.ts`
```typescript
// Source: CONTEXT.md D-01 / current useInlineEdit.ts line 4-8
export function useInlineEdit<EmitFn extends (e: string, ...args: any[]) => void>(
  tableName: string,
  columnTypes: Record<string, string>,
  emit: EmitFn
) {
  // ... existing function body unchanged ...
  // Calling emit('update-cell', ...) now preserves type checking
  // at sites where emit has a typed signature
}
```

### FRONT-02: `enforceTypeConstraints` Return Type Change
```typescript
// Source: CONTEXT.md D-03 / sqlStatements.ts line 74-84
export const enforceTypeConstraints = (
  val: any,
  rawType: string
): { value: any; truncated?: { originalLength: number; maxLength: number } } => {
  if (val === null || val === undefined) return { value: val }
  const strVal = String(val)
  const typeUpper = parsePrimaryType(rawType).toUpperCase()
  const charMatch = typeUpper.match(/(?:VARCHAR|CHAR)\s*\((\d+)\)/)
  if (charMatch) {
    const maxLength = parseInt(charMatch[1], 10)
    if (strVal.length > maxLength) {
      return {
        value: strVal.substring(0, maxLength),
        truncated: { originalLength: strVal.length, maxLength }
      }
    }
  }
  return { value: val }
}
```

### FRONT-02: `handleBlur` Truncation Detection
```typescript
// Source: CONTEXT.md D-05 / useInlineEdit.ts handleBlur (line 15-34)
// --- NEW ---
// Add a callback parameter or return value for truncation propagation
export function useInlineEdit<EmitFn extends (e: string, ...args: any[]) => void>(
  tableName: string,
  columnTypes: Record<string, string>,
  emit: EmitFn,
  onTruncation?: (col: string, originalLength: number, maxLength: number) => void  // NEW
) {
  function handleBlur(e: FocusEvent, row: Row, col: string) {
    const target = e.target as HTMLTextAreaElement
    const newVal = target.value
    const oldVal = row[col]

    if (String(newVal) === String(oldVal)) return

    const typeInfo = columnTypes[col] || ''
    const typeUpper = typeInfo.toUpperCase()

    if (isNumericType(typeUpper) && newVal !== '') {
      if (Number.isNaN(Number(newVal))) return
    }

    if (typeUpper.includes('NOT NULL')) {
      if (newVal === '' || newVal.trim() === '') return
    }

    // --- NEW: truncation detection ---
    const { value: constrainedVal, truncated } = enforceTypeConstraints(newVal, typeInfo)
    if (truncated) {
      onTruncation?.(col, truncated.originalLength, truncated.maxLength)
    }

    emit('update-cell', { tableName, oldRow: row, newRow: { ...row, [col]: constrainedVal } })
  }
}
```

### FRONT-02: Truncation Tooltip in `TableSection.vue` Template
```html
<!-- Source: UI-SPEC.md Copywriting Contract / existing shadcn Tooltip component -->
<!-- Inside the cell <td>, next to the textarea grid: -->
<td v-for="col in table.columns" :key="col" class="px-4 py-2 border-r relative align-top">
  <div class="grid place-items-start w-full relative">
    <!-- Existing ghost/pre element and textarea ... -->
    <Tooltip v-if="truncatedCells[getRowKey(row) + '-' + col]">
      <TooltipTrigger as-child>
        <span class="absolute top-0 right-0 z-20 cursor-help">
          <AlertTriangle class="h-3 w-3 text-destructive" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>值已截断：{{ truncatedCells[getRowKey(row) + '-' + col].originalLength }} 字符 → {{ truncatedCells[getRowKey(row) + '-' + col].maxLength }} 字符</p>
      </TooltipContent>
    </Tooltip>
  </div>
</td>
```

### FRONT-03: Ghost Row with Pending State
```typescript
// Source: CONTEXT.md D-06, D-07, D-08 / TableSection.vue lines 433-438
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

// --- Current ---
const { highlight } = inject(SQL_CONTEXT_KEY)!
// --- NEW --- also inject error
const { highlight, error } = inject(SQL_CONTEXT_KEY)!

const ghostRow = reactive<Row>({})
const ghostPending = ref(false)  // NEW
let previousRowCount = props.table.data.length  // NEW

const onGhostSubmit = () => {
  if (hasGhostInput()) {
    emit('insert-row', { tableName: props.table.name, newRow: { ...ghostRow } })
    // REMOVED: Object.keys(ghostRow).forEach((k) => delete ghostRow[k])
    ghostPending.value = true  // NEW: mark pending
    // NEW: capture current row count for success detection
    previousRowCount = props.table.data.length
  }
}

// --- NEW: success detection via row count watch ---
watch(
  () => props.table.data.length,
  (newLen) => {
    if (ghostPending.value && newLen > previousRowCount) {
      // Insert succeeded -- clear ghost row
      Object.keys(ghostRow).forEach((k) => delete ghostRow[k])
      ghostPending.value = false
    }
  }
)

// --- NEW: failure detection via error watch ---
watch(error, (err) => {
  if (ghostPending.value && err !== null) {
    // Insert failed -- ghost row stays, apply failure styling
    ghostPending.value = false
    // Styling applied reactively via computed based on ghostFailed
  }
})
```

### FRONT-03: Ghost Row Failure Styling
```html
<!-- Source: UI-SPEC.md Ghost Row Insertion Failure -->
<tr data-testid="ghost-row"
    class="bg-muted/50 border-t border-dashed border-border group/ghost"
    :class="{
      'opacity-0 hover:opacity-100 focus-within:opacity-100': !ghostFailed,
      'opacity-100 bg-destructive/5 border-destructive/30': ghostFailed
    }">
  <!-- ... existing cell content ... -->
</tr>
<!-- NEW: error hint text -->
<tr v-if="ghostFailed" class="border-0">
  <td :colspan="table.columns.length + 1" class="px-4 py-1 text-xs text-destructive">
    插入失败，检查数据后重试
  </td>
</tr>
```

### FRONT-04: ER Tab `v-show` Change
```html
<!-- Source: CONTEXT.md D-09 / DataVisualizer.vue lines 29-66 -->
<!-- BEFORE (v-if chain) -->
<div v-if="activeTab === 'tables'" class="flex flex-col">
  <!-- TableSection instances -->
</div>
<div v-else-if="activeTab === 'er'" class="flex-1 min-h-0">
  <ErDiagram ... />
</div>
<div v-else-if="activeTab === 'indexes'">
  <!-- indexes content -->
</div>
<div v-else-if="activeTab === 'views'">
  <!-- views content -->
</div>
<div v-else-if="activeTab === 'triggers'">
  <!-- triggers content -->
</div>
<div v-else>
  <!-- query results -->
</div>

<!-- AFTER (independent v-if, ER uses v-show) -->
<div v-if="activeTab === 'tables'" class="flex flex-col">
  <!-- TableSection instances -->
</div>
<div v-show="activeTab === 'er'" class="flex-1 min-h-0">
  <ErDiagram ... />
</div>
<div v-if="activeTab === 'indexes'">
  <!-- indexes content -->
</div>
<div v-if="activeTab === 'views'">
  <!-- views content -->
</div>
<div v-if="activeTab === 'triggers'">
  <!-- triggers content -->
</div>
<div v-if="activeTab === 'results'">
  <!-- query results -->
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `enforceTypeConstraints` returns bare `val` | Returns `{ value, truncated? }` object | FRONT-02 | Callers can detect truncation; `useBidirectionalSync` must destructure `{ value }` |
| `onGhostSubmit` clears ghostRow immediately | Defers cleanup until success confirmed | FRONT-03 | Failed inserts preserve user input; requires watch for success detection |
| ER tab uses `v-else-if` (destroyed on tab switch) | Uses `v-show` (always mounted) | FRONT-04 | vue-flow positions persist; component lifecycle hooks run once |

**Deprecated/outdated:**
- None. All fixes are additive / behavioral changes, not deprecations.

## Assumptions Log

> All claims in this research were verified against the codebase or documented decisions. No unverified assumptions were made.

**This table is empty:** All claims in this research were verified by reading source files or documented in CONTEXT.md -- no user confirmation needed.

## Open Questions

1. **Breakage of `v-if`/`v-else-if` chain in DataVisualizer.vue (FRONT-04)**
   - What we know: Simply replacing `v-else-if` with `v-show` for the ER tab breaks the conditional chain. The remaining `v-else-if` tabs need to be converted to independent `v-if` directives.
   - What's unclear: Whether Vue 3 throws a compilation error or silently misbehaves when encountering out-of-chain `v-else-if`.
   - Recommendation: Convert all tab divs to independent `v-if` (change `v-else-if` to `v-if` for indexes, views, triggers; change final `v-else` to `v-if="activeTab === 'results'"`). This is the safest approach and is within Claude's Discretion.

2. **Ghost row success detection: deep watch vs prop watch (FRONT-03)**
   - What we know: Two approaches work -- (a) inject `db` from `SQL_CONTEXT_KEY` and deep-watch `db.tables`, or (b) watch `props.table.data.length` with a local snapshot comparison.
   - What's unclear: Which approach is more robust against edge cases (e.g., multiple tables, rapid edits).
   - Recommendation: Use `props.table.data.length` watch with `ghostPending` flag. It's simpler (no new injection), and the prop is already reactive through Vue's `v-for` keying. Within Claude's Discretion.

3. **Truncation propagation from `useInlineEdit` to `TableSection` (FRONT-02)**
   - What we know: Two approaches work -- (a) a new callback parameter `onTruncation`, or (b) a new returned ref that tracks truncation state.
   - What's unclear: Which is cleaner given `useInlineEdit` is used per-table-section instance.
   - Recommendation: Use callback parameter `onTruncation?: (col: string, originalLength: number, maxLength: number) => void`. It's explicit, doesn't add state management complexity, and is within Claude's Discretion.

## Environment Availability

> Skip this section -- the phase requires no external tools beyond the existing Node.js/TypeScript toolchain already used in the project. All changes are pure TypeScript/Vue code modifications.

## Validation Architecture

> Skipped: `workflow.nyquist_validation` is explicitly set to `false` in `.planning/config.json`.

## Security Domain

> This phase touches no network, no file system, no authentication, no user input validation beyond existing frontend logic. The 4 fixes are pure UI/type reliability improvements. No ASVS categories apply.

| Question | Answer |
|----------|--------|
| Does this phase handle user input? | Yes (cell edits, ghost row values) but all input is sent to the existing backend pipeline -- no new input paths |
| Does this phase introduce new API calls? | No |
| Does this phase modify security controls? | No |
| Does this phase handle PII or secrets? | No |
| Are there XSS concerns? | No -- textareas use `:value` binding (Vue handles escaping) and tooltips use shadcn template rendering |

No security-specific implementation guidance needed for this phase.

## Sources

### Primary (HIGH confidence)
- [Codebase] `sqlive-frontend/src/composables/useInlineEdit.ts` -- emit signature, handleBlur implementation
- [Codebase] `sqlive-frontend/src/utils/sqlStatements.ts` -- `enforceTypeConstraints` return type, callers
- [Codebase] `sqlive-frontend/src/components/TableSection.vue` -- ghost row lifecycle, template structure, injection usage
- [Codebase] `sqlive-frontend/src/components/DataVisualizer.vue` -- tab conditional chain, ER tab rendering
- [Codebase] `sqlive-frontend/src/components/er/ErDiagram.vue` -- `onPaneReady`, component lifecycle
- [Codebase] `sqlive-frontend/src/composables/useBidirectionalSync.ts` -- `enforceTypeConstraints` call site line 45
- [Codebase] `sqlive-frontend/src/composables/useErDiagram.ts` -- `rebuild()`, `autoLayout()`, component lifecycle
- [Codebase] `sqlive-frontend/src/composables/useDagreLayout.ts` -- dagre layout implementation
- [Codebase] `sqlive-frontend/src/model/DatabaseTypes.ts` -- type definitions (Row, TableSchema, CellUpdateEvent, etc.)
- [Codebase] `sqlive-frontend/src/model/injectionKeys.ts` -- `SqlContext` interface with `error` field
- [Codebase] `sqlive-frontend/src/components/ui/tooltip/` -- existing shadcn-vue Tooltip components
- [Codebase] `sqlive-frontend/src/App.vue` -- event handler chain for insert-row, update-cell
- [Codebase] `.planning/phases/03-frontend-reliability/03-CONTEXT.md` -- all 10 decisions (D-01 through D-10)
- [Codebase] `.planning/phases/03-frontend-reliability/03-UI-SPEC.md` -- visual and interaction contracts
- [Codebase] `.planning/REQUIREMENTS.md` -- FRONT-01 through FRONT-04 requirements
- [Codebase] `.planning/ROADMAP.md` -- Phase 3 success criteria
- [Codebase] `.planning/PROJECT.md` -- constraints (no new deps, minimal change)
- [Codebase] `.planning/config.json` -- `nyquist_validation: false`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries confirmed via package.json and source code
- Architecture: HIGH -- all 4 fix strategies documented in CONTEXT.md decisions; source files read and verified
- Pitfalls: HIGH -- identified from code reading and Vue 3 behavior knowledge

**Research date:** 2026-05-30
**Valid until:** 2026-07-01 (entirely within stable Vue 3 + TypeScript ecosystem)
