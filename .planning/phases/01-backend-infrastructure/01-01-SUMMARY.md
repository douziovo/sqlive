---
phase: 01-backend-infrastructure
plan: 01
subsystem: backend-ai
tags: [ai-provider, timeout, security, logging, configuration]
requires: []
provides: [AI-01, AI-02, SEC-02]
affects: [OpenAiCompatibleProvider, AiService, AiProperties, application.yml]
tech-stack:
  added: []
  patterns:
    - "HttpClient with CONNECT_TIMEOUT_MILLIS, responseTimeout, WriteTimeoutHandler for WebClient"
    - "Atomic provider map swap via volatile + synchronized refreshProviders()"
    - "Regex-based Authorization header redaction in error logs"
key-files:
  created: []
  modified:
    - sqlive-backend/src/main/resources/application.yml
    - sqlive-backend/src/main/java/com/douzi/sqlive/config/AiProperties.java
    - sqlive-backend/src/main/java/com/douzi/sqlive/service/ai/OpenAiCompatibleProvider.java
    - sqlive-backend/src/main/java/com/douzi/sqlive/service/ai/AiService.java
    - sqlive-backend/src/test/java/com/douzi/sqlive/service/ai/OpenAiCompatibleProviderTest.java
decisions:
  - "All providers use unified default timeout values: connect=5s, read=60s, write=30s (D-07)"
  - "Timeout configuration lives under ai.timeout in application.yml (D-08)"
  - "Sanitization applied in OpenAiCompatibleProvider catch blocks, not centrally (D-09)"
  - "volatile keyword retained + refreshProviders() method added for runtime atomic swap (D-12)"
  - "ReactorClientHttpConnector import uses org.springframework.http.client.reactive package (Spring 7 migration)"
metrics:
  duration: ~15 min
  completed_date: 2026-05-29
  tasks: 3
  commits: 3
  files_modified: 5
---

# Phase 1 Plan 1: AI Provider Timeout, Atomic Refresh, and Log Sanitization Summary

Three independent AI-layer fixes: configure WebClient timeouts to prevent thread exhaustion on unresponsive AI providers, implement atomic provider list refresh for runtime reconfiguration, and sanitize API keys from server error logs.

## Decisions Made

- **Unified timeout defaults (D-07):** All AI providers share connect=5s, read=60s, write=30s via `ai.timeout` config block. The `TimeoutConfig` inner class on `AiProperties` provides defaults that Spring Boot auto-binds from YAML.
- **ReactorClientHttpConnector package migration:** In Spring Boot 4.0.6 (Spring Framework 7.0.7), `ReactorClientHttpConnector` was moved from `org.springframework.web.reactive.function.client` to `org.springframework.http.client.reactive`. The import was corrected during implementation.
- **Atomic swap pattern (D-12):** `volatile` field + `synchronized refreshProviders()` method. The `synchronized` ensures mutual exclusion during rebuild, `volatile` guarantees visibility across threads after assignment.

## Deviations from Plan

None — plan executed exactly as written with one implementation correction:

### Corrected Import Location

**Found during:** Task 1
**Issue:** `ReactorClientHttpConnector` is not in `org.springframework.web.reactive.function.client` in Spring Framework 7.0.7 (Spring Boot 4.0.6). The class was moved to `org.springframework.http.client.reactive.ReactorClientHttpConnector`.
**Fix:** Updated the import statement to use the correct package.
**Commit:** e3ce72e
**Note:** This is a Spring 7 API change, not a plan error. The plan specified the Spring 5/6 package location. The fix was applied as an automatic correction (deviation Rule 1 — broken import blocked compilation).

## Auth Gates

None encountered.

## Known Stubs

None.

## Threat Flags

None — all new surface (WebClient HttpClient configuration) is within the trust boundary of the backend, no new endpoints or data paths introduced.

## Task Summary

### Task 1: AI provider WebClient timeout configuration (AI-01)

**Files modified:**
- `sqlive-backend/src/main/resources/application.yml` — Added `timeout:` block under `ai:` with `connect: 5s`, `read: 60s`, `write: 30s`
- `sqlive-backend/src/main/java/com/douzi/sqlive/config/AiProperties.java` — Added `TimeoutConfig` static inner class with three `Duration` fields with defaults, maps to `ai.timeout` YAML path
- `sqlive-backend/src/main/java/com/douzi/sqlive/service/ai/OpenAiCompatibleProvider.java` — Added `connectTimeout`, `readTimeout`, `writeTimeout` fields; updated constructor chain (package-private, public, factory) to accept Duration params; modified `buildWebClient()` to create `HttpClient` with `CONNECT_TIMEOUT_MILLIS=5000`, `responseTimeout=60s`, `WriteTimeoutHandler(30s)`
- `sqlive-backend/src/main/java/com/douzi/sqlive/service/ai/AiService.java` — Updated `init()` to pass `aiProperties.getTimeout().getConnect/Read/Write()` to `OpenAiCompatibleProvider.create()`
- `sqlive-backend/src/test/java/com/douzi/sqlive/service/ai/OpenAiCompatibleProviderTest.java` — Updated all 9 constructor calls (5 production + 4 package-private) with `Duration.ofSeconds(5)`, `Duration.ofSeconds(60)`, `Duration.ofSeconds(30)`

**Verification:** `./gradlew test --tests "OpenAiCompatibleProviderTest" --tests "AiServiceTest"` — PASSED

### Task 2: Atomic provider refresh (AI-02)

**Files modified:**
- `sqlive-backend/src/main/java/com/douzi/sqlive/service/ai/AiService.java` — Added `public synchronized void refreshProviders()` method that atomically rebuilds the `providers` map from current `aiProperties.getProviders()` configuration. Uses the same provider creation pattern as `init()`. The `volatile` keyword on the `providers` field is retained.

**Verification:** `./gradlew test --tests "AiServiceTest"` — PASSED

### Task 3: Authorization header log sanitization (SEC-02)

**Files modified:**
- `sqlive-backend/src/main/java/com/douzi/sqlive/service/ai/OpenAiCompatibleProvider.java` — Added `private static String sanitizeErrorMessage(String)` helper using regex `(?i)Authorization:\s*Bearer\s+\S+`. Modified `complete()` catch block to call sanitization before logging and exception creation. Raw exception `e` is NOT passed to `log.error()` — only sanitized string content reaches the log.

**Verification:** `./gradlew test --tests "OpenAiCompatibleProviderTest" --tests "AiServiceTest"` — PASSED

## Full Verification

`./gradlew :sqlive-backend:test` — BUILD SUCCESSFUL (all backend tests pass)

## Self-Check: PASSED

- [x] All 3 commits exist: e3ce72e, c308a3a, d30acb2
- [x] All modified files verified on disk
- [x] Full backend test suite passes
