# Stack Research

**Domain:** SQL playground tech debt fixes
**Researched:** 2026-05-29
**Confidence:** HIGH

## Recommended Stack

### Core Technologies (Unchanged — Verified Current)

| Technology | Version | Purpose | Why Confirmed |
|------------|---------|---------|---------------|
| Java (Zulu JDK) | 21 | Backend runtime | LTS, pattern matching for instanceof, virtual threads (not used here but available), already locked |
| Spring Boot | 4.0.6 | REST framework, DI | Existing. Early 4.x but stable enough for current scope |
| Kotlin? | N/A | JVM language | **Not introducing.** The constraint says no new dependencies or tech. All debt fixes are Java-on-Java |
| Vue 3 | ^3.5.34 | Frontend SPA | Existing. Dominant Vue version |
| Vite | 8.0.13 | Frontend bundler | Existing. Keep `rollupOptions` for `manualChunks` (CLAUDE.md: `rolldownOptions` codeSplitting bug) |
| Tailwind CSS | 4.3.0 | Utility CSS | Existing |
| TypeScript | 6.0.3 | Frontend type safety | Existing |

### Critical Dependencies for Tech Debt Fixes

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `org.xerial:sqlite-jdbc` | 3.51.1.0 | SQLite driver | Existing. HIGH confidence — driver version known, no upgrade needed |
| `com.zaxxer:HikariCP` | (managed by SB 4.0.6) | Connection pooling | Existing. |
| `spring-boot-starter-webflux` | 4.0.6 (managed) | WebClient for AI SSE | Existing. Needed for `reactor.netty.http.client.HttpClient` timeout configuration |
| `io.netty:netty-handler` | (managed by SB 4.0.6) | ReadTimeoutHandler, WriteTimeoutHandler | Transitive through webflux. No explicit dependency needed |

### Supporting Libraries (No New Additions)

Constraints prohibit new dependencies. All fixes use existing stack components:

| Library | Used For | Fix Area |
|---------|----------|----------|
| `ConcurrentHashMap` (JDK) | Rate limit counters, DB pool | LRU eviction, stale cleanup (no Caffeine/Guava — constraint) |
| `LinkedHashMap` (JDK) | Access-order tracking | LRU eviction in DatabasePoolManager |
| `ScheduledExecutorService` (JDK) | Periodic stale entry cleanup | Rate limit filter cleanup |
| `ReentrantLock` (JDK) | Eviction mutual exclusion | DatabasePoolManager (already present) |
| `reactor.netty.http.client.HttpClient` | WebClient HTTP client | Timeout configuration |
| Logback (`ch.qos.logback.classic.pattern.MessageConverter`) | Log pattern customization | Sanitization of Authorization headers |
| `java.util.concurrent.atomic.AtomicLong` | Timestamp tracking | LRU eviction access timestamps |

## Stack Decisions for Each Tech Debt Area

### 1. SQL Parsing Unification (SQL-01)

**Decision:** Expose canonical statement positions from backend to frontend via the API response.

**How:**
- Add `startOffset` and `endOffset` fields to `SqlParser.SqlStatement` record
- Include in `SqlResponse` API response payload (or a new `StatementBoundary[]`)
- These are byte offsets into the original script string
- Frontend `extractSqlStatements()` is replaced with backend-provided positions

**Key detail:** The `SqlParser.SqlStatement` record currently carries `startLine` only. Convert to carry both:
```java
public record SqlStatement(String sql, int startLine, int absoluteStart, int absoluteEnd) {}
```
- `absoluteStart` and `absoluteEnd` are character offsets in the original script
- Frontend reads these positions from `SqlResponse` instead of re-parsing

**Why this approach:** Eliminates dual parser divergence at its root. The frontend parser (`extractSqlStatements()`) does not handle `BEGIN`/`END` or `CASE`/`END` depth tracking, creating a correctness gap for inline editing of procedural SQL. Backend already has the correct state machine.

**Confidence:** HIGH. This is consistent with the project's architecture (backend-authoritative SQL execution). No alternative pattern found for "unified dual SQL parsers" — this is the standard approach (canonical-backend-exposes-boundaries).

**Alternatives considered:**
- Shared parser library (Java/TypeScript dual compile) — violates "no new dependencies" constraint
- GRAKN.AI SQL parser — would be a separate JAR, same problem
- WASM backend parser on frontend — overengineered for this use case

---

### 2. LRU Eviction for DatabasePoolManager (EVICT-01)

**Decision:** Add `ConcurrentHashMap<String, AtomicLong> accessTimestamps` to track last-access epoch millis alongside the existing `ConcurrentHashMap<String, JdbcTemplate>`. During eviction (under the existing `evictionLock`), scan all entries and evict the one with the oldest timestamp.

**Why this approach:**
- Pool is capped at `MAX_DATABASES=20` — scanning 20 entries is O(20) which is effectively O(1)
- `ConcurrentHashMap.get()` acquires no lock for reads. The `accessTimestamps` map is updated on every `getOrCreateJdbcTemplate` call. `AtomicLong` ensures visibility without `synchronized`.
- Does not require adding `Caffeine` or `Guava` (constraint: no new dependencies)
- Does not change the existing locking structure
- On `getOrCreateJdbcTemplate`: after getting/creating the `JdbcTemplate`, update `accessTimestamps.compute(dbName, (k, v) -> { v.set(now); return v; })` or `put(dbName, new AtomicLong(now))`

**Implementation sketch:**
```java
private final Map<String, JdbcTemplate> jdbcTemplates = new ConcurrentHashMap<>();
private final Map<String, AtomicLong> accessTimestamps = new ConcurrentHashMap<>();

public JdbcTemplate getOrCreateJdbcTemplate(String dbName) {
    // ... validation ...
    JdbcTemplate existing = jdbcTemplates.get(dbName);
    if (existing != null) {
        accessTimestamps.get(dbName).set(System.currentTimeMillis()); // track access
        return existing;
    }
    evictionLock.lock();
    try {
        existing = jdbcTemplates.get(dbName); // double-check
        if (existing != null) {
            accessTimestamps.get(dbName).set(System.currentTimeMillis());
            return existing;
        }
        if (jdbcTemplates.size() >= MAX_DATABASES) {
            String oldestKey = accessTimestamps.entrySet().stream()
                .min(Map.Entry.comparingByValue(Comparator.comparingLong(AtomicLong::get)))
                .map(Map.Entry::getKey)
                .orElseThrow();
            JdbcTemplate removed = jdbcTemplates.remove(oldestKey);
            accessTimestamps.remove(oldestKey);
            closeDataSource(removed);
        }
        JdbcTemplate jt = createJdbcTemplate(dbName);
        jdbcTemplates.put(dbName, jt);
        accessTimestamps.put(dbName, new AtomicLong(System.currentTimeMillis()));
        return jt;
    } finally {
        evictionLock.unlock();
    }
}
```

**Alternative considered:** Replace `ConcurrentHashMap` with `Collections.synchronizedMap(new LinkedHashMap<>(16, 0.75f, true))`. This would add locking to every read (since LinkedHashMap access-order modifies internal list on `get()`). For pool max=20, this is fine, but it changes the existing lock-free read path. The `AtomicLong` approach preserves the reads-without-lock behavior.

**Confidence:** HIGH.

---

### 3. Rate Limit Stale Entry Cleanup (RATE-01)

**Decision:** Add a `ScheduledExecutorService` with a single daemon thread to the `RateLimitFilter`. Schedule `scheduleAtFixedRate` at 60-second intervals. Cleanup iterates both `aiCounters` and `sqlCounters` maps and removes entries where `now - window[0] > WINDOW_MS`.

**Key considerations:**
- The cleanup must not interfere with concurrent requests. Use `ConcurrentHashMap`'s `entrySet().removeIf(predicate)` which is thread-safe (per-entry atomic removal).
- Use `Executors.newSingleThreadScheduledExecutor(runnable -> { Thread t = new Thread(runnable, "rate-limit-cleanup"); t.setDaemon(true); return t; })` so cleanup thread doesn't prevent JVM shutdown.
- Mark the executor as `volatile` or manage lifecycle via `Filter.init()` / `Filter.destroy()` (since `RateLimitFilter` is a `Filter`, not a Spring bean — it may need `@PostConstruct`/`@PreDestroy` support via Spring registration instead of `web.xml`).

**Confidence:** HIGH.

---

### 4. WebClient Timeouts for OpenAiCompatibleProvider (AI-01)

**Decision:** Configure `HttpClient` with explicit timeouts in `OpenAiCompatibleProvider.buildWebClient()`:

```java
private static WebClient buildWebClient(AiProviderConfig config) {
    HttpClient httpClient = HttpClient.create()
        .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 5000)    // TCP connect: 5s
        .responseTimeout(Duration.ofSeconds(30))                // Full response: 30s
        .doOnConnected(conn -> conn
            .addHandlerLast(new ReadTimeoutHandler(60, TimeUnit.SECONDS))  // idle between chunks: 60s
            .addHandlerLast(new WriteTimeoutHandler(30, TimeUnit.SECONDS)) // send request body: 30s
        );

    var builder = WebClient.builder()
        .baseUrl(config.getBaseUrl())
        .clientConnector(new ReactorClientHttpConnector(httpClient))
        .defaultHeader("Content-Type", "application/json");

    if (config.hasApiKey()) {
        builder.defaultHeader("Authorization", "Bearer " + config.getApiKey());
    }
    return builder.build();
}
```

**Rationale for values:**
| Timeout | Value | Why |
|---------|-------|-----|
| connectTimeout | 5s | AI providers are external; 5s is standard for remote API TCP handshake |
| responseTimeout | 30s | Hard upper bound for non-streaming `complete()` calls |
| readTimeout | 60s | AI streaming responses can have long gaps between tokens; 60s is generous but not indefinite |
| writeTimeout | 30s | Request body is small (system prompt + user message); 30s is very safe |

**Why these specific channels:** Per Baeldung (March 2025) and Spring Boot reference docs:
- `CONNECT_TIMEOUT_MILLIS` sets the TCP connect timeout (no default in Netty without this)
- `responseTimeout()` sets the total response timeout (no default — without it, requests can hang forever)
- `ReadTimeoutHandler` / `WriteTimeoutHandler` set idle-time timeouts (must be added via `doOnConnected()`)

**Important caveat:** `responseTimeout()` measures from request send to **first byte** of response, not to completion. For streaming, the `ReadTimeoutHandler` protects against mid-stream stalls. See [reactor-netty issue #3849](https://github.com/reactor/reactor-netty/issues/3849) — known issue where read timeout doesn't fire for trickle-slow endpoints.

**Already imported:** `io.netty.handler.timeout.ReadTimeoutHandler` and `WriteTimeoutHandler` are transitive dependencies through `spring-boot-starter-webflux`. No new dependency needed.

**Confidence:** HIGH.

---

### 5. SQLite Security PRAGMAs (SEC-01)

**Decision:** Apply three layers of security:

**Layer 1: SQL parsing layer — block ATTACH DATABASE**
- The existing `SqlParser` already parses all statements before execution. Add a check during execution (in `SqlExecutionService`) that scans statements for `ATTACH DATABASE` / `DETACH DATABASE` / `ATTACH` and rejects them.
- Simple regex/string match: `statement.sql().toUpperCase().trim().startsWith("ATTACH")` (plus after-semicolon check)
- This is the most reliable approach since sqlite-jdbc does **not** expose the C-level `sqlite3_set_authorizer` callback in its Java API (confirmed by searching the sqlite-jdbc sources jar — no Java wrapper for authorizer exists).

**Layer 2: PRAGMA trusted_schema = OFF**
- Execute `PRAGMA trusted_schema = OFF` immediately after creating each connection (in `createJdbcTemplate` or in `SqlExecutionService`'s first execution per session).
- This disables the ability for database schema to define dangerous operations that run on query.
- Default in JDBC is ON (unlike CLI which is OFF since SQLite 3.42). Explicitly turning it OFF is the security-hardened stance.

**Layer 3: Verify load_extension is disabled**
- sqlite-jdbc `enable_load_extension` defaults to `false` (confirmed by documentation). No action needed.
- Add an explicit `PRAGMA compile_options` query to verify it's not available, or verify it's disabled in the connection config.

**Implementation in `DatabasePoolManager.createJdbcTemplate()`:**
```java
private JdbcTemplate createJdbcTemplate(String name) {
    String url = "jdbc:sqlite:file:" + name + "?mode=memory";
    HikariConfig config = new HikariConfig();
    config.setJdbcUrl(url);
    config.setMaximumPoolSize(1);
    config.setPoolName("SQLitePool-" + name);
    JdbcTemplate jt = new JdbcTemplate(new HikariDataSource(config));
    // Security: disable trusted_schema
    jt.execute("PRAGMA trusted_schema = OFF");
    return jt;
}
```

**And in `SqlExecutionService.execute()` — before executing user statements:**
```java
// Reject ATTACH/DETACH
for (SqlParser.SqlStatement s : statements) {
    String trimmed = s.sql().trim().toUpperCase();
    if (trimmed.startsWith("ATTACH") || trimmed.startsWith("DETACH")) {
        return SqlResponse.error("ATTACH DATABASE and DETACH DATABASE are not allowed", s.startLine());
    }
}
```

**Approach not taken:** Using `NativeDB` directly to call `sqlite3_set_authorizer` via JNI. The sqlite-jdbc library does not expose this in its Java API. Creating a custom JNI bridge would violate "no new dependencies" and is overengineering for the threat model (in-memory databases with no file system exposure).

**Confidence:** HIGH.

---

### 6. Log Sanitization (SEC-02)

**Decision:** Implement a custom Logback `MessageConverter` that masks `Authorization` header values in log messages.

**Implementation:**
```java
package com.douzi.sqlive.config.logging;

import ch.qos.logback.classic.pattern.MessageConverter;
import ch.qos.logback.classic.spi.ILoggingEvent;

import java.util.regex.Pattern;

public class AuthHeaderSanitizingConverter extends MessageConverter {

    private static final Pattern AUTHORIZATION_PATTERN =
        Pattern.compile("(?i)(Authorization:\\s*Bearer\\s+)([A-Za-z0-9._~+/=-]+)");
    private static final String REPLACEMENT = "$1***REDACTED***";

    @Override
    public String convert(ILoggingEvent event) {
        String message = event.getFormattedMessage();
        if (message == null) return null;
        return AUTHORIZATION_PATTERN.matcher(message).replaceAll(REPLACEMENT);
    }
}
```

**Register in `logback-spring.xml`:**
```xml
<configuration>
  <conversionRule conversionWord="sanitizedMsg"
                  converterClass="com.douzi.sqlive.config.logging.AuthHeaderSanitizingConverter" />
  <appender name="FILE" class="ch.qos.logback.core.rolling.RollingFileAppender">
    <encoder>
      <pattern>%d{yyyy-MM-dd HH:mm:ss.SSS} %-5level [%thread] %logger{36} - %sanitizedMsg%n</pattern>
    </encoder>
  </appender>
</configuration>
```

**Alternative (simpler, no new class):** Use `%replace` directly in the pattern:
```
%replace(%msg){'(?i)(Authorization:\\s*Bearer\\s+)[A-Za-z0-9._~+/=-]+', '$1***REDACTED***'}
```
But this is fragile — Logback's `%replace` regex supports limited patterns (`\s` may not work as expected). A `MessageConverter` is more robust and testable.

**Coverage:** Since the `logging.pattern.console` and `logging.pattern.file` in `application.yml` define the pattern, these need to be moved to `logback-spring.xml` to use the custom converter word.

**Why not:** `@Slf4j` aspect-based sanitization, Logstash encoder, or `PatternLayout` override. The `MessageConverter` approach is the simplest: no AOP, no XML manipulation of every layout, just a pattern word swap.

**Confidence:** HIGH.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| LRU eviction | `ConcurrentHashMap<String, AtomicLong>` timestamps + scan | Caffeine | Violates "no new dependencies" constraint |
| LRU eviction | Timestamp scan | `LinkedHashMap` with `accessOrder=true` + `synchronizedMap` | Changes the existing lock-free read path |
| Rate limit cleanup | `ScheduledExecutorService` + `removeIf` | Guava Cache with TTL | Violates "no new dependencies" constraint |
| Rate limit cleanup | Scheduled sweep | Per-entry scheduled removal | Creates unbounded scheduled tasks; memory leak risk |
| SQLite security | PRAGMA + parser filter + trusted_schema=OFF | `NativeDB` JNI authorizer callback | sqlite-jdbc does not expose this API; overengineering |
| Log sanitization | Custom `MessageConverter` | `%replace` in pattern | `%replace` regex is fragile in Logback; hard to test |
| Log sanitization | Custom `MessageConverter` | AspectJ @Around | Overengineering; `MessageConverter` is purpose-built |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `Caffeine` cache for LRU eviction | Constraint: no new dependencies. Pool size is 20 — scanning is fine | `ConcurrentHashMap` + `AtomicLong` timestamps |
| `Guava Cache` for rate limit cleanup | Constraint: no new dependencies | `ConcurrentHashMap.removeIf()` + `ScheduledExecutorService` |
| `ExpiringMap` | New dependency, not worth it for a single cleanup | Same as above |
| `Resilience4j` RateLimiter | New dependency; existing `synchronized` on per-key window is adequate after adding cleanup | Same as above |
| JNI `sqlite3_set_authorizer` | sqlite-jdbc exposes no Java wrapper; would need custom JNI | `PRAGMA trusted_schema=OFF` + parser-level ATTACH blocking |
| `%replace` in Logback pattern | Regex is fragile in Logback; `\s` and non-greedy matches behave unpredictably | Custom `MessageConverter` with `java.util.regex.Pattern` |
| `PatternLayout` override (Logback) | More complex than needed; `MessageConverter` is the standard simple approach | Custom `MessageConverter` |

## Stack Patterns by Variant

**If a future phase lifts the "no new dependencies" constraint:**
- Replace LRU eviction with **Caffeine** (`com.github.ben-manes.caffeine:caffeine`) — it provides true concurrent W-TinyLFU eviction, far better than timestamp scanning
- Replace rate limit cleanup with **Caffeine**'s built-in `expireAfterWrite()` — zero code cleanup
- Consider **Bucket4j** for production-grade rate limiting (token bucket, sliding window, with cleanup built-in)

**If the AI provider pool grows beyond 10+ concurrent providers:**
- Move `WebClient` creation to a shared `WebClientConfig` bean with the timeout configuration
- Add a `ConnectionProvider` with pool limits (`maxConnections=50`, `pendingAcquireTimeout=5s`)
- This prevents connection exhaustion under concurrent AI requests

**If deployment requires log aggregation (ELK, Datadog, etc.):**
- Replace custom `MessageConverter` with JSON structured logging
- Use `logstash-logback-encoder` for structured JSON logs with field-level sanitization
- Move logging pattern configuration out of `application.yml` entirely

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `spring-boot-starter-webflux` 4.0.6 | `reactor-netty-http` 1.x (managed) | Transitive. `ReadTimeoutHandler` and `WriteTimeoutHandler` from `io.netty:netty-handler` are also transitive dependencies |
| `io.netty:netty-handler` (managed) | JDK 21 | Netty 4.x fully supports JDK 21 |
| `org.xerial:sqlite-jdbc` 3.51.1.0 | SQLite 3.51.1.0 | `PRAGMA trusted_schema` is supported since SQLite 3.42.0, very well available in 3.51.1.0 |
| `ch.qos.logback:logback-classic` (managed by SB 4.0.6) | JDK 21 | Logback 1.5.x supports JDK 21 |

## Sources

- [Spring Boot WebClient Timeouts — Baeldung (March 2025)](https://www.baeldung.com/spring-webflux-timeout) — HIGH confidence. Verified timeout API for HttpClient, ConnectionProvider, and per-request configurations.
- [Spring Boot Reference — WebClient customization](https://runebook.dev/en/docs/spring_boot/howto/howto.http-clients.webclient-reactor-netty-customization) — HIGH confidence. Official Spring Boot guide for Reactor Netty WebClient configuration.
- [reactor-netty issue #3849 — Read timeout not firing](https://github.com/reactor/reactor-netty/issues/3849) — MEDIUM confidence. Known bug: read timeout measures to first byte, not completion. Use `responseTimeout()` as safety net.
- [SQLite user forum — TRUSTED_SCHEMA in JDBC](https://sqlite.org/forum/forumpost/637e99e5d466ca97?raw) — HIGH confidence. Confirms JDBC enables `trusted_schema` by default and recommends disabling it.
- [SQLite user forum — Multi-tenant isolation](https://sqlite.org/forum/forumpost/ce622bdcb6f20259?t=c&unf) — HIGH confidence. Adam Marcus (ayb author) describes `SQLITE_DBCONFIG_DEFENSIVE` and `SQLITE_LIMIT_ATTACHED=0` patterns.
- [SQLite security guide (Chinese)](https://sqlite.ac.cn/security.html) — MEDIUM confidence. Comprehensive security recommendations for SQLite including `PRAGMA trusted_schema=OFF`.
- [Logback masking sensitive data guide](https://ankurm.com/masking-sensitive-data-in-logback/) — HIGH confidence. Clear documentation of `MessageConverter` approach with registration in `logback.xml`.
- [xerial/sqlite-jdbc source jar analysis](https://github.com/xerial/sqlite-jdbc) — HIGH confidence. Manual analysis of sources jar (v3.45.1.0 at `C:\Users\douzi/.gradle/caches/...`) confirmed no Java wrapper for `sqlite3_set_authorizer`.
- Java 21 JDK docs — `ConcurrentHashMap`, `LinkedHashMap`, `ScheduledExecutorService` — HIGH confidence. Standard JDK API.
- [SQLite docs — PRAGMA trusted_schema](https://sqlite.org/pragma.html#pragma_trusted_schema) — HIGH confidence. Official PRAGMA documentation.
- [SQLite docs — SQLITE_DBCONFIG_DEFENSIVE](https://www.sqlite.org/c3ref/c_dbconfig_defensive.html) — HIGH confidence. Official DBCONFIG documentation.

---
*Stack research for: SQL playground tech debt cleanup*
*Researched: 2026-05-29*
