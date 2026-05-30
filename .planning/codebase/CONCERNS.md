# Codebase Concerns

**Analysis Date:** 2026-05-30

## Tech Debt

### RateLimitFilter ScheduledExecutorService never shut down

- **Issue:** `RateLimitFilter` uses a `ScheduledExecutorService` for periodic cleanup of expired rate-limit windows, but there is no `destroy()` method or `@PreDestroy` hook to shut it down. The executor is daemon-threaded, so it won't prevent JVM exit, but it leaks the thread and scheduler resources for the lifetime of the application.
- **Files:** `sqlive-backend/src/main/java/com/douzi/sqlive/config/RateLimitFilter.java:23-27`
- **Impact:** Thread leak. Each `Filter` instance (unlikely in production, but possible with hot-redeploy) leaks a scheduler thread.
- **Fix approach:** Implement `Filter.destroy()` to call `cleanupScheduler.shutdown()`.

### Default datasource URL vs user pool URLs diverge on `cache=shared`

- **Issue:** The `application.yml` default datasource uses `jdbc:sqlite:file:playground?mode=memory&cache=shared`, but `DatabasePoolManager.createJdbcTemplate()` constructs `jdbc:sqlite:file:{name}?mode=memory` without `cache=shared`. In SQLite, `cache=shared` allows multiple connections to share a single cache for the same database. With `maximumPoolSize=1` per database this has no practical effect, but the inconsistency could mask SQLite-level concurrency bugs during development.
- **Files:**
  - `sqlive-backend/src/main/resources/application.yml:5`
  - `sqlive-backend/src/main/java/com/douzi/sqlive/service/database/DatabasePoolManager.java:135`
- **Impact:** Subtle behavioral differences between the default playground database and user-created databases. If the pool size is ever increased beyond 1, the system databases would behave differently.
- **Fix approach:** Either add `&cache=shared` to the pool URL pattern, or document the intentional difference.

### `topologicalSortTables` only handles direct FK cycles

- **Issue:** The FK-ordered table drop in `SqlExecutionService.clearDatabase()` uses Kahn's algorithm for topological sort. It correctly handles direct FK cycles (tables that transitively reference each other) by falling back to arbitrary order. However, the cycle detection only identifies that some tables remain after the sort, not which specific cycle. Self-referencing tables (FK pointing to the same table) are handled implicitly since they don't appear in the adjacency list's "to" entries.
- **Files:** `sqlive-backend/src/main/java/com/douzi/sqlive/service/SqlExecutionService.java:150-199`
- **Impact:** When a cycle is present, the remaining tables are dropped in arbitrary order, which may violate FK constraints if done in the wrong order and cause SQLite errors.
- **Fix approach:** Identify and report the specific cycle. For self-referencing FKs, explicitly disable FK checks before dropping that table.

### Frontend parser does not handle dollar-quoted strings (PostgreSQL style)

- **Issue:** The frontend `extractSqlStatements()` parser in `sqlStatements.ts` tracks single/double quotes, `--` line comments, and `/* */` block comments, but does NOT handle `$tag$...$tag$` dollar-quoting (PostgreSQL syntax). If a user types PostgreSQL-style strings, statement boundary detection will break.
- **Files:** `sqlive-frontend/src/utils/sqlStatements.ts:8-71`
- **Impact:** Misidentified statement boundaries when users type PostgreSQL-style dollar-quoted strings. Though not valid SQLite, users may paste such syntax.
- **Fix approach:** Add dollar-quote tracking to the frontend parser, or (preferred) rely entirely on backend-provided `canonicalStatements` from the response and deprecate the frontend parser for statement boundary tasks.

### Full script re-execution on every cell edit

- **Issue:** Every inline cell edit triggers a full SQL script re-execution. The bidirectional sync workflow replaces a VALUES tuple and then re-executes the entire script backend-side. For scripts with many DDL/DML operations, this is O(n) in script length for every cell edit.
- **Files:**
  - `sqlive-frontend/src/composables/useBidirectionalSync.ts:91-107` (triggers code change)
  - `sqlive-backend/src/main/java/com/douzi/sqlive/service/SqlExecutionService.java:50-74` (re-executes everything)
- **Impact:** Cell edits on large scripts are slow. A script creating 20 tables with seed data takes 20x longer to respond to a single cell edit.
- **Fix approach:** For simple cell edits, generate a targeted `UPDATE` statement and apply it incrementally. Fall back to full re-execution if the incremental path fails.

### `HikariDataSource.close()` may block during pool cleanup

- **Issue:** Both `DatabasePoolManager.closeDataSource()` and `cleanup()` call `HikariDataSource.close()` without a timeout. HikariCP's close waits for active connections to finish, which could block indefinitely if a connection is stuck executing a long-running query.
- **Files:** `sqlive-backend/src/main/java/com/douzi/sqlive/service/database/DatabasePoolManager.java:123-131, 64-82`
- **Impact:** During application shutdown or pool eviction, the cleanup thread may hang waiting for connections to complete.
- **Fix approach:** Use `HikariDataSource.close()` with a timeout via a separate thread or executor service. Alternatively, close the underlying SQLite connection directly.

### `AiProvider.protocol` instances created per-request (no reuse concern, but constructor-heavy)

- **Issue:** Each call to `AiService.init()` or `refreshProviders()` creates new `OpenAiCompatibleProvider` instances, each building a new `WebClient`. While the providers are cached in the `Map<String, AiProvider>`, the `WebClient` objects are retained for the provider's lifetime. This is acceptable for the current configuration, but if `refreshProviders()` is called frequently, it would leak `WebClient` connections.
- **Files:** `sqlive-backend/src/main/java/com/douzi/sqlive/service/ai/AiService.java:57-75`
- **Impact:** Currently no impact (called once at startup), but `refreshProviders()` lacks a `WebClient` cleanup mechanism for old instances.
- **Fix approach:** Add `WebClient` cleanup to `refreshProviders()`. Old provider instances should have their underlying HTTP connection pools closed.

## Known Bugs

### `LmStudioSseLineAdapter` statefulness across stream invocations

- **Symptoms:** The inner class `LmStudioSseLineAdapter` in `LmStudioProtocol` uses a mutable `lastEvent` field (line 145). While `processStream()` creates a fresh adapter per invocation via `concatMap new LmStudioSseLineAdapter(...)`, if the `Function` instance were ever reused across multiple streams (e.g., in a cached or parallel scenario), `lastEvent` would be shared across streams, causing event/data line mismatches.
- **Files:** `sqlive-backend/src/main/java/com/douzi/sqlive/service/ai/LmStudioProtocol.java:142-181`
- **Trigger:** Not triggered by current code (fresh instance per `processStream` call). But a future refactor that extracts the adapter as a shared singleton would silently introduce this bug.
- **Workaround:** Keep the adapter as a fresh instance per `processStream()`. Document the constraint.

### CanonicalStatement `start`/`end` may produce zero-length ranges

- **Symptoms:** The `CanonicalStatement.setStart()` and `setEnd()` in `SqlExecutionService` (lines 80-81) compute `end = s.startPos() + s.sql().length()`. If `s.sql()` has leading or trailing whitespace (stripped by `trim()` before adding to the list), the range is based on the original text including whitespace. Whitespace-only statements are filtered out, so in normal cases this is correct. But a script ending with trailing whitespace after the last `;` could produce a statement with misaligned `end`.
- **Files:** `sqlive-backend/src/main/java/com/douzi/sqlive/service/SqlExecutionService.java:76-83`
- **Trigger:** SQL scripts with trailing whitespace after the final statement.
- **Workaround:** Before using canonical statements, validate `end > start` and `text` is non-empty.

### MetadataExtractor constraint extraction may misparse composite column types

- **Symptoms:** The `extractConstraintsFromSql()` method (line 206) splits column definitions by comma at depth 0. Composite types like `DECIMAL(10,2)` with commas inside parentheses are handled correctly. However, column definitions containing `GENERATED ALWAYS AS (...)` with inner commas may be split incorrectly.
- **Files:** `sqlive-backend/src/main/java/com/douzi/sqlive/service/metadata/MetadataExtractor.java:206-243`
- **Trigger:** Tables with generated columns or check constraints containing commas.
- **Workaround:** Avoid generated columns with complex expressions containing commas.

## Security Considerations

### Arbitrary SQL execution without read/write boundary

- **Risk:** The application intentionally runs arbitrary user SQL against in-memory SQLite databases. However, SQLite permits file-system operations via `ATTACH DATABASE`, `load_extension`, and `PRAGMA` statements. A user could potentially read/write files on the server's filesystem.
- **Files:** `sqlive-backend/src/main/java/com/douzi/sqlive/service/SqlExecutionService.java:53-55`
- **Current mitigation:** The database uses `mode=memory` which restricts file operations compared to file-based databases. SQLite JDBC disables `load_extension` by default. `DatabasePoolManager` validates `dbName` with strict regex `^[a-zA-Z0-9_-]{1,64}$`.
- **Recommendations:**
  - Explicitly disable `ATTACH DATABASE`: run `PRAGMA trusted_schema = OFF` after creating each connection.
  - Restrict `PRAGMA` statements via SQLite authorizer callback.
  - Set SQLite security flags: `PRAGMA cell_size_check = ON`.

### CORS allows all localhost origins

- **Risk:** `WebConfig` allows `http://localhost:*`, `http://127.0.0.1:*`, and `http://[::1]:*` origins, including arbitrary ports. A malicious local application can make API calls as the logged-in user.
- **Files:** `sqlive-backend/src/main/java/com/douzi/sqlive/config/WebConfig.java:17`
- **Current mitigation:** `allowCredentials(false)` prevents cookies from being sent cross-origin. No authentication exists on the endpoints.
- **Recommendations:** Pin allowed origins to the specific port used by the Vite dev server (e.g., `http://localhost:5173`) once the dev port is stable.

### Rate limit window array mutation race on concurrent `remove(key, window)`

- **Risk:** In `RateLimitFilter.doFilter()` (line 75), when a window expires, the code does `counters.remove(key, window)` and then mutates the window's fields. If another thread obtained the same window reference before removal, both threads could be writing to the same array simultaneously. The `synchronized (window)` block prevents data races on the array contents, but the `remove` creates a brief window where a new entry could replace the old one before the original thread finishes resetting.
- **Files:** `sqlive-backend/src/main/java/com/douzi/sqlive/config/RateLimitFilter.java:71-87`
- **Current mitigation:** The window array is mutated inside `synchronized (window)`. The `ConcurrentHashMap.remove(key, window)` uses identity comparison, so only the exact array reference is removed.
- **Recommendations:** Compute the initial window values outside the map: `counters.compute(key, (k, v) -> ...)` for atomic reset semantics instead of remove+mutate.

## Performance Bottlenecks

### MetadataExtractor queries `sqlite_master` 5 times per execution

- **Problem:** Each SQL execution calls five separate queries to `sqlite_master`:
  1. `extractAllTables()` -> `querySqliteMaster()` (full scan)
  2. `extractIndexes()` -> `querySqliteMaster()` (full scan, again)
  3. `extractViews()` -> `SELECT ... WHERE type='view'` (independent query)
  4. `extractTriggers()` -> `SELECT ... WHERE type='trigger'` (independent query)
  5. `extractForeignKeys()` -> `querySqliteMaster()` (full scan, third time)
- **Files:** `sqlive-backend/src/main/java/com/douzi/sqlive/service/metadata/MetadataExtractor.java:53-74`
- **Cause:** Each public method independently queries `sqlite_master` and builds its own result set. The `SqliteMaster` record is scoped per method call, not shared across the execution cycle.
- **Improvement path:** Cache the `SqliteMaster` query result at the `SqlExecutionService` level and pass it to all extraction methods.

### Full script re-execution on every cell edit (architectural)

- **Problem:** See Tech Debt section. Re-executing the entire SQL script for a single cell edit is O(n) per keystroke. For scripts with hundreds of statements, this adds measurable latency to every inline edit.
- **Files:**
  - `sqlive-frontend/src/composables/useBidirectionalSync.ts:91-107`
  - `sqlive-backend/src/main/java/com/douzi/sqlive/service/SqlExecutionService.java:50-74`
- **Improvement path:** Implement incremental UPDATE execution for simple cell edits, falling back to full re-execution only when needed.

### Rate limit filter uses synchronized per-key windows

- **Problem:** The `synchronized (window)` block in `RateLimitFilter.doFilter()` synchronizes on the mutable `long[]` array object. While correct, it serializes requests for the same `clientIp:path` pair, creating a bottleneck under concurrent access from the same client.
- **Files:** `sqlive-backend/src/main/java/com/douzi/sqlive/config/RateLimitFilter.java:73`
- **Improvement path:** Replace with `ConcurrentHashMap.compute()` with an atomic window reset approach for higher throughput.

### SSE event buffer grows unboundedly for long responses

- **Problem:** The `readSseStream()` function in `sse.ts` buffers the entire decoded SSE body chunk in `buffer` before parsing. For long AI streaming responses, the buffer can grow significantly, especially if lines arrive in large chunks before line endings are encountered. The buffer only shrinks as EOLs are found.
- **Files:** `sqlive-frontend/src/utils/sse.ts:15`
- **Cause:** The decoder uses `{ stream: true }` but accumulated partial data at the end of a chunk remains in the buffer until the next chunk arrives.
- **Improvement path:** Acceptable for typical AI responses (<1MB). Document the memory assumption or add a safety cap on buffer size that triggers an error/abort.

## Fragile Areas

### Bidirectional sync inline editing (useBidirectionalSync)

- **Files:** `sqlive-frontend/src/composables/useBidirectionalSync.ts`
- **Why fragile:** The inline cell edit system is highly sensitive to SQL formatting. It finds tuples by string matching (`INSERT INTO tablename`), parses VALUES tuples with custom depth tracking, and replaces them with string substitution (`code.value.substring(...)`). Any formatting variation (whitespace, line breaks, quoted identifiers, subqueries in VALUES) can break the match. While `canonicalStatements` from the backend now provide reliable statement boundaries (line 24-32), the tuple finding within a statement still relies on the frontend's own regex and depth tracking.
- **Safe modification:** Always add new test cases to `sqlStatements.test.ts` for any SQL formatting variant. Verify both tuple finding and replacement logic.
- **Test coverage:** `sqlive-frontend/src/__tests__/sqlStatements.test.ts` (large) covers many edge cases. `useBidirectionalSync` has no dedicated test file.

### SqlParser.parseStatementsPrecise()

- **Files:** `sqlive-backend/src/main/java/com/douzi/sqlive/service/sql/SqlParser.java`
- **Why fragile:** The parser is a hand-written state machine tracking quote state, `BEGIN`/`END` depth, `CASE`/`END` depth, line comments, and block comments. Adding support for new SQL constructs (e.g., `CREATE TRIGGER ... BEGIN ... END`, nested `CASE` expressions, `DO $$ ... $$` blocks) can break statement boundary detection. As noted in CLAUDE.md: "New `END` constructs may break statement boundaries."
- **Safe modification:** Add tests in `SqlParserTest.java` for each new SQL construct. Test both statement splitting and error line location.
- **Test coverage:** `SqlParserTest.java` (135 lines) covers basic parsing but lacks tests for nested `BEGIN`/`END` in triggers, dollar-quoting, `CASE` inside `CASE`, and error recovery.

### AiProvider protocol implementations

- **Files:**
  - `sqlive-backend/src/main/java/com/douzi/sqlive/service/ai/OpenAiProtocol.java`
  - `sqlive-backend/src/main/java/com/douzi/sqlive/service/ai/OllamaProtocol.java`
  - `sqlive-backend/src/main/java/com/douzi/sqlive/service/ai/LmStudioProtocol.java`
  - `sqlive-backend/src/main/java/com/douzi/sqlive/service/ai/DeepSeekProtocol.java`
- **Why fragile:** Each protocol implements `buildRequest`, `extractContent`, `parseChunk`, and `processStream` independently. The LM Studio implementation includes a stateful `LmStudioSseLineAdapter` inner class that tracks `lastEvent` across lines (line 145). While created fresh per `processStream` call, the statefulness is a trap for future refactors. All three protocols (`OpenAiProtocol`, `OllamaProtocol`, `LmStudioProtocol`) catch `Exception` and return `Flux.empty()` in `parseChunk`, silently dropping parse errors.
- **Safe modification:** Never share `LmStudioSseLineAdapter` instances across streams. Treat `Flux.empty()` returns from `parseChunk` as potential error indicators that should be logged.
- **Test coverage:** `ProtocolTest.java` (298 lines) covers successful parsing paths but the invalid JSON tests (lines 117-121, 197-203) only verify empty return, not logged warnings.

### Third-party AI provider endpoint URLs hardcoded in `OpenAiCompatibleProvider.create()`

- **Files:** `sqlive-backend/src/main/java/com/douzi/sqlive/service/ai/OpenAiCompatibleProvider.java:57-71`
- **Why fragile:** The endpoint path suffixes are hardcoded per provider name in a switch statement (lines 59-69). If a user configures a custom provider name not matching `deepseek`, `ollama`, or `lmstudio`, it defaults to `/chat/completions` regardless of the actual API shape. There is no way to configure endpoint suffixes in `AiProviderConfig`.
- **Safe modification:** Add `endpoint-suffix` to `AiProviderConfig` to make it configurable.

## Scaling Limits

### In-memory SQLite databases per tab/user

- **Current capacity:** Each tab/user gets a dedicated in-memory SQLite database. The pool is capped at 20 databases with LRU eviction (access-ordered `LinkedHashMap`) and idle timeout eviction (20 minutes, checked every 5 minutes).
- **Limit:** Each database consumes server memory proportional to its data size. The 20-database cap is a hard limit -- attempting to create a 21st active database (when none are idle) throws `IllegalStateException`.
- **Scaling path:** Increase `MAX_DATABASES` or make it configurable. Consider switching to file-based temp databases when memory pressure is high.

### SSE streaming for AI chat

- **Current capacity:** Single-threaded SSE stream per AI chat request. Each stream holds one connection to the AI provider and one Tomcat request thread.
- **Limit:** Number of concurrent AI streams = number of available Tomcat threads (default 200) * WebClient thread pool. The `complete()` method (non-streaming) calls `.block()` on a Mono, occupying a thread for the entire AI response duration.
- **Scaling path:** Make AI streaming fully non-blocking (remove `block()` call in `complete`). Add request queuing for AI operations.

## Dependencies at Risk

### Spring Boot 4.0.6

- **Risk:** Spring Boot 4.0.x is a very early release of the Spring Boot 4 line. It may have stability issues or breaking changes compared to the well-established 3.x line.
- **Files:** `sqlive-backend/build.gradle`
- **Impact:** Potential compatibility issues with plugins, missing documentation, or undiagnosed framework bugs.
- **Migration plan:** Monitor Spring Boot 4.x maturity. Pin to a known-good version and test thoroughly before upgrading.

### Vite 8.x

- **Risk:** Vite 8.x is the absolute latest major version (typical latest stable is 6.x). The project may encounter plugin compatibility issues.
- **Files:** `sqlive-frontend/package.json`
- **Impact:** The `build` section uses `rollupOptions` with `manualChunks` function. CLAUDE.md notes that `rolldownOptions` doesn't accept `manualChunks` function, forcing keep of `rollupOptions`. This creates a maintenance burden when Vite eventually deprecates `rollupOptions`.
- **Migration plan:** Watch for Vite 8.x changelog regarding `rolldownOptions` API changes.

### TypeScript 6.0.3

- **Risk:** TypeScript 6.x is the latest major version. New language features or breaking changes in type checking may surface as the project grows.
- **Files:** `sqlive-frontend/package.json`
- **Impact:** Minimal -- TypeScript is backward-compatible. The `@vue/tsconfig` version `0.9.1` must be verified compatible with TS 6.x.

### Vitest 4.1.6

- **Risk:** Vitest 4.x is very new. API changes may affect test configuration or mocking behavior.
- **Files:** `sqlive-frontend/package.json`
- **Impact:** Already confirmed working (33 test files pass). Watch for minor version updates that may introduce changes.

### Playwright 1.60.0

- **Risk:** Playwright 1.60 is the latest. 8 E2E test specs exist (`sqlive-frontend/tests/e2e/specs/`). Browser automation updates may affect test stability.
- **Files:** `sqlive-frontend/package.json`
- **Impact:** E2E tests rely on specific selectors and timing. Playwright updates may require test maintenance.

## Test Coverage Gaps

### Frontend: useBidirectionalSync not unit-tested directly

- **What's not tested:** The `useBidirectionalSync` composable (inline edit reconciliation, row update/delete/insert) has no dedicated test file. It is tested indirectly through `useSqlEngine.test.ts`.
- **Files:** `sqlive-frontend/src/composables/useBidirectionalSync.ts`
- **Risk:** The inline edit logic is one of the most complex and fragile parts of the system. Untested edge cases in tuple finding or string replacement will surface as user-facing bugs.
- **Priority:** High

### Frontend: useHighlight and useMonacoEditor not unit-tested

- **What's not tested:** The `useHighlight.ts` composable (SQL syntax-aware highlighting for tables/rows/columns) and `useMonacoEditor.ts` (Monaco editor lifecycle, decorations, context menu) have no test files.
- **Files:**
  - `sqlive-frontend/src/composables/useHighlight.ts`
  - `sqlive-frontend/src/composables/useMonacoEditor.ts`
- **Risk:** Monaco decorations API (changed in 0.55, now `createDecorationsCollection()`) is a known gotcha. The context menu integration for inline AI actions is untested.
- **Priority:** Medium

### Frontend: AiComposable streaming error recovery

- **What's not tested:** The `useAiChat.sendMessage` error handling (rejected promises from `useAiStreaming.streamCall`) and the `useAiStreaming` abort/cleanup paths.
- **Files:** `sqlive-frontend/src/__tests__/useAiChat.test.ts`
- **Risk:** A failed AI stream could leave the `isLoading` flag stuck at true, preventing further user input in the chat panel.
- **Priority:** Medium

### Frontend: Browser E2E tests missing critical paths

- **What's not tested:** E2E tests do not cover:
  - Bidirectional sync inline cell edits (table-editing.spec.ts exists but may not simulate cell edit -> re-execute flow).
  - AI streaming error recovery.
  - Knowledge graph topic navigation and progress tracking.
  - Monaco context menu AI actions (analyze-error, fix-code, explain, optimize).
  - Database lifecycle (create, reset, delete named databases).
- **Files:** `sqlive-frontend/tests/e2e/specs/`
- **Risk:** Critical user-facing workflows have no browser-level verification.
- **Priority:** Medium

### Backend: JaCoCo coverage threshold at 50%

- **What's not tested:** The JaCoCo minimum coverage is set to 50% (`build.gradle:69`), which means nearly half of the backend code could be untested. No per-class or per-package coverage requirements exist.
- **Files:** `sqlive-backend/build.gradle:65-73`
- **Risk:** Much of the service layer may lack thorough unit tests. The 50% threshold is too low to catch regressions.
- **Priority:** Medium

### Backend: MetadataExtractor not integration-tested with real SQLite

- **What's not tested:** `MetadataExtractorTest.java` exists but may not test the full extraction pipeline (tables + indexes + views + triggers + foreign keys) against a real in-memory SQLite database with actual FK constraints and triggers.
- **Files:** `sqlive-backend/src/test/java/com/douzi/sqlive/service/metadata/MetadataExtractorTest.java`
- **Risk:** The constraint extraction from CREATE TABLE SQL (line 206) and the topological sort table drop order (line 150) are not verified against real database output.
- **Priority:** Medium

---

*Concerns audit: 2026-05-30*
