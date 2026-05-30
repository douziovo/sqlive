# Domain Pitfalls: SQL Playground Tech Debt Cleanup

**Domain:** Full-stack SQL playground (Monaco editor -> SQLite in-memory backend -> table visualizer)
**Researched:** 2026-05-29
**Mode:** Ecosystem (project-specific)
**Confidence:** HIGH (all findings verified against codebase source)

## Critical Pitfalls

### Pitfall 1: Statement boundary mismatch when unifying parsers

**What goes wrong:**
Unifying the frontend and backend parsers corrupts inline editing. The frontend's `extractSqlStatements()` splits only on `;` with quote tracking. The backend's `SqlParser.parseStatementsPrecise()` also tracks `BEGIN`/`END` and `CASE`/`END` depth, never splitting when depth > 0. After unification, statement boundaries shift for any script containing `BEGIN...END` blocks or `CASE...END` expressions. The `findTupleInBatch` function in `useBidirectionalSync` then searches the wrong text range and returns `null`, causing inline edits to silently fail (`console.warn('无法定位原始代码行 (Batch Mode)')`) with no user-visible error.

**Why it happens:**
The two parsers have fundamentally different models of "where a statement begins." The backend tracks comment/whitespace start positions (via `skipWhitespaceAndComments`), while the frontend strips whitespace differently (comments are not even removed from the start position). The `absoluteStart` and `absoluteEnd` positions computed in `useBidirectionalSync.updateRow()` are the sum of the frontend parser's `stmt.start` + the tuple position within the statement. Switching to backend positions changes the `stmt.start` value by potentially hundreds of characters for scripts with leading whitespace or comments.

Specific divergence points:
- Backend: skips all leading whitespace and comments before a statement begins
- Frontend: places `start` at the character immediately after the previous `;`
- For the first statement: backend's start = after leading whitespace/comments; frontend's start = 0 always

**How to avoid:**
- Do NOT replace frontend positions with backend positions in-place. Instead, add backend positions as a new field in the API response (`canonicalStatements: [{text, start, end}][]`) and keep the frontend parser running in parallel until both are verified to produce identical positions.
- Write a cross-reference test that feeds 50+ SQL scripts (including edge cases with BEGIN/END, CASE, multi-line strings, nested comments) to both parsers and asserts start/end positions match.
- In `useBidirectionalSync.updateRow()`, add a validation step: after computing `absoluteStart`, verify that `code.value.substring(absoluteStart, absoluteEnd)` matches the expected tuple text. Log a warning and fall back to the frontend parser if the backend positions don't align with the actual code content.
- Never change `updateRow`'s string replacement approach (`substring` slicing) at the same time as changing position sources -- separate the refactors.

**Warning signs:**
- Previously functional inline edits start logging "无法定位原始代码行" in the browser console
- Inline edits produce corrupted SQL (e.g., `INSERT INTO t VALUES (1, 'a')` becomes `INSERT INTO t VALUES (1, 'a')  VALUES (1, 'a')` or similar duplication/truncation)
- ANY change to `updateRow`'s position arithmetic causes test failures in `sqlStatements.test.ts`

**Phase to address:**
SQL-01 (Unify parsers). This phase MUST include:
1. A cross-reference test suite that validates both parsers produce identical positions
2. A grace period where both parsers run and positions are compared before switching

---

### Pitfall 2: Eviction races -- closing a DataSource while another thread uses it

**What goes wrong:**
`DatabasePoolManager.getOrCreateJdbcTemplate()` uses `evictionLock` to serialize creation and eviction, but after a JdbcTemplate is returned, there is no guard against concurrent use during eviction. Thread A calls `getOrCreateJdbcTemplate("db1")`, gets a valid template, starts executing SQL. Concurrently, Thread B calls `getOrCreateJdbcTemplate("db2")`, the pool is full, and it evicts "db1" -- calling `closeDataSource()` which calls `hds.close()` on the HikariCP pool. Thread A's in-flight SQL execution hits a "Connection is closed" exception. The user sees a spurious error.

**Why it happens:**
The eviction lock only protects the map mutation (`get/put/remove`), not the lifecycle of the DataSource objects. HikariCP's `close()` is designed to be safe for the caller but unsafe for concurrent users of the pool. This is a classic "check-then-use" race: Thread B checked `jdbcTemplates.size() >= MAX_DATABASES`, evicted db1, and closed its DataSource. But Thread A had already checked `jdbcTemplates.get("db1") != null` (returning the template) before the eviction happened.

**How to avoid:**
- Implement reference counting: each `getOrCreateJdbcTemplate()` call increments a use-count. Only evict databases with zero active users. Decrement the count in a `finally` block after SQL execution.
- OR: use `evictionLock` as a read-write lock: read lock for normal access, write lock for eviction. This serializes eviction with all other access.
- OR: implement LRU with access-time tracking and never evict a database that was accessed within the last N seconds. This is a softer mitigation (not a guarantee) but avoids the complexity of reference counting.
- At minimum: in `closeDataSource()`, catch the exception and log a warning. This prevents crashes but doesn't prevent the failed SQL execution.

**Warning signs:**
- Intermittent `java.sql.SQLException: Connection is closed` in backend logs during normal multi-tab use
- User reports "my table suddenly disappeared" or "query failed, try again"
- These errors appear more frequently when many tabs are open (approaching MAX_DATABASES=20)

**Phase to address:**
EVICT-01 (LRU eviction). The LRU implementation MUST include a safety check against evicting currently-in-use databases.

---

### Pitfall 3: `clearDatabase()` PRAGMA `foreign_keys` toggle races with concurrent requests

**What goes wrong:**
`SqlExecutionService.clearDatabase()` sets `PRAGMA foreign_keys = OFF`, drops all objects, then sets `PRAGMA foreign_keys = ON`. When two requests hit the same database concurrently, Request A (with `reset=true`) starts clearing while Request B (with `reset=false`) is mid-insert. During the window between OFF and ON, Request B's INSERT bypasses FK validation, potentially inserting orphaned rows.

This is explicitly documented as FK-01 in PROJECT.md but the danger during cleanup is that a "fix" like removing the PRAGMA toggle but keeping the same statement-level execution (single `Connection.createStatement()`) could introduce other issues if not done carefully.

**Why it happens:**
The `clearDatabase()` method uses `jdbc.execute((Connection con) -> { try (Statement stmt = con.createStatement()) { ... } })`. Inside this callback, it creates a statement and issues PRAGMA queries. The JdbcTemplate uses a single connection from the HikariCP pool (pool size = 1), which means concurrent requests to the same database go through the SAME connection sequentially due to HikariCP's pool lock. BUT: the connection's underlying SQLite shared cache mode means that PRAGMA settings on one connection may be visible to another connection sharing the same cache.

The actual risk threshold depends on `mode=memory&cache=shared`. In shared cache mode, PRAGMA settings ARE visible to all connections sharing the cache. So even though HikariCP pool size=1 serializes access through that pool, if there are multiple databases pointing to the same cache... wait, each database has its own pool. So the risk is between multiple JdbcTemplates pointing to the same database. But each database is uniquely named, so this shouldn't happen. UNLESS two `getOrCreateJdbcTemplate()` calls with different names somehow map to the same SQLite in-memory database.

Re-reading: `jdbc:sqlite:file:" + name + "?mode=memory"`. Each name creates a separate in-memory database. So the FK race only happens if two requests use the SAME dbName -- one with reset=true, one with reset=false. This is possible if the frontend sends concurrent requests for the same tab.

**How to avoid:**
- Replace the PRAGMA toggle with a dependency-ordered DROP. Query `sqlite_master` for all tables, extract FK relationships, and DROP in leaf-to-root order (child tables before parent tables). This avoids needing to disable FK checks entirely.
- If the PRAGMA toggle must stay, use a dedicated connection for `clearDatabase()` that doesn't share the cache with the user's connection.
- Add a per-database `clearLock` (ReentrantLock) to serialize reset operations for the same database.

**Warning signs:**
- Test failures in FK-related inserts after a reset
- Orphaned rows (rows referencing non-existent parent rows) appearing in user data
- The error `FOREIGN KEY constraint failed` followed by successful inserts of invalid data

**Phase to address:**
FK-01. This must be done as part of the database lifecycle fixes, before EVICT-01 since the eviction fix may change how connections are managed.

---

### Pitfall 4: Adding timeouts to the AI WebClient breaks long-running local models

**What goes wrong:**
The planned fix for AI-01 adds (connect=5s, read=60s, write=30s) to `OpenAiCompatibleProvider.buildWebClient()`. In `streamChat()`, the read timeout applies to the entire SSE connection. If a local Ollama model takes 45 seconds to start generating output, the read timeout fires 60 seconds after connection, cutting off the response at 60 seconds of total stream time. But if the model generates for 90 seconds, the response is cut off at the 60-second mark regardless of whether it was still producing valid output.

In `complete()`, the `.block(Duration)` timeout replaces the no-timeout `.block()`. If a DeepSeek API call takes 7 seconds but the timeout is set to 5 seconds, the call fails unnecessarily. Different providers need different timeout values.

**Why it happens:**
The WebClient/Reactor stack has multiple timeout layers, and it is easy to confuse them:
- `HttpClient` (Netty) level: `responseTimeout(Duration)` applies to the entire HTTP exchange
- WebClient level: no direct timeout configuration
- Individual request level: `block(Duration)` for blocking calls
- SSE stream level: no per-event timeout, only connection-level

Setting a single global timeout on the `WebClient` builder with `.build()` -- which doesn't even support timeout config directly -- requires configuring the underlying `HttpClient` via `.clientConnector(new ReactorClientHttpConnector(HttpClient.create().responseTimeout(...)))`. Developers commonly add timeouts to the blocking `.block()` call but forget to configure the reactive streaming path.

**How to avoid:**
- Configure timeouts on the underlying `HttpClient`, not on `WebClient`:
  ```java
  HttpClient httpClient = HttpClient.create()
      .responseTimeout(Duration.ofSeconds(60));
  WebClient.builder()
      .clientConnector(new ReactorClientHttpConnector(httpClient))
      .build();
  ```
- Use per-provider timeout configuration instead of hardcoded values. Add `connectTimeout`, `readTimeout`, and `writeTimeout` fields to `AiProviderConfig`.
- For streaming: set the read timeout to the provider's expected max response time (might be 300s for local models). OR: disable the read timeout entirely for streaming and rely on the SSE stream's keepalive/heartbeat instead.
- For blocking `.complete()`: use `.block(Duration.ofSeconds(config.getTimeout()))` with a fallback that distinguishes timeout from other errors.
- Add a health-check timeout for `isAvailable()` that is shorter than the request timeout (e.g., 3s). A provider that is unresponsive should be detected quickly without blocking the health check.

**Warning signs:**
- AI stream starts but stops mid-response with no error in the UI
- Backend logs show `ReadTimeoutException` or `TimeoutException` for AI calls
- Only some providers fail (the slow ones) while fast ones work fine
- Intermittent "AI service call failed" errors that correlate with provider load

**Phase to address:**
AI-01. This must be coordinated with the error handling improvements (AI-04 or similar) because timeout errors should be distinguishable from other failures.

---

### Pitfall 5: Ghost row fix creates a state machine deadlock

**What goes wrong:**
Fixing GHOST-01 (preserve ghost row input on failed insert) requires the ghost row to survive the `insert-row` -> execute -> response round-trip. The current code in `onGhostSubmit()` clears ghost row state immediately:
```typescript
emit('insert-row', { tableName: props.table.name, newRow: { ...ghostRow } })
Object.keys(ghostRow).forEach((k) => delete ghostRow[k])
```
This emit triggers `insertRowUI` in `useBidirectionalSync`, which calls `beginReconcile()`, setting mode to 'reconciling', which triggers `executeSqlRemote()`. The execution runs, and if it fails, `mode` goes to 'rollback', code resets to `lastValidCode` -- but the ghost row state is already gone.

The naive fix (defer clearing ghost row until execution succeeds) requires threading the execution result back to `TableSection.vue`. The simplest approach -- adding a ref like `ghostInsertError` -- creates a coupling between `useSqlEngine`'s execution state and `TableSection`'s UI state. If not done carefully, the ghost row can get into inconsistent states where the UI shows stale data from a previous failed insert.

**Why it happens:**
The ghost row state lives in `TableSection.vue`'s local `ghostRow` reactive object. The execution result comes from `useSqlEngine`, which is injected via `SQL_CONTEXT_KEY`. There is no direct communication channel between `executeSqlRemote`'s success/failure and the specific ghost row that triggered it. The fix must bridge this gap without creating tight coupling.

The state machine (`user -> reconciling -> user | rollback`) is designed for the code editor workflow, not for the ghost row workflow. The ghost row's insert is implemented as a code mutation (append INSERT statement to the script), then a full re-execute. If the execution fails, the code reverts (rollback) -- but the ghost row was already cleared. The state machine assumes "reconcile failure = roll back to last valid code", which works for inline edits but NOT for ghost inserts because the ghost row UI state is disconnected from the code state.

**How to avoid:**
- Do not use the reconciling/rollback state machine for ghost row state. Instead:
  - Keep ghost row data in a ref in `useSqlEngine` (or a dedicated composable) that `TableSection` reads
  - Clear ghost row only in the `executeSqlRemote` success handler, not in `onGhostSubmit`
  - On execution failure, the ghost row data remains in the ref, and the UI re-populates from it
- Alternative: add a `ghostPending` flag in the SQL context that the ghost row checks before clearing. Clear on success, keep on failure.
- The ghost row inputs should use `v-model` bound to a ref that survives re-renders, not object properties that get deleted.
- Add a timeout: if the execution takes >10s, show a "retry" option rather than blocking the ghost row forever.

**Warning signs:**
- Users report "I typed data into the new row form, clicked submit, and my input disappeared but the row wasn't added"
- Backend logs show constraint violation errors that correspond to ghost insert attempts
- After a failed insert, the ghost row shows stale data from a PREVIOUS failed insert (not the most recent)

**Phase to address:**
GHOST-01. This fix requires changes in THREE files: `TableSection.vue` (stop clearing ghost row immediately), `useSqlEngine.ts` (expose execution success/failure for ghost rows), and potentially `useBidirectionalSync.ts` (if the insert path needs modification).

---

### Pitfall 6: ER diagram fix triggers infinite layout loop

**What goes wrong:**
Fixing ER-01 (nodes collapse to `{x:0, y:0}` on tab switch) requires running dagre layout when the ER panel is re-shown. The current code runs `autoLayout()` only in `onPaneReady`, which fires once when VueFlow is first created. If the ER diagram is hidden via `v-if` (component destroyed and recreated), `onPaneReady` fires again on recreation. But if the fix adds a `watch` on component visibility or a `onActivated`/`onDeactivated` lifecycle hook, the layout can fire multiple times.

The danger is an infinite loop: layout runs -> `nextTick` completes -> node positions update -> VueFlow emits a viewport change -> something watches it -> layout runs again. This wastes CPU and causes visual flicker.

A more subtle issue: if the fix stores node positions in a ref that persists across component destruction (e.g., elevated to `useErDiagram` which is created at a higher level), and the `rebuild()` function creates NEW node objects (breaking reference equality), the stored positions become stale.

**Why it happens:**
VueFlow's reactivity: when `nodes` ref changes, VueFlow re-renders. If `autoLayout()` updates `nodes.value`, and the component is in a `watch` that also triggers `autoLayout()`, the cycle is:
1. `autoLayout` -> sets `nodes.value = layoutNodes(...)` -> VueFlow re-renders
2. VueFlow's internal state updates -> `onNodePositionChange` or similar fires
3. If anything watches node positions and calls `autoLayout` again -> goto 1

The `useErDiagram` composable is created at the `ErDiagram.vue`'s `setup()` level, not at the parent level. So when the component is destroyed (tab switch), the composable state is also destroyed. Any fix that elevates state must move the composable instantiation to the parent, which is a significant refactor.

**How to avoid:**
- Use `v-show` instead of `v-if` for the ER diagram panel. This keeps the component alive and `onPaneReady` doesn't re-fire. But this means the component is always rendered (hidden via CSS), which has a performance cost.
- If using `v-if`: store node positions in `window.sessionStorage` or a ref in `useSqlEngine`. On `onPaneReady`, check if stored positions exist. If yes, use them instead of running layout. If no, run layout and save positions.
- Add a guard flag to prevent re-entrant layout:
  ```typescript
  let isLayouting = false
  async function autoLayout() {
    if (isLayouting) return
    isLayouting = true
    try {
      await innerAutoLayout()
    } finally {
      isLayouting = false
    }
  }
  ```
- NEVER trigger `autoLayout()` in a `watch` on `nodes.value` or any derivative of node positions.
- If persisting positions: do NOT update the stored positions on every drag. Use a debounced save (e.g., 1s after last drag ends).

**Warning signs:**
- ER diagram flickers or jumps when switching tabs
- CPU usage spikes when the ER panel is visible
- Nodes appear to "snap back" to original positions after being dragged
- Multiple `dagre` layout calls visible in profiler traces

**Phase to address:**
ER-01. The fix is tightly coupled to how the tab switching component handles the ER panel (v-if vs v-show vs keep-alive). Must read the parent layout component before implementing.

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Full script re-execute on every cell edit | Avoids implementing incremental UPDATE | O(n) per keystroke; limits growth to toy databases | Acceptable for current scale (sub-100-row databases). Revisit at 1000+ rows. |
| Random ConcurrentHashMap eviction | Simple, 3 lines of code | Active sessions silently killed | Never. Replace with LRU immediately. |
| Frontend SQL parser duplicates backend | Quick implementation for inline edit | Parser divergence creates hard-to-debug bugs | Temporary during initial build. Must unify now. |
| `@SuppressWarnings("SqlSourceToSinkFlow")` on method | Quietly ship without per-line annotation | Hides potential real injection vectors | Acceptable only because the app intentionally runs user SQL. Still, scope to the specific line for clarity. |
| `volatile` on effectively-final providers | Misleading thread-safety documentation | Future devs think it's safe to add concurrent access | Should never be used for single-initialization fields. Remove or implement proper refresh. |
| Ghost row cleared optimistically before execution result | Simple "fire and forget" UI | User input lost on failed insert | Acceptable for MVP. Fix now for reliability. |
| ER diagram layout only on `onPaneReady` | Avoids layout performance cost | Tab switch destroys layout state completely | Acceptable only if `v-show` is used. Otherwise must fix. |
| No timeout on AI WebClient | Simple construction | Thread pool exhaustion if AI provider hangs | Never acceptable in production. Fix in this milestone. |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| SQLite + HikariCP pool | Setting pool size > 1 for a memory-only SQLite | SQLite in-memory databases are per-connection. Pool size > 1 creates multiple isolated databases. Keep poolSize=1. |
| WebClient SSE streaming + timeout | Setting read timeout on the entire stream | Read timeout fires if no data received within the window, even if the stream is still valid. For SSE, use a much longer timeout or disable it entirely and handle provider disconnects via other means. |
| AI provider error logging | Logging the full exception including request metadata | Extract and sanitize the error message. Mask any `Authorization` header or API key that appears in the response body or URL. |
| VueFlow + v-if tab switching | Running layout only on `onPaneReady` | VueFlow is destroyed and recreated with `v-if`. The `onPaneReady` callback fires on each recreation but positions are not persisted. Use `v-show` or save/restore positions. |
| WebSocket-less SSE on frontend | Buffering entire response body before parsing | SSE is line-delimited; the buffer only shrinks as lines are parsed. For long AI responses, the buffer can grow before lines are fully formed. Add a safety cap (~1MB) and document the memory assumption. |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full script re-execution per cell edit | Noticeable delay when editing cells in databases with >50 statements | Re-executing 100 INSERTs to update 1 row is wasteful. Target specific `UPDATE` for cell edits, fall back to full re-execute only if the incremental path fails. | 100+ statements or 1000+ rows per execution. |
| MetadataExtractor queries `sqlite_master` 4x per request | Slow response on databases with many tables/views | Cache the `sqlite_master` query result in a single pass and pass it to all extraction methods. | 50+ database objects (tables + indexes + triggers + views). |
| In-memory SSE buffer growing unboundedly | Browser memory usage grows during long AI conversations | Cap the SSE buffer at 1MB. If exceeded, close the stream and restart from last complete message. | AI responses exceeding ~500KB (typical with long context). |
| Rate limit entries never cleaned | Memory grows linearly with unique visitors | Schedule a periodic cleanup of entries older than `WINDOW_MS`. | 10,000+ distinct `clientIp:path` combinations (unlikely at current localhost-only scale). |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Using PRAGMA `foreign_keys = OFF` to clear database | Concurrent request bypasses FK validation | Drop tables in dependency order (child before parent). Never disable FK enforcement. |
| Allowing raw SQL execution without SQLite authorizer | `ATTACH DATABASE` reads/writes server filesystem | Set a SQLite authorizer callback via `Connection.createStatement().getConnection().setAuthorizer()`. Block `ATTACH DATABASE`, `DETACH DATABASE`, and dangerous PRAGMAs. |
| AI API keys visible in error logs | Credential leakage | Sanitize error messages before logging: replace `Authorization: Bearer ...` with `Authorization: Bearer [REDACTED]`. Check the AI provider's error response for echoed keys. |
| Broader-than-necessary `@SuppressWarnings` on execute method | Static analysis can't flag actual injection vectors | Move `@SuppressWarnings("SqlSourceToSinkFlow")` to the specific `stmt.execute()` call site. Add a comment: "Intentional: app runs user SQL against sandboxed in-memory database." |
| Inconsistent `dbName` validation between DTO and service | `@Pattern` allows characters that service rejects, producing 500 instead of 400 | Unify regex to `^[a-zA-Z0-9_-]{1,64}$` in the DTO. The service should never need its own validation if the DTO catches it first. |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Silent inline edit failure | User edits a cell, no visual feedback, edit is lost | When `findTupleInBatch` returns null, show an inline error on the edited cell. Log the reason (statement format mismatch). |
| Silent VARCHAR truncation | User types "Hello World" into VARCHAR(5), it becomes "Hello" without warning | `enforceTypeConstraints` should return both the truncated value and a flag. The UI should show a toast: "Value truncated to 5 characters." |
 | Ghost row input lost on failed insert | User fills out 5 fields, clicks submit, gets a generic error, all input gone | Keep ghost row state until backend confirms success. Alternatively, provide a "retry" button that repopulates the form from the last input. |
| ER diagram loses layout on tab switch | User arranges tables nicely, switches away, comes back to all nodes stacked | Persist node positions in the session. On re-mount, restore positions and skip dagre layout. |
| AI stream hangs without feedback | User asks a complex question, spinner spins indefinitely, no error | Add a client-side timeout for AI streaming (e.g., 120s). After timeout, show "AI provider is not responding" and allow retry. |
| Concurrent requests with `reset=true` wipe other tabs' databases | User opens 2 tabs, runs SQL in both, Tab A's database gets reset when Tab B executes | Each tab has a unique `dbName`. Verify that the `activeTab.value.dbName` is unique per tab. The `shouldReset` function should only reset when `dbName` changes. |

## "Looks Done But Isn't" Checklist

- [ ] **Unified parsers:** Did you verify that `parseStatementsPrecise` and `extractSqlStatements` return identical positions for ALL scripts in the test suite? Including scripts with leading whitespace, leading comments, and mixed `;` usage?
- [ ] **LRU eviction:** Did you verify that the LRU strategy cannot evict a database with an in-flight request? Did you test concurrent access with 20+ tabs?
- [ ] **AI timeouts:** Did you test streaming timeout with a deliberately slow AI provider (e.g., Ollama running a large model)? Did you verify that timeout errors don't leak the API key in logs?
- [ ] **Ghost row fix:** Did you test: constraint violation, FK violation, network error, and timeout? Does the ghost row survive ALL failure modes? Does it show a useful error message?
- [ ] **ER diagram fix:** Did you test: tab switch, window resize, browser zoom, multiple tab switches in sequence? Do positions survive more than one switch cycle?
- [ ] **Inline edit fix:** Did you test: multi-line VALUES, nested parentheses in VALUES, strings containing `;`, strings containing `--`, tables with reserved-word names?
- [ ] **Security hardening:** Did you test `ATTACH DATABASE` with the authorizer in place? Did you verify the error message is logged without the API key? Did you test with both network error AND a provider that echoes auth headers in the error body?
- [ ] **State machine changes:** If you changed ANY mode transition, did you verify all four paths: user->reconciling, reconciling->user, reconciling->rollback, rollback->user? Did you test reconciliation failure followed by a code edit?
- [ ] **Backward compatibility:** Do existing saved scripts (e.g., `DEFAULT_SQL`, user `exportTab` output) still work after your changes?

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Parser unification corrupts SQL | HIGH -- user data loss | Immediately stop all edits. Revert the parser change. Restore `lastValidCode` for each tab. Investigate position mismatch. |
| In-use database evicted | LOW -- reconnect | The tab loses its database. On next execution, `getOrCreateJdbcTemplate()` creates a new one. User needs to re-run their SQL. Add a warning banner: "Session expired, re-execute to continue." |
| AI timeout on slow model | MEDIUM -- wasted time | Add per-provider timeout configuration. The user can increase timeout in settings if they use a slow local model. |
| Ghost row input lost | LOW -- re-enter data | The user can re-enter data. To prevent: implement the fix with a retry mechanism. |
| ER diagram layout lost | LOW -- re-arrange | Run auto-layout again (toolbar button). User re-arranges. To prevent: implement position persistence. |
| State machine deadlock | HIGH -- app unusable | Force mode to 'user' via browser console: `window.__forceMode?.('user')`. Reload page. Add a "Reset State" button in the debug panel. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Parser boundary mismatch (Pitfall 1) | SQL-01 (Unify parsers) | Cross-reference test suite with 50+ scripts showing identical start/end positions from both parsers |
| Eviction race with active connection (Pitfall 2) | EVICT-01 (LRU eviction) + EVICT-02 (reference counting) | Stress test with 25 concurrent requests across 25 tabs, verify no "Connection is closed" errors |
| PRAGMA foreign_keys race (Pitfall 3) | FK-01 (Dependency-ordered DROP) | Test concurrent reset + insert on same dbName, verify FK constraints always enforced |
| AI WebClient timeout breaks streaming (Pitfall 4) | AI-01 (Timeout configuration) | Test with deliberately slow AI provider (30s+ first token); verify stream completes normally |
| Ghost row state machine deadlock (Pitfall 5) | GHOST-01 (Preserve ghost row on failure) | Test all insert failure modes -- constraint violation, FK violation, network error, timeout -- verify ghost row state persists and shows error |
| ER diagram infinite layout loop (Pitfall 6) | ER-01 (Persist layout on tab switch) | Test rapid tab switching (10+ switches in 2 seconds); verify no excessive layout calls and positions persist |
| Inconsistent dbName validation | VALID-01 (Unify regex) | Prove both DTO and service use the same regex pattern by refactoring to a shared constant |
| Silent VARCHAR truncation | EDIT-01 (Truncation warning) | Test truncation with toast message, verify user sees warning |
| `volatile` on providers | AI-02 (Fix provider visibility) | Verify `volatile` removed OR `refreshProviders()` implemented with atomic map swap |
| API key in error logs | SEC-02 (Sanitize error logs) | Inject a simulated error that echoes the auth header; verify logged message has `[REDACTED]` |
| ATTACH DATABASE sandbox escape | SEC-01 (Disable dangerous SQL) | Create a test that tries `ATTACH DATABASE '/etc/passwd'` and verifies it is blocked with a clear error |

## Cross-Cutting Risk: State Machine Invariants

The `useSqlEngine` state machine (`user -> reconciling -> user | rollback -> user`) is the backbone of all data flow. Multiple fixes in this milestone touch it:

| Fix | Touches Mode | Risk |
|-----|-------------|------|
| SQL-01 (parser unification) | Indirectly via position changes | Changes can cause reconciling failures (parser mismatch -> tuple not found -> rollback not triggered but SQL error -> state mismatch) |
| GHOST-01 (ghost row) | Yes -- `insertRowUI` calls `beginReconcile` | Changes to when ghost row state clears affect how the state machine transitions |
| EDIT-01 (truncation warning) | No | Safe -- pure UI change |
| ER-01 (ER diagram) | No | Safe -- layout only |
| EVICT-01 (LRU eviction) | No | Safe -- backend only |
| FK-01 (clearDatabase fix) | No | Safe -- backend only |
| AI-01 (timeouts) | No | Safe -- backend only |

**If ANY fix changes `useBidirectionalSync`'s `beginReconcile()`, `updateRow()`, `deleteRow()`, or `insertRowUI()`**, re-verify the state machine transitions end-to-end:
1. Run the full frontend test suite
2. Manually test: type code -> auto-execute succeeds -> edit cell -> auto-execute succeeds -> edit cell to cause error -> rollback happens -> code restores correctly
3. Test the edge case: edit cell -> edit another cell before first edit finishes executing (debounce cancellation)

## Sources

- Codebase source analysis (verified):
  - `SqlParser.java` parseStatementsPrecise() hand-written state machine
  - `sqlStatements.ts` extractSqlStatements() simple semicolon split
  - `useBidirectionalSync.ts` updateRow/deleteRow/insertRowUI with string manipulation
  - `useSqlEngine.ts` state machine and execution flow
  - `DatabasePoolManager.java` ConcurrentHashMap with random eviction
  - `SqlExecutionService.java` clearDatabase() with PRAGMA toggle
  - `OpenAiCompatibleProvider.java` WebClient with no timeout
  - `useErDiagram.ts` / `ErDiagram.vue` dagre layout in onPaneReady
  - `TableSection.vue` ghost row cleared optimistically
  - `useInlineEdit.ts` emit typed as any

- `CONCERNS.md` -- Full tech debt and bug catalog
- `PROJECT.md` -- Active requirements and context
- `CLAUDE.md` -- Known gotchas (SQL parsing, SQLite JDBC, Monaco, Vue script setup)

---
*Pitfalls research for: sqlive tech debt cleanup*
*Researched: 2026-05-29*
