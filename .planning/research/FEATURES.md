# Feature Research: SQL Playground Reliability & Correctness

**Domain:** Full-stack SQL playground (Monaco editor + SQLite in-memory + table visualization + AI chat)
**Researched:** 2026-05-29
**Confidence:** HIGH (all findings verified against current codebase state in CONCERNS.md + industry research)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in a production-quality SQL playground. Missing these = product feels unreliable.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Single source of truth for SQL parsing** | Two independent parsers (frontend + backend) produce inconsistent statement boundaries. Inline cell edits break on procedural SQL (`BEGIN...END`), nested `CASE` expressions, or any formatting variation between parsers. | HIGH | Backend `SqlParser.parseStatementsPrecise()` tracks quote state + `BEGIN`/`END`/`CASE` depth. Frontend `extractSqlStatements()` does not. Fix: expose canonical boundaries in API response instead of re-parsing on client. |
| **Deterministic session eviction** | Random `ConcurrentHashMap` eviction drops active user databases without warning. Users lose their work non-deterministically under concurrent access. | MEDIUM | Fix: `LinkedHashMap` access-order LRU, or last-access timestamp tracking. Need to avoid scan-contamination problem (a single batch query flush hot sessions). Caffeine W-TinyLFU provides best concurrency + scan resistance but adds a dependency. |
| **Connection-pool-safe PRAGMA foreign_keys** | `clearDatabase()` toggles `PRAGMA foreign_keys = OFF/ON` on a shared JdbcTemplate. Concurrent requests see FK temporarily disabled, allowing invalid data insertion. | MEDIUM | Fix: drop tables in FK dependency order rather than disabling FK checks. SQLite docs confirm PRAGMA foreign_keys is connection-scoped and NOT safe to toggle on active connections. |
| **Rate limit map bounded memory** | `RateLimitFilter` stores per-IP rate limit windows in a `ConcurrentHashMap` that grows unboundedly. Each unique `clientIp:path` creates a permanent entry. | LOW | Fix: add periodic cleanup of windows older than `WINDOW_MS` via `@Scheduled` task or replace with Caffeine/ExpiringMap with TTL. |
| **AI provider request timeouts** | `OpenAiCompatibleProvider` builds a `WebClient` with zero connect/read/write timeouts. An unresponsive upstream AI provider blocks the thread indefinitely, causing cascading thread pool exhaustion. | MEDIUM | Fix: configure `HttpClient` with `ChannelOption.CONNECT_TIMEOUT_MILLIS` (5s), `responseTimeout` (60s), and `ReadTimeoutHandler`/`WriteTimeoutHandler`. WebClient timeouts must be set at the reactor-netty `HttpClient` level, not on WebClient itself. |
| **Disallow ATTACH DATABASE / dangerous PRAGMA** | SQLite permits server filesystem reads/writes via `ATTACH DATABASE`. `load_extension` is disabled in SQLite JDBC by default, but other attack vectors remain. | HIGH | Fix: use `SQLITE_LIMIT_ATTACH(0)` to disable ATTACH entirely, enable `SQLITE_DBCONFIG_DEFENSIVE`, disable `SQLITE_DBCONFIG_TRUSTED_SCHEMA`. SQLite authorizer callback for fine-grained operation whitelisting. The `PRAGMA trusted_schema = OFF` prevents malicious views/triggers in attached databases (CVE-2025-48935 proof). |
| **Sanitize AI API keys from logs** | `OpenAiCompatibleProvider` logs full error details on failure. If upstream echoes the `Authorization` header, API keys leak to log files. | LOW | Fix: sanitize error messages before logging. Mask `Authorization` header values. Apply `toString()` filtering or structured logging with sensitive field redaction. |
| **Data truncation visible to user** | `enforceTypeConstraints` silently truncates VARCHAR values to column length. User enters "hello world" into `VARCHAR(5)` and gets "hello" with no feedback. | LOW | Fix: show inline validation warning or toast notification when truncation occurs. Users must never lose data silently. |
| **Ghost row input preserved on insert failure** | Ghost row inputs clear on submit even when backend rejects the insert (constraint violation, FK failure). User retypes everything. | LOW | Fix: keep ghost row state on failure, clear only on successful insert response. Add error message near the ghost row explaining why the insert failed. |

### Differentiators (Competitive Advantage)

Features that set sqlive apart from other SQL playgrounds. Most SQL playgrounds are either read-only query tools or skip these reliability concerns entirely.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Canonical statement boundary API** | Backend exposes parsed statement start/end positions in the API response, eliminating the frontend parser entirely. No other SQL playground publishes canonical boundaries from backend parsing. | HIGH | Requires API contract change: `SqlResponse` gains a `statements: [{startLine, startColumn, endLine, endColumn, sql}]` field. Frontend uses these positions instead of re-parsing. This eliminates the root cause of bidirectional sync bugs. |
| **LRU with frequency awareness for DB pool** | Replace random eviction with W-TinyLFU (Caffeine) or access-order LRU. Active sessions stay alive; cold sessions get evicted. Pure LRU suffers scan contamination -- Caffeine W-TinyLFU prevents batch queries from flushing hot sessions. | MEDIUM | Caffeine provides O(1) amortized eviction with TTL support, eviction listeners (for cleanup), and stats. Minimizes surprise evictions. Only concern: adding a new dependency (Caffeine). Fallback: `LinkedHashMap` access-order + synchronized if no dependency addition allowed. |
| **AI provider timeout with graceful degradation** | Timeouts prevent thread pool exhaustion. On timeout, surface a clear error to the user ("AI provider unreachable, try again or switch provider") and let them retry without losing their prompt. | MEDIUM | Need to distinguish timeout from other errors. Reactor Netty's `responseTimeout` throws `TimeoutException` -- catch it specifically and return a user-friendly message vs a raw 500. |
| **SQLite authorizer for read-only guarantee** | SQLite authorizer callback rejects ATTACH, DETACH, and dangerous PRAGMAs at the C API level, providing defense-in-depth beyond application-layer checks. | HIGH | `sqlite3_set_authorizer()` requires native SQLite JDBC access. Check whether `org.sqlite.SQLiteConnection` exposes the underlying `sqlite3` pointer. Alternative: intercept via `SQLiteConfig` or PRAGMA-based restrictions if authorizer is not accessible from JDBC. |
| **Structured AI error logging with secret masking** | Log structured errors with secrets masked, enabling debugging without security risk. | LOW | Use a `SanitizedLogUtil` that matches `(?i)(authorization|api-key|token):\s*\S+` and replaces with `[REDACTED]`. Apply in a single `logSanitizedError()` method called from all provider error paths. |
| **In-place error feedback for inline edits** | When truncation, constraint violation, or FK failure occurs, show the error inline next to the affected cell -- not as a generic toast or 500 page. This is D3/Adminer-level UX maturity. | MEDIUM | Requires error response to include cell/column context. Backend needs to propagate constraint violation details. Frontend maps errors to specific cells using column metadata. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems in the context of this tech debt cleanup.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Performance optimization (incremental UPDATE for cell edits)** | Cell edits re-execute full script, which is O(n). Incremental UPDATE would be faster. | Premature optimization. Current scale is not bottlenecked. Adding incremental path doubles the data flow complexity and creates a fallback path that is hard to test. | Keep full re-execution. Revisit if/when a single user's script exceeds 500 lines AND latency becomes noticeable. |
| **Full SQL query history / undo stack** | Users make mistakes and want to revert. | Session-level history requires maintaining a stack of previous SQL states. Each "undo" would need to restore the full database snapshot. This is a full versioning system, not a simple cache. | Fix the ghost row and truncation warning issues first. These cover the most common data-loss scenarios at much lower cost. |
| **Multi-DBMS support (PostgreSQL, MySQL, etc.)** | Users want to test against different database engines. | Each backend requires a separate JDBC driver, different SQL dialect parsing, different type system handling. This is a full product pivot, not a cleanup task. | Keep SQLite-only. The playground model (in-memory, ephemeral) maps naturally to SQLite's strengths. |
| **Real-time collaborative editing** | Multiple users editing the same SQL playground. | Requires architectural rewrite: shared session management, operational transforms, conflict resolution. Adds authentication/authorization requirements. | Not in scope for this milestone. Revisit if multi-user collaboration becomes a core requirement. |
| **Authentication / user accounts** | Protect sessions from other users. | Adds session management, login flow, password storage, OAuth integration. Currently runs on localhost only -- no authentication boundary exists. | Defer until deployment model is defined. CORS port restriction is a simpler near-term fix. |
| **Persistent database storage** | Users want to save their databases across sessions. | SQLite in-memory mode is ephemeral by design. Adding persistence requires file-based SQLite, which introduces cleanup concerns (disk space), file naming, and potential conflicts with security sandboxing. | Keep in-memory. If persistence becomes needed, implement explicit "export" / "import" as a file download/upload flow rather than server-side persistence. |

## Feature Dependencies

```
Canonical statement boundary API
    |-- requires --> Unified dbName validation regex (PRAGMA-01/VALID-01)
    |-- requires --> API contract change (SqlResponse gains statement boundaries)
    |-- enhances --> Bidirectional sync reliability (eliminates frontend parser drift)

LRU database eviction (EVICT-01)
    |-- requires --> Pool eviction fairness fix
    |-- enhances --> Deterministic session lifetime
    |-- conflicts --> Random ConcurrentHashMap eviction (current behavior, must remove)

AI provider timeout (AI-01)
    |-- requires --> WebClient HttpClient configuration
    |-- enhances --> AI error recovery (AI-02)
    |-- enhances --> volatile providers fix (AI-02)

ATTACH DATABASE disable (SEC-01)
    |-- requires --> SQLite authorizer callback or PRAGMA-based restriction
    |-- enhances --> All other security boundaries (SEC-02 etc.)

Inline edit UX (EDIT-01, GHOST-01)
    |-- requires --> Backend error response with cell context
    |-- enhances --> Table stakes reliability
```

### Dependency Notes

- **Canonical statement boundary API requires Unified validation regex:** The `dbName` field used in both `SqlRequest` DTO and `DatabasePoolManager` has mismatched regex patterns. Before changing the API response shape, align validation so that error handling is predictable.
- **AI provider timeout enhances volatile providers fix:** Adding timeouts first means the `volatile` cleanup (AI-02) can assume providers are effectively final -- or can safely implement atomic map swap without worrying about hanging threads being the primary failure mode.
- **LRU eviction vs. random eviction:** The current `ConcurrentHashMap` eviction must be replaced atomically. If switching to Caffeine, the entire pool manager changes. If using `LinkedHashMap`, need `synchronized` wrapping that degrades concurrency.

## MVP Definition (This Milestone)

### Launch With (Core Tech Debt Fixes)

Features that must ship for the product to be considered reliable:

- [ ] **Canonical statement boundary API (SQL-01)** — Eliminates the root cause of bidirectional sync corruption. This is the highest-risk, highest-reward fix.
- [ ] **LRU database eviction (EVICT-01)** — Stops random session data loss. Users must be able to trust that their active session won't disappear.
- [ ] **AI provider request timeouts (AI-01)** — Prevents cascading thread pool exhaustion from unresponsive AI providers. Without this, a single dead AI endpoint can take down the whole backend.
- [ ] **Disallow ATTACH DATABASE (SEC-01)** — Closes the server filesystem read/write attack vector. Untrusted SQL execution without this is a security incident waiting to happen.
- [ ] **Sanitize AI API keys from logs (SEC-02)** — Prevents credential leakage. Security baseline.
- [ ] **Rate limit map bounded memory (RATE-01)** — Prevents unbounded memory growth. Simple fix, high impact for production longevity.
- [ ] **Data truncation visible to user (EDIT-01)** — Stops silent data loss on inline edit.
- [ ] **Ghost row input preserved on insert failure (GHOST-01)** — Stops frustrating UX where user retypes the same data after a transient failure.

### Add After Core Fixes (v1.x)

- [ ] **Connection-pool-safe PRAGMA foreign_keys (FK-01)** — Race condition fix. Less visible to users but prevents subtle data integrity corruption. Should ship in the same milestone if time permits.
- [ ] **Inline error feedback for cell edits (EDIT-01 enhancement)** — Map backend constraint violations to specific cells. Higher UX polish.
- [ ] **SQLite authorizer for additional PRAGMA restrictions (SEC-01 enhancement)** — Defense-in-depth. Adds operational safety but the primary ATTACH blocking can be done via PRAGMA-level restrictions first.
- [ ] **Structured error logging (SEC-02 enhancement)** — Centralize all AI error logging through a sanitizing wrapper.

### Future Consideration (v2+)

- [ ] **Unified frontend parser removal via canonical boundaries** — The ultimate goal of SQL-01 is to delete `sqlStatements.ts` client-side parsing entirely. Only possible after the canonical boundary API is stable and all bidirectional sync paths use backend positions.
- [ ] **Performance optimization (incremental UPDATE)** — Not yet bottlenecked. Revisit when user scripts exceed 500 lines.
- [ ] **SQLite authorizer callback** — If PRAGMA-level restrictions prove insufficient, implement `sqlite3_set_authorizer()` for operation-level whitelisting. Requires verifying JDBC access to native handle.
- [ ] **Session-level undo** — Requires full database snapshot stack. Defer indefinitely.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Canonical statement boundary API (SQL-01) | HIGH (fixes data corruption) | HIGH (API contract + frontend migration) | P1 |
| LRU database eviction (EVICT-01) | HIGH (stops data loss) | MEDIUM | P1 |
| AI provider timeouts (AI-01) | HIGH (prevents backend hang) | MEDIUM | P1 |
| Disallow ATTACH DATABASE (SEC-01) | HIGH (security vulnerability) | MEDIUM | P1 |
| Rate limit map cleanup (RATE-01) | MEDIUM (memory leak prevention) | LOW | P1 |
| Data truncation warning (EDIT-01) | MEDIUM (prevents silent data loss) | LOW | P1 |
| Ghost row state preservation (GHOST-01) | MEDIUM (UX frustration) | LOW | P1 |
| Sanitize AI logs (SEC-02) | MEDIUM (credential leak) | LOW | P1 |
| PRAGMA foreign_keys safety (FK-01) | MEDIUM (data integrity) | MEDIUM | P2 |
| Inline error feedback enhancement | LOW (polish) | MEDIUM | P3 |
| SQLite authorizer callback | MEDIUM (defense-in-depth) | HIGH (unknown JDBC access) | P3 |
| Unified frontend parser removal | MEDIUM (maintenance debt) | HIGH (depends on SQL-01 stability) | P3 |

**Priority key:**
- P1: Must ship in this milestone (reliability/security blockers)
- P2: Should ship in this milestone if capacity allows
- P3: Future consideration

## Hobby Project vs. Reliable Tool: The Threshold

Based on the research across all six dimensions, here is the dividing line:

| Dimension | Hobby Project | Reliable Tool | sqlive Status |
|-----------|---------------|---------------|---------------|
| **SQL execution correctness** | One parser is "good enough" | Single canonical parser, or verified consistency between parsers | TWO independent parsers with known divergence -- BELOW threshold |
| **Session reliability** | Best-effort eviction | Deterministic LRU or better with measurable eviction policy | Random eviction -- BELOW threshold |
| **Rate limiting** | Basic filter exists | Bounded memory, periodic cleanup, no indefinite growth | Unbounded leak -- BELOW threshold |
| **Security** | "It's just a playground" | Defense-in-depth: ATTACH disabled, PRAGMAs restricted, secrets not logged | ATTACH is possible, API keys may leak -- BELOW threshold |
| **Inline editing UX** | Data truncation is the user's problem | Truncation warned, errors shown in context, failed inserts preserve input | Silent truncation + lost input -- BELOW threshold |
| **AI integration** | Best-effort streaming | Bounded timeouts, graceful degradation, no thread pool exhaustion | No timeouts, potential thread exhaustion -- BELOW threshold |

**Verdict:** sqlive currently exhibits hobby-project characteristics across ALL six dimensions. The tech debt milestone brings it to "reliable tool" baseline across all six.

## Sources

- **Codebase artifacts:** `.planning/codebase/CONCERNS.md` (all tech debt, bugs, and security concerns audited 2026-05-29)
- **SQLite security page (2025):** "Defense Against The Dark Arts" -- `sqlite3_limit(SQLITE_LIMIT_ATTACH, 0)`, DEFENSIVE mode, TRUSTED_SCHEMA, authorizer callbacks
- **CVE-2025-48935:** Deno `node:sqlite` ATTACH DATABASE permission bypass -- confirms real-world exploitability
- **Vercel AI SDK documentation:** Streaming, error handling, `responseTimeout` patterns
- **Reactor Netty Issue #3849:** ReadTimeoutHandler may not fire for slow endpoints; prefer `responseTimeout()` as primary mechanism
- **Halodoc engineering blog:** Caffeine W-TinyLFU vs LinkedHashMap LRU real-world comparison
- **Spring Boot WebClient customization docs:** http.client.`HttpClient` timeout configuration via `ChannelOption` and `doOnConnected`
- **Sequel ORM blog (Jeremy Evans):** PRAGMA foreign_keys thread safety with connection pools
- **SQLite User Forum:** "Dont try to cut corners by using shared cache" -- Gunter Hick (SQLite team)

---
*Feature research for: sqlive production-quality SQL playground reliability baseline*
*Researched: 2026-05-29*
