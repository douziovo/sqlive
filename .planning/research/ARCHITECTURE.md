# Architecture Research

**Domain:** Full-stack SQL playground tech debt cleanup
**Researched:** 2026-05-29
**Confidence:** HIGH

## System Overview

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Vue 3 + Vite 8.x)                                  │
│                                                                                           │
│  ┌──────────────────────┐  ┌──────────────────────────┐  ┌─────────────────────────┐     │
│  │  CodeEditor.vue      │  │  DataVisualizer.vue       │  │  AiChatPanel.vue       │     │
│  │  (Monaco, tabs)      │  │  ├─ TableSection.vue      │  │  KnowledgePanel.vue    │     │
│  │                      │  │  ├─ ErDiagram.vue         │  │                         │     │
│  │                      │  │  ├─ ResultTable.vue       │  │                         │     │
│  │                      │  │  └─ ChartView.vue         │  │                         │     │
│  └──────────┬───────────┘  └────────────┬─────────────┘  └───────────┬─────────────┘     │
│             │                           │                            │                   │
│             └─────────────┬─────────────┘                            │                   │
│                           │                                          │                   │
│                  ┌────────▼─────────────────┐              ┌─────────▼─────────┐        │
│                  │  useSqlEngine             │              │  useAiChat        │        │
│                  │  useBidirectionalSync     │              │  useAiStreaming   │        │
│                  │  useMultiTabs            │              │  useInlineActions │        │
│                  │  useHighlight            │              └───────────────────┘        │
│                  │  useErDiagram            │                                           │
│                  │  useInlineEdit           │                                           │
│                  │  useDagreLayout          │                                           │
│                  └────────┬─────────────────┘                                           │
│                           │                                                             │
└───────────────────────────┼─────────────────────────────────────────────────────────────┘
                            │
              POST /api/execute  │  POST /api/ai/*
              (JSON body)        │  (SSE response)
                            │
┌───────────────────────────┼─────────────────────────────────────────────────────────────┐
│                           ▼                                                             │
│  BACKEND (Spring Boot 4.0.6 + JDK 21)                                                    │
│                                                                                          │
│  ┌──────────────────┐  ┌──────────────────────┐  ┌──────────────────────────┐           │
│  │  SqlController   │  │  AiController        │  │  KnowledgeController    │           │
│  │  HealthController│  └──────────┬───────────┘  └──────────────────────────┘           │
│  └────────┬─────────┘             │                                                      │
│           │                       │                                                      │
│           ▼                       ▼                                                      │
│  ┌──────────────────┐  ┌──────────────────────┐                                         │
│  │  SqlExecution    │  │  AiService           │                                         │
│  │  Service         │  │  (provider chain)    │                                         │
│  │                   │  │                      │                                         │
│  │  [PARSER BOUNDARY]│  │  AiProvider (iface)  │                                         │
│  │  ┌───────────┐   │  │  ├─ DeepSeekProtocol │                                         │
│  │  │ SqlParser │   │  │  ├─ OllamaProtocol   │                                         │
│  │  └───────────┘   │  │  ├─ LmStudioProtocol │                                         │
│  │  ┌───────────┐   │  │  └─ OpenAiProtocol   │                                         │
│  │  │DatabasePool│   │  └──────────────────────┘                                         │
│  │  │Manager    │   │                                                                   │
│  │  └───────────┘   │                                                                   │
│  │  ┌───────────┐   │                                                                   │
│  │  │Metadata   │   │                                                                   │
│  │  │Extractor  │   │                                                                   │
│  │  └───────────┘   │                                                                   │
│  └──────────────────┘                                                                   │
│                                                                                          │
│  ┌──────────────────────────────────────────────────────────────┐                       │
│  │  Cross-Cutting: RateLimitFilter, WebConfig, GlobalException  │                       │
│  └──────────────────────────────────────────────────────────────┘                       │
│                                                                                          │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

## Fix Categorization by Layer

The 15 fixes fall into three distinct layers with different interaction patterns:

| Layer | Fixes | Touches | Sharing | 
|-------|-------|---------|---------|
| **Backend Infrastructure** | EVICT-01, RATE-01, WARN-01, AI-01, AI-02, SEC-02 | Independent service/config files | No shared state |
| **Backend Data & Security** | SQL-01, FK-01, VALID-01, SEC-01 | SqlExecutionService, SqlParser, DTOs | Shared SqlExecutionService |
| **Frontend** | TYPE-01, EDIT-01, GHOST-01, ER-01 | Composables + components | Shared sqlStatements.ts |

## Data Flow: Current vs Proposed for Each Fix

### Fix SQL-01: Expose Backend Parser Positions

**Current flow (broken):**

```
Frontend extractSqlStatements() ──?──→ Backend SqlParser.parseStatementsPrecise()
         │                                              │
         │ (different parser, misses                    │ (canonical parser)
         │  BEGIN/END/CASE depth)                       │
         ▼                                              ▼
    Statement positions                            Statement positions
    (may be wrong)                                (correct)
                                                         
    useBidirectionalSync uses frontend positions ──→ tuple replacement on wrong statement
```

**Proposed flow:**

```
POST /api/execute response body:

{
  "success": true,
  "data": {
    "tables": [...],
    "statementBoundaries": [          ← NEW FIELD
      { "sql": "...", "startLine": 1, "charStart": 0, "charEnd": 45 },
      { "sql": "...", "startLine": 3, "charStart": 46, "charEnd": 120 }
    ],
    ...
  }
}
```

**What changes:**

| Layer | Change | Complexity |
|-------|--------|------------|
| `SqlParser` | Track `charStart` index in addition to `startLine` in `SqlStatement` record | Low (1 field) |
| `SqlResponse.DataPayload` | Add `List<StatementBoundary> statementBoundaries` | Low (1 DTO) |
| `SqlExecutionService.execute()` | Pass original script and parsed statements to response builder | Low |
| Frontend `sqlStatements.ts` | Remove `extractSqlStatements()` or deprecate | Low |
| `useBidirectionalSync` | Accept backend boundaries when available, fall back to frontend | Medium |

**Design decision: New field in execute response (NOT separate endpoint).** Rationale: the backend already computes parsed statements during `execute()`. Including them in the same response adds zero network overhead. A separate endpoint would require an extra round-trip for no benefit. The `charStart`/`charEnd` are 0-based character offsets into the original script, matching the frontend's current `stmt.start`/`stmt.end` contract.

**Backward compatibility:** The frontend should prefer backend boundaries when `statementBoundaries` is present, falling back to `extractSqlStatements()` for cached responses or test environments.

### Fix FK-01: clearDatabase() FK Race

**Current flow (racy):**

```
Thread A: clearDatabase()
  → PRAGMA foreign_keys = OFF     ← FK check disabled globally on this connection
  → DROP TABLE t1, t2, t3
  → PRAGMA foreign_keys = ON

Thread B (concurrent on same JdbcTemplate):
  → INSERT INTO t1 (refs t2)
  → (FK check OFF → invalid ref allowed!)
```

**Reality check:** `JdbcTemplate` uses HikariCP with `maximumPoolSize=1`. Thread B would **block** waiting for the connection until Thread A releases it. So the race is between the `jdbc.execute()` call wrapping the entire clearDatabase block and any concurrent `jdbc.execute()` call for SQL execution. But `SqlExecutionService.execute()` also uses `jdbc.execute()` on the same JdbcTemplate. With a pool of 1, these are serialized — no actual race.

The real concern is **not** concurrency on the same JdbcTemplate (which is impossible with max 1 connection), but correctness: `PRAGMA foreign_keys` is connection-scoped, and if the connection is returned to the pool, the next usage inherits `foreign_keys = OFF`.

Wait — looking at the code again: `PRAGMA foreign_keys = ON` is executed at the end of `clearDatabase()`, before the connection is returned. So the connection's state is restored. The JdbcTemplate wraps the entire lambda in a single connection acquire/release cycle.

**However**, there IS a genuine issue: the `PRAGMA foreign_keys` change is visible to the current connection immediately. If `clearDatabase()` is called while statements inside it fail (exception thrown before `PRAGMA foreign_keys = ON`), the connection state is corrupted. The exception path doesn't restore FK state.

**Proposed flow:**

```
clearDatabase()
  → Query sqlite_master + PRAGMA foreign_key_list for each table
  → Build dependency graph (table → list of tables it references)
  → Topological sort: DROP views first, triggers second, leaf tables third
  → Drop in dependency order (no DROP CASCADE needed)
  → No PRAGMA foreign_keys toggle at all

OR simpler fallback:
  → DROP views and triggers first
  → DROP TABLE t1, t2, ... (in FK-dependency order from PRAGMA foreign_key_list)
  → No PRAGMA toggle needed
```

**No topological sort library needed** — a simple DFS on the dependency graph works. Tables with no incoming FK refs are leaf nodes and can be dropped first.

### Fix EVICT-01: LRU Pool Eviction

**Current:** `ConcurrentHashMap<String, JdbcTemplate>` with `evictionLock` on create path only. Random eviction via `it.next()`.

**Proposed:** Replace with `LinkedHashMap` (access-order=true) behind the existing `ReentrantLock`. Extend the lock to cover ALL map operations (not just create/evict).

```
getOrCreateJdbcTemplate(dbName):
  evictionLock.lock()
  try {
    existing = jdbcTemplates.get(dbName)       ← LinkedHashMap access-order updates on get
    if (existing != null) return existing
    
    if (jdbcTemplates.size() >= MAX_DATABASES) {
      oldest = jdbcTemplates.entrySet().iterator().next()  ← LRU entry (access-order = oldest)
      evict(oldest)
    }
    return createAndPutJdbcTemplate(dbName)    ← LinkedHashMap put at end
  } finally {
    evictionLock.unlock()
  }
```

**Why LinkedHashMap (access-order) over alternatives:**

| Approach | Thread-safe | LRU Correct | No New Dep | Complexity |
|----------|------------|-------------|------------|------------|
| ConcurrentHashMap + timestamp map | Yes (per-entry) | Approximate | Yes | Medium (2 maps to sync) |
| LinkedHashMap (access-order) + ReentrantLock | Yes (lock serializes) | Exact | Yes | Low (drop-in replacement) |
| Caffeine cache | Yes | Exact | No (new dep) | Low |
| Guava Cache | Yes | Exact | No (new dep) | Low |

LinkedHashMap wins because: (a) no new dependencies, (b) exact LRU semantics (not approximate), (c) the `evictionLock` already exists, (d) `maximumPoolSize=1` per JdbcTemplate means lock contention is negligible — serializing `get()` adds no real bottleneck.

The existing `ConcurrentHashMap` can remain as the internal implementation if we want lock-free reads. We just need to move the `get()` inside the lock or add access-timestamp tracking.

### Fix ER-01: ER Diagram Node Positions Reset

**Root cause:** `useErDiagram` is instantiated inside `ErDiagram.vue`'s `<script setup>`. When the tab panel destroys and recreates the component (via v-if), the composable is re-created, `rebuild()` creates fresh nodes at `{x:0,y:0}`, and the watcher on `[tablesSource, foreignKeysSource]` doesn't fire because the props haven't changed.

**Proposed: Persist positions outside component lifecycle.**

```
// Module-level cache (survives component destroy/recreate)
const persistedLayouts = new Map<string, { nodeId: string; position: {x:number,y:number} }[]>()

// In useErDiagram, keyed by table set signature
function getLayoutKey(tables: TableSchema[]): string {
  return tables.map(t => t.name).sort().join(',')
}

function rebuild() {
  const tables = tablesSource()
  const fks = foreignKeysSource()
  nodes.value = tablesToNodes(tables, fks)
  edges.value = foreignKeysToEdges(fks, tables)
  
  // Restore persisted positions
  const key = getLayoutKey(tables)
  const persisted = persistedLayouts.get(key)
  if (persisted) {
    nodes.value = nodes.value.map(n => {
      const p = persisted.find(pp => pp.nodeId === n.id)
      return p ? { ...n, position: p.position } : n
    })
  }
}
```

**Why NOT KeepAlive:** `<KeepAlive>` keeps the component instance alive (avoids destroy/recreate), which preserves VueFlow internal state. However, it also keeps all DOM, event listeners, and watchers active — consuming memory even when the tab is hidden. For a single ER diagram, this is negligible, but if the pattern spreads, it could add up. The persisted-layout approach is more explicit and doesn't depend on the tab-switching mechanism.

**Why NOT re-run dagre on every tab switch:** dagre layout is O(n*m) for the graph and runs DOM queries (`querySelectorAll('[data-id]')`) for node dimensions. Re-running it on every tab switch causes a visible layout animation/reflow that is unnecessary when the data hasn't changed.

### Fix TYPE-01: Generic Emit in useInlineEdit

**Current signature:** `emit: (e: string, ...args: any[]) => void`

**Proposed:** Accept a typed emit interface:

```typescript
// Option A: Generic composable
export function useInlineEdit<T extends Record<string, unknown>>(
  tableName: string,
  columnTypes: Record<string, string>,
  emit: (event: 'update-cell', payload: UpdateCellPayload<T>) => void
)

// Option B: Accept separate callback
export function useInlineEdit(
  tableName: string,
  columnTypes: Record<string, string>,
  onUpdateCell: (payload: { tableName: string; oldRow: Row; newRow: Row }) => void
)
```

**Option B** is simpler and avoids Vue emit generic complexity. The caller passes a typed callback instead of the raw `emit`.

### Fix EDIT-01: Truncation Warning Signal

**Current `enforceTypeConstraints`:** Returns `val` (possibly truncated) with no signal.

**Proposed:** Change return type to signal truncation:

```typescript
export function enforceTypeConstraints(val: any, rawType: string): { value: any; truncated: boolean }
```

**Caller impact:** `generateValuesTuple()` in `useBidirectionalSync` calls `enforceTypeConstraints`. If `truncated` is true, the composable needs to surface a warning. This requires a new return value (e.g., `truncationWarning` ref) from `useBidirectionalSync` that the component can display.

### Fix GHOST-01: Ghost Row State on Failed Insert

**Current flow:** Ghost submit → POST /api/execute → clear ghost input → backend may fail.

**Proposed flow:** Ghost submit → POST /api/execute → wait for response → if success: clear ghost; if failure: preserve ghost input.

**Implementation:** Store ghost input state (the unsaved row data) in a ref that only resets on successful execution confirmation. The `useSqlEngine` already has `executionError` state — the ghost row component should watch this and conditionally preserve input.

## Fix Dependencies and Build Order

```
Layer 1: Backend Infrastructure (can parallelize)
├── EVICT-01 (LRU eviction)          ─── DatabasePoolManager
├── RATE-01 (rate limit cleanup)     ─── RateLimitFilter
├── WARN-01 (suppress-warnings)      ─── SqlExecutionService
├── AI-01 (WebClient timeouts)       ─── OpenAiCompatibleProvider
├── AI-02 (volatile providers)       ─── AiService
└── SEC-02 (log sanitization)       ─── OpenAiCompatibleProvider

Layer 2: SQL Parser/Data Security (sequential)
├── VALID-01 (dbName validation)     ─── SqlRequest + DatabasePoolManager
│       ↑ no dep
├── SQL-01 (parser positions)        ─── SqlParser + SqlResponse + frontend sqlStatements.ts
│       ↑ depends on: SqlParser (no structural dep, just code ordering)
└── FK-01 (FK race)                 ─── SqlExecutionService
        ↑ depends on: understanding of parser (no code dep)

Layer 3: Frontend (can parallelize after SQL-01)
├── TYPE-01 (generic emit)           ─── useInlineEdit.ts
├── EDIT-01 (truncation warning)    ─── sqlStatements.ts → useBidirectionalSync → TableSection.vue
├── GHOST-01 (ghost state)          ─── TableSection.vue
└── ER-01 (diagram layout)          ─── ErDiagram.vue + useErDiagram.ts

Layer 4: Security (after backend infra)
└── SEC-01 (ATTACH disable)         ─── SqlExecutionService
```

### Interaction Risks

| Fix Pair | Risk | Mitigation |
|----------|------|------------|
| SQL-01 + EDIT-01 | Both modify `sqlStatements.ts`. EDIT-01 changes `enforceTypeConstraints` return type; SQL-01 deprecates/removes `extractSqlStatements`. | Do SQL-01 first (removes parser), then EDIT-01 (changes type enforcement). EDIT-01 also needs updates in `useBidirectionalSync.generateValuesTuple()`. |
| FK-01 + SEC-01 | Both modify `SqlExecutionService`. FK-01 rewrites `clearDatabase()`; SEC-01 adds PRAGMA restrictions or authorizer. | Apply both to same file sequentially. SEC-01 may add checks in `execute()` that FK-01 should be aware of. |
| VALID-01 + EVICT-01 | VALID-01 aligns regex in `SqlRequest` and `DatabasePoolManager`. EVICT-01 restructures map internals. | Low risk — they touch different parts of `DatabasePoolManager` (validation vs eviction logic). |
| EVICT-01 + RATE-01 | Both involve concurrent map cleanup. EVICT-01 uses LinkedHashMap+lock; RATE-01 uses ConcurrentHashMap+scheduled task. | No conflict — different classes, different patterns. |

### Phase Ordering Recommendation

**Phase 1: Backend Infrastructure (6 fixes, safe independent)**
EVICT-01, RATE-01, WARN-01, AI-01, AI-02, SEC-02

Rationale: Zero frontend changes. No structural refactoring. Each fix touches exactly one file. Build confidence in the cleanup process before tackling cross-layer changes.

**Phase 2: Parser Unification & Validation (3 fixes, sequential)**
VALID-01 -> SQL-01 -> FK-01

Rationale: Parser positions flow is the most architecturally significant change (adds new API field, modifies DTO, changes frontend parsing). VALID-01 is trivially small. FK-01 depends on understanding the parser but not on code from SQL-01. However, doing SQL-01 first means FK-01's `clearDatabase()` changes are applied on already-clean code.

**Phase 3: Frontend (4 fixes, parallelizable)**
TYPE-01, EDIT-01, GHOST-01, ER-01

Rationale: After SQL-01 provides canonical parser positions, EDIT-01's changes to `sqlStatements.ts` work on a streamlined file. TYPE-01 and GHOST-01 are independent. ER-01 touches completely separate files.

**Phase 4: Security (1 fix)**
SEC-01

Rationale: Disabling ATTACH DATABASE changes `SqlExecutionService`. Doing it last minimizes conflict risk. The risk is low so this could also go in Phase 2, but post-frontend is safer.

## Component Boundaries

| Component | Fixes Applied | Public API Preserved? | Internal Change |
|-----------|--------------|----------------------|-----------------|
| `SqlExecutionService` | FK-01, WARN-01, SEC-01 | Yes (method signatures unchanged) | clearDatabase() rewritten; suppress-warnings scoped; ATTACH blocked |
| `SqlParser` | SQL-01 | Extended (new field on SqlStatement) | charStart added to SqlStatement record |
| `SqlResponse` (DTO) | SQL-01 | Extended (new optional field) | statementBoundaries added to DataPayload |
| `DatabasePoolManager` | EVICT-01, VALID-01 | Yes (methods unchanged) | Map impl changed; validation regex aligned |
| `RateLimitFilter` | RATE-01 | Yes | Background cleanup thread added |
| `OpenAiCompatibleProvider` | AI-01, SEC-02 | Yes | WebClient config changed; log sanitization |
| `AiService` | AI-02 | Yes | volatile removed or refreshProviders() added |
| `sqlStatements.ts` | SQL-01, EDIT-01 | Deprecated (extractSqlStatements) | extractSqlStatements deprecated; enforceTypeConstraints return type changed |
| `useBidirectionalSync.ts` | SQL-01, EDIT-01 | Extended | Accepts canonical boundaries; surfaces truncation warnings |
| `useInlineEdit.ts` | TYPE-01 | Changed (emit signature) | Generic emit type |
| `ErDiagram.vue` / `useErDiagram.ts` | ER-01 | Yes | Module-level position persistence |
| `TableSection.vue` | GHOST-01 | Yes | Ghost input preserved on failure |

## Data Flows Changed

### Parser Position Flow (SQL-01)

```
Before:
  Backend: parser → execute → metadata → response (no boundaries sent)
  Frontend: code → extractSqlStatements() → findTupleInBatch() → replace
  Gap: frontend parser may misidentify statements

After:
  Backend: parser → execute → metadata + statementBoundaries → response
  Frontend: code → useBackendBoundaries() if available → findTupleInBatch() → replace
  (fallback: use extractSqlStatements() if no backend boundaries)
```

### Database Eviction Flow (EVICT-01)

```
Before:
  createJdbcTemplate → map full → it.next() → evict random entry
  
After:
  createJdbcTemplate → map full → LinkedHashMap.entrySet().iterator().next()
                         → evict least-recently-accessed entry
```

### Position Persistence Flow (ER-01)

```
Before:
  ErDiagram.vue mounted → useErDiagram() fresh → rebuild() → nodes at {0,0}
  onPaneReady → autoLayout() → correct positions
  Tab switch → component destroyed → positions lost
  Tab re-open → {0,0} again

After:
  ErDiagram.vue mounted → useErDiagram() fresh → rebuild() 
                           → check persistedLayouts[tableKey]
                           → restore positions if cached
                           → else run autoLayout() on onPaneReady
  Tab switch → component destroyed → positions saved in module-level map
  Tab re-open → positions restored from cache
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Inline Edit uses Frontend Parser for Statement Boundaries

**What's wrong:** `useBidirectionalSync` relies on `extractSqlStatements()` which is an inferior reimplementation of the backend's `SqlParser.parseStatementsPrecise()`. Two parsers will inevitably diverge.

**Fix with SQL-01:** The backend should be the single source of truth for statement boundaries. The frontend should consume backend-provided boundaries via the API response.

### Anti-Pattern 2: PRAGMA foreign_keys Toggle for Schema Reset

**What's wrong:** `clearDatabase()` toggles `PRAGMA foreign_keys` instead of dropping tables in FK dependency order. This corrupts connection state if an exception occurs mid-execution.

**Fix with FK-01:** Drop tables in topological order determined by `PRAGMA foreign_key_list` queries. No PRAGMA toggle needed.

### Anti-Pattern 3: Component-Destroyed Positions Lost

**What's wrong:** Node positions for vue-flow graphs are computed inside component lifecycle and lost on destroy/recreate. The composable doesn't persist computed positions.

**Fix with ER-01:** Store dagre-computed positions in module-level state keyed by schema signature. Restore on component mount.

### Anti-Pattern 4: Silent Data Truncation

**What's wrong:** `enforceTypeConstraints` truncates VARCHAR values silently. The user doesn't know their input was shortened.

**Fix with EDIT-01:** Return a `truncated: boolean` flag alongside the value. The caller surfaces a warning.

## Scaling Considerations

These fixes don't address scaling per se, but several affect the system's ability to handle concurrent load:

| Concern | Before Fix | After Fix |
|---------|-----------|-----------|
| Database pool eviction | Random (may evict active session) | LRU (evicts oldest-accessed) |
| Rate-limit memory leak | Map grows unbounded with unique IPs | Stale entries cleaned periodically |
| AI provider thread blocking | No timeout → thread hangs forever | 5s connect / 60s read / 30s write timeout |
| FK race during reset | Connection state corrupted on exception | No PRAGMA toggle, clean topological drop |

## Architecture Decisions for This Cleanup

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Parser positions transport | Inline in execute response | Zero extra latency; backend already computes them |
| LRU implementation | LinkedHashMap (access-order) + ReentrantLock | No new dependencies, exact LRU, low contention |
| clearDatabase approach | Topological drop by FK dependency | Eliminates PRAGMA toggle entirely, no race |
| ER position persistence | Module-level cache (Map keyed by schema signature) | Survives component destroy/recreate, no KeepAlive needed |
| emit type for composable | Accept callback instead of raw emit | Simpler than Vue generic emit, better TypeScript inference |

## Sources

- Source code analysis: `SqlExecutionService.java`, `DatabasePoolManager.java`, `SqlParser.java`, `SqlResponse.java`, `RateLimitFilter.java`, `OpenAiCompatibleProvider.java`, `AiService.java`
- Frontend analysis: `ErDiagram.vue`, `useErDiagram.ts`, `useBidirectionalSync.ts`, `sqlStatements.ts`, `useInlineEdit.ts`
- Project documentation: `.planning/PROJECT.md`, `.planning/codebase/CONCERNS.md`, `.planning/codebase/ARCHITECTURE.md`

---
*Architecture research for: sqlive tech debt cleanup*
*Researched: 2026-05-29*
