<!-- refreshed: 2026-05-30 -->
# Architecture

**Analysis Date:** 2026-05-30

## System Overview

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (Vue 3 + Vite 8)                          │
│                                                                              │
│  ┌────────────────┐  ┌───────────────────┐  ┌──────────────────────────┐    │
│  │  CodeEditor    │  │  DataVisualizer   │  │  AI / Knowledge Panels    │    │
│  │  (Monaco)      │  │  (TableSection,   │  │  (AiChatPanel,            │    │
│  │  + Tab Bar     │  │   ResultTable,    │  │   KnowledgePanel,         │    │
│  │  + DB Selector │  │   ErDiagram,      │  │   LearningCompanion)      │    │
│  │                │  │   ChartView)      │  │                           │    │
│  └───────┬────────┘  └────────┬──────────┘  └─────────────┬─────────────┘    │
│          │                    │                            │                 │
│          └──────────┬─────────┘                            │                 │
│                     │                                      │                 │
│            ┌────────▼──────────┐                 ┌─────────▼─────────┐      │
│            │  Composables      │                 │  Composables       │      │
│            │  (useSqlEngine,   │                 │  (useAiChat,       │      │
│            │   useBidirectionalSync,             │   useAiStreaming,  │      │
│            │   useMultiTabs,   │                 │   useInlineActions)│      │
│            │   useHighlight,   │                 │                    │      │
│            │   useErDiagram   )│                 │                    │      │
│            └────────┬─────────┘                 └─────────┬──────────┘      │
│                     │                                      │                 │
└─────────────────────┼──────────────────────────────────────┼─────────────────┘
                      │                                      │
                      │  POST /api/execute                   │  POST /api/ai/*
                      │                                      │
┌─────────────────────┼──────────────────────────────────────┼─────────────────┐
│                     ▼                                      ▼                 │
│                     BACKEND (Spring Boot 4.0.6 + JDK 21)                     │
│                                                                              │
│  ┌────────────────┐  ┌──────────────────┐  ┌────────────────────────┐       │
│  │  SqlController │  │  AiController    │  │  KnowledgeController   │       │
│  │  HealthController                     │  │                        │       │
│  └───────┬────────┘  └────────┬─────────┘  └───────────┬────────────┘       │
│          │                    │                          │                   │
│          ▼                    ▼                          ▼                   │
│  ┌────────────────┐  ┌──────────────────┐  ┌──────────────────────┐        │
│  │SqlExecution    │  │  AiService       │  │  KnowledgeGraph      │        │
│  │Service         │  │  (Provider Chain)│  │  Service             │        │
│  └───────┬────────┘  └───────┬──────────┘  └──────────────────────┘        │
│          │                    │                                              │
│          ▼                    ▼                                              │
│  ┌────────────────┐  ┌──────────────────┐                                   │
│  │ SqlParser       │  │  AiProvider      │                                   │
│  │ Metadata        │  │  (Interface)     │                                   │
│  │ Extractor       │  ├──────────────────┤                                   │
│  │ DatabasePool    │  │  DeepSeekProtocol│                                   │
│  │ Manager         │  │  OllamaProtocol  │                                   │
│  └───────┬────────┘  │  LmStudioProtocol │                                   │
│          │           │  OpenAiProtocol   │                                   │
│          ▼           └──────────────────┘                                   │
│  ┌────────────────┐                                                         │
│  │ SQLite JDBC    │                                                         │
│  │ (HikariCP)     │                                                         │
│  └────────────────┘                                                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| `SqlController` | REST entry point for SQL execution, request validation, response logging | `sqlive-backend/.../controller/SqlController.java` |
| `AiController` | REST entry point for AI chat (SSE streaming), error analysis, fix, explain, optimize | `sqlive-backend/.../controller/AiController.java` |
| `KnowledgeController` | REST endpoint for knowledge graph topic data | `sqlive-backend/.../controller/KnowledgeController.java` |
| `HealthController` | Health check endpoint (`GET /health`) | `sqlive-backend/.../controller/HealthController.java` |
| `SqlExecutionService` | Core SQL execution: parse, execute per-statement, collect metadata, clear database on reset | `sqlive-backend/.../service/SqlExecutionService.java` |
| `AiService` | AI orchestration: prompt building via `PromptBuilder`, provider selection via `getProvider()`, response parsing; supports `refreshProviders()` at runtime | `sqlive-backend/.../service/ai/AiService.java` |
| `AiProvider` (interface) | Abstraction over AI model providers — `complete()` and `streamChat()` methods | `sqlive-backend/.../service/ai/AiProvider.java` |
| `OpenAiCompatibleProvider` | Generic OpenAI-compatible provider implementation using WebClient for HTTP calls | `sqlive-backend/.../service/ai/OpenAiCompatibleProvider.java` |
| `Protocol` (interface) | Request building + response parsing per provider | `sqlive-backend/.../service/ai/Protocol.java` |
| `PromptBuilder` | Builds system prompts per mode (chat, analyze-error, fix-code, explain, optimize) with SQL schema context | `sqlive-backend/.../service/ai/PromptBuilder.java` |
| `DatabasePoolManager` | Manages per-database `JdbcTemplate` instances; max 20, LRU eviction on idle >20min, idle cleanup scheduler, graceful `@PreDestroy` shutdown | `sqlive-backend/.../service/database/DatabasePoolManager.java` |
| `MetadataExtractor` | Extracts tables, indexes, views, triggers, foreign keys from `sqlite_master` + PRAGMA queries; must use `ResultSetExtractor` | `sqlive-backend/.../service/metadata/MetadataExtractor.java` |
| `SqlParser` | SQL statement boundary parser tracking quotes, string escapes, BEGIN/END depth, CASE/END depth, line/block comments | `sqlive-backend/.../service/sql/SqlParser.java` |
| `KnowledgeGraphService` | Loads and serves SQL knowledge topic graph from `knowledge-graph.json` | `sqlive-backend/.../service/knowledge/KnowledgeGraphService.java` |
| `GlobalExceptionHandler` | Global `@ControllerAdvice` — handles `@Valid` errors (400), `AiProviderException` (503), general errors (500) | `sqlive-backend/.../exception/GlobalExceptionHandler.java` |
| `WebConfig` | CORS config, `RateLimitFilter` registration, `ObjectMapper` bean | `sqlive-backend/.../config/WebConfig.java` |
| `RateLimitFilter` | Per-IP rate limiting for `/api/ai/*` and `/api/execute`; sliding window (60s), configurable via `rate.limit.ai` and `rate.limit.sql` system properties | `sqlive-backend/.../config/RateLimitFilter.java` |
| `AiProperties` | `@ConfigurationProperties` binding `ai.providers` from `application.yml` | `sqlive-backend/.../config/AiProperties.java` |
| `App.vue` | Root component: Splitpanes layout (CodeEditor + DataVisualizer), orchestrates engine/AI/knowledge, `provide`-based context injection | `sqlive-frontend/src/App.vue` |
| `CodeEditor.vue` | Monaco editor wrapper, tab bar, DB selector, context menu, import/export | `sqlive-frontend/src/components/CodeEditor.vue` |
| `DataVisualizer.vue` | Tabbed view: tables, ER diagram, indexes, views, triggers, query results | `sqlive-frontend/src/components/DataVisualizer.vue` |
| `TableSection.vue` | Individual table display with inline edit, sort, filter, pagination | `sqlive-frontend/src/components/TableSection.vue` |
| `ResultTable.vue` | Query result display with chart toggle | `sqlive-frontend/src/components/ResultTable.vue` |
| `ErDiagram.vue` | vue-flow based ER diagram with search bar and toolbar | `sqlive-frontend/src/components/er/ErDiagram.vue` |
| `ChartView.vue` | ECharts visualization for query results | `sqlive-frontend/src/components/chart/ChartView.vue` |
| `AiChatPanel.vue` | Floating AI chat panel with SSE streaming, message actions (edit, delete, regenerate) | `sqlive-frontend/src/components/AiChatPanel.vue` |
| `KnowledgePanel.vue` | Knowledge graph panel with vue-flow and topic filtering | `sqlive-frontend/src/components/knowledge/KnowledgePanel.vue` |
| `useSqlEngine` | Central state machine: SQL execution via debounced `POST /api/execute`, rollback on error, reactive `db` model, multi-tab integration | `sqlive-frontend/src/composables/useSqlEngine.ts` |
| `useBidirectionalSync` | Reverse-engineers cell edits to SQL VALUES tuple replacement; supports update/delete/insert/create table/drop table | `sqlive-frontend/src/composables/useBidirectionalSync.ts` |
| `useMultiTabs` | Multi-tab code management (add, close, rename, import, export, track dirty state) | `sqlive-frontend/src/composables/useMultiTabs.ts` |
| `useHighlight` | Syntax-aware highlighting: maps SQL statements to active tables/rows/columns | `sqlive-frontend/src/composables/useHighlight.ts` |
| `useErDiagram` | Builds vue-flow nodes/edges from `db.tables` + `db.foreignKeys` | `sqlive-frontend/src/composables/useErDiagram.ts` |
| `useDagreLayout` | Dagre auto-layout wrapper for graph nodes | `sqlive-frontend/src/composables/useDagreLayout.ts` |
| `useAiChat` | AI chat state: SSE streaming messages, auto-error-analysis, panel control, message management (edit/delete/regenerate) | `sqlive-frontend/src/composables/useAiChat.ts` |
| `useAiStreaming` | Low-level SSE stream reader via `fetch`; abort support via `AbortController` | `sqlive-frontend/src/composables/useAiStreaming.ts` |
| `useInlineActions` | Inline AI actions: analyze-error, fix-code, explain, optimize, generate-sql | `sqlive-frontend/src/composables/useInlineActions.ts` |
| `useKnowledgeGraph` | Knowledge graph state: topic data, progress tracking, node/edge generation | `sqlive-frontend/src/composables/useKnowledgeGraph.ts` |
| `useDatabaseLifecycle` | Named database lifecycle: submit (force reset), reset, delete | `sqlive-frontend/src/composables/useDatabaseLifecycle.ts` |
| `useTablePipeline` | Table data pipeline: sorting by column, filtering, pagination | `sqlive-frontend/src/composables/useTablePipeline.ts` |
| `useSortFilter` | Generic composable for sort/filter/paginate with debounced filter | `sqlive-frontend/src/composables/useSortFilter.ts` |
| `useMonacoEditor` | Monaco editor creation, code sync, highlight decoration via `createDecorationsCollection()`, error markers, context menu | `sqlive-frontend/src/composables/useMonacoEditor.ts` |
| `useInlineEdit` | Inline cell edit in tables with type constraint enforcement | `sqlive-frontend/src/composables/useInlineEdit.ts` |
| `useFilteredList` | Generic list filter composable | `sqlive-frontend/src/composables/useFilteredList.ts` |

## Pattern Overview

**Overall:** Composition-based layered architecture with reactive state management.

**Key Characteristics:**
- **Frontend:** Vue 3 Composition API, `provide`/`inject` for shared context (`SQL_CONTEXT_KEY`, `AI_ACTIONS_KEY`), no external state management library.
- **Backend:** Classic Spring Boot layered architecture: `@RestController` -> `@Service` -> DTO POJOs.
- **SQL Execution:** Full-script re-execution model — every change re-runs the entire SQL script from scratch. No incremental diffing or state tracking.
- **Bidirectional sync:** Cell edits are reverse-engineered back to SQL VALUES tuple replacements in the editor code.
- **AI provider chain:** Double-abstraction strategy pattern: `AiProvider` (HTTP comms) + `Protocol` (request/response format per provider). Supports DeepSeek, Ollama, LM Studio, OpenAI-compatible.
- **Graph visualization:** Two vue-flow instances (ER diagram + knowledge graph) share `useDagreLayout` for dagre-based auto-layout.
- **State machine:** `useSqlEngine` uses a three-state mode (`user` -> `reconciling` -> `rollback`) enforced by `ALLOWED_TRANSITIONS` matrix and `transition()` guard.

## Layers

**Frontend - View Layer:**
- Purpose: Component rendering and user interaction
- Location: `sqlive-frontend/src/components/`
- Contains: Vue 3 SFCs with `<script setup lang="ts">`
- Depends on: Composables for state, utils for pure functions, model types
- Used by: `App.vue` (root orchestrator)

**Frontend - Composable Layer:**
- Purpose: Stateful logic, API calls, reactive state management
- Location: `sqlive-frontend/src/composables/`
- Contains: 16 composable functions managing reactive refs, fetch calls, derived computations, and provide/inject context
- Depends on: `src/utils/`, `src/model/`, `src/config.ts`
- Used by: Components (via `provide`/`inject` and direct imports)

**Frontend - Utils / Model Layer:**
- Purpose: Pure functions, type definitions, configuration
- Location: `sqlive-frontend/src/utils/`, `sqlive-frontend/src/model/`, `sqlive-frontend/src/config.ts`
- Contains: SQL parsers, tuple extractors, SSE reader, API types, injection keys
- Depends on: Nothing (pure functions, no external state)
- Used by: Composables and Components

**Backend - Controller Layer:**
- Purpose: REST API endpoints, request validation (`@Valid`), response formatting
- Location: `sqlive-backend/.../controller/`
- Contains: `@RestController` classes with `@RequestMapping`, `@PostMapping`, `@GetMapping`
- Depends on: Service layer, DTO layer
- Used by: HTTP clients (frontend browser)

**Backend - Service Layer:**
- Purpose: Business logic, orchestration, state management
- Location: `sqlive-backend/.../service/` (sub-packages: `ai/`, `database/`, `knowledge/`, `metadata/`, `sql/`)
- Contains: `@Service` / `@Component` classes with constructor injection
- Depends on: DTO layer, other services, JDBC infrastructure
- Used by: Controllers

**Backend - DTO Layer:**
- Purpose: Request/response data transfer objects
- Location: `sqlive-backend/.../dto/` (top-level) + `dto/ai/` (AI-specific)
- Contains: Simple Lombok `@Data` POJOs with Jakarta validation annotations
- Depends on: Nothing
- Used by: Controllers and Services

**Backend - Config Layer:**
- Purpose: Framework configuration, cross-cutting concerns
- Location: `sqlive-backend/.../config/`
- Contains: CORS setup, rate-limit filter, `@ConfigurationProperties` binding, ObjectMapper
- Depends on: Framework infrastructure (Jakarta Servlet, Spring Web MVC)

## Data Flow

### Primary Request Path: SQL Execution

1. User types or edits SQL in Monaco editor (`CodeEditor.vue`)
2. `useSqlEngine.watch(code)` triggers debounced execution (`useSqlEngine.ts:207-212`). Debounce is 100ms normally, 50ms for E2E mode.
3. Frontend sends `POST /api/execute` with `{ sql, dbName, reset }` payload (`useSqlEngine.ts:105-115`). Uses `AbortController` to cancel in-flight requests.
4. `SqlController.executeSql()` validates `@Valid SqlRequest`, delegates to `SqlExecutionService` (`SqlController.java:21-49`)
5. `SqlExecutionService.execute()`:
   - Gets or creates per-database `JdbcTemplate` via `DatabasePoolManager.getOrCreateJdbcTemplate()` (`SqlExecutionService.java:35`)
   - Optionally resets database: DROPs all views/triggers/tables in topological FK order (`SqlExecutionService.java:38-40`, `clearDatabase()` at line 112)
   - Parses SQL script into `List<SqlStatement>` via `SqlParser.parseStatementsPrecise()` (`SqlExecutionService.java:45`)
   - Executes each statement sequentially via `jdbc.execute((Statement stmt) -> stmt.execute(sql))` (`SqlExecutionService.java:53-65`)
   - Collects SELECT query results into `allQueryResults` via `MetadataExtractor.extractTableSchema()` (`SqlExecutionService.java:57-61`)
   - On per-statement error, returns `SqlResponse.error()` with message and line number (`SqlExecutionService.java:67-73`)
   - Extracts full metadata: tables, indexes, views, triggers, foreign keys (`SqlExecutionService.java:87-93`)
   - Builds `CanonicalStatement` list with character-offset positions for bidirectional sync (`SqlExecutionService.java:76-83`)
   - Returns `SqlResponse` with `DataPayload` containing all schema + metadata
6. Frontend receives response, checks request ID to prevent race conditions (`useSqlEngine.ts:118`)
7. On success: assigns `_highlightId` to rows for change tracking, updates `db` reactive model (`useSqlEngine.ts:131-165`)
8. On error during `reconciling` mode: transitions to `rollback`, restores `lastValidCode` from `useBidirectionalSync` (`useSqlEngine.ts:124-127`)
9. On network error: sets `executionError` with "cannot connect to backend" message (`useSqlEngine.ts:176-177`)
10. `DataVisualizer.vue` reactively renders tables from `db.tables`
11. `useErDiagram` reacts to `db.tables` and `db.foreignKeys` changes, rebuilds vue-flow nodes/edges, schedules dagre layout

### Secondary Flow: AI Chat (Streaming)

1. User types message in `AiChatPanel.vue`, emits `send` event
2. `App.vue` calls `aiChat.sendMessage(text)` (`App.vue:44`)
3. `useAiChat.sendMessage()` creates user `AiMessage`, then assistant message with `isStreaming: true` (`useAiChat.ts:125-198`)
4. Calls `useAiStreaming.streamCall('/chat', body, onChunk)` which does `POST /api/ai/chat` with SSE `Accept: text/event-stream` (`useAiStreaming.ts:12-20`)
5. `AiController.chat()` sets mode=`chat`, checks `stream` flag (`AiController.java:27-43`)
6. For streaming: returns `Flux<StreamChunk>` from `AiService.streamChat()` (`AiController.java:38-43`)
7. `AiService.streamChat()` selects active provider via `getProvider()` (`AiService.java:124-135`)
8. `OpenAiCompatibleProvider.streamChat()` calls external AI API via Spring WebClient, adapts response via `Protocol.processStream()` (`OpenAiCompatibleProvider.java`)
9. Response SSE stream parsed by `useAiChat` onChunk callback — handles types: `text`, `reasoning`, `usage`, `done`, `error` (`useAiChat.ts:151-185`)
10. `AiMessage` is updated progressively: content appended, first-token timing tracked, reasoning content handled
11. On stream complete: `isStreaming` set to `false`, `endTime` recorded
12. On error: error message set as assistant content
13. Non-streaming endpoints (`/analyze-error`, `/fix-code`, `/explain`, `/optimize`) use `AiService.executeNonStreaming()` which returns `AiChatResponse` directly

### Secondary Flow: Inline Cell Edit

1. User edits a cell in `TableSection.vue` (inline `<input>` or `<textarea>`)
2. `useInlineEdit` validates type constraints via `enforceTypeConstraints()`, emits `update-cell` event (`useInlineEdit.ts`)
3. `App.vue.handleUpdateCell()` calls `engine.updateRow(tableName, oldRow, newRow)` (`App.vue:148-150`)
4. `useBidirectionalSync.updateRow()` (`useBidirectionalSync.ts:91-107`):
   - Enters `reconciling` mode via `beginReconcile()` — saves `lastValidCode`
   - Extracts canonical statements from server or falls back to `extractSqlStatements()`
   - For each statement, calls `findTupleInBatch()` to locate the matching INSERT VALUES tuple (`useBidirectionalSync.ts:52-89`)
   - Generates new VALUES tuple via `generateValuesTuple()` with type-constrained SQL literals
   - Replaces old tuple text in `code.value` at the correct character offsets
   - `flashCode()` highlights the changed SQL area in the editor
5. `useSqlEngine.watch(code)` detects code change -> triggers execution via `debouncedExecuteSql()` (immediate since mode is `reconciling`) (`useSqlEngine.ts:205-207`)
6. Full script re-executes. On success: mode returns to `user`. On error: mode transitions to `rollback`, code restored to `lastValidCode`.
7. Row delete and row insert follow the same pattern but locate tuples by matching data, not position.

**State Management:**
- Frontend: Vue reactive refs and computed properties, `provide`/`inject` for shared context (`SQL_CONTEXT_KEY`, `AI_ACTIONS_KEY` in `injectionKeys.ts`)
- Backend: Stateless services; database state stored in per-name in-memory SQLite instances managed by `DatabasePoolManager`
- No external state management library (no Pinia, no Vuex, no Redux)
- Race condition prevention: request ID counter (`currentRequestId`) in `useSqlEngine` discards stale responses (`useSqlEngine.ts:98-99, 118, 174, 180`)

## Key Abstractions

**`AiProvider` Interface + `Protocol` Interface:**
- Purpose: Pluggable AI model providers
- Files: `AiProvider.java` (interface), `Protocol.java` (interface), `OpenAiCompatibleProvider.java` (impl), `DeepSeekProtocol.java`, `OllamaProtocol.java`, `LmStudioProtocol.java`, `OpenAiProtocol.java`
- Pattern: Strategy pattern with double abstraction — `AiProvider` manages HTTP transport, `Protocol` handles per-provider request formatting / response parsing
- Configured in `application.yml` under `ai.providers`, hot-reloadable via `AiService.refreshProviders()`

**`useSqlEngine` State Machine:**
- Purpose: Core frontend state machine managing SQL execution lifecycle
- File: `sqlive-frontend/src/composables/useSqlEngine.ts`
- States:
  - `user`: Normal editing, debounced 100ms execution on code change
  - `reconciling`: Bidirectional sync (inline edit) — forces immediate execution
  - `rollback`: Execution error during reconciliation — restores `lastValidCode`
- Enforced via `ALLOWED_TRANSITIONS` matrix (`useSqlEngine.ts:22-26`) and `transition()` guard (`useSqlEngine.ts:28-33`)

**`useBidirectionalSync`:**
- Purpose: Maps data table cell edits back to SQL code
- File: `sqlive-frontend/src/composables/useBidirectionalSync.ts`
- Mechanism: Parses INSERT statements via `findTupleInBatch()`, locates VALUES tuples matching row data by column-by-column comparison, replaces in-place, triggers re-execution
- Supports: Cell update, row delete, row insert, table create, table drop
- Uses `canonicalStatements` from server response for accurate character-offset positioning, or falls back to client-side `extractSqlStatements()`

**`DatabasePoolManager`:**
- Purpose: Isolates each named database session
- File: `sqlive-backend/.../service/database/DatabasePoolManager.java`
- Mechanism: `Collections.synchronizedMap(new LinkedHashMap<>(16, 0.75f, true))` with access-order eviction for LRU behavior
- Max 20 databases, idle timeout 20 minutes
- Scheduled cleanup thread evicts idle entries every 5 minutes
- `@PreDestroy` gracefully closes all HikariCP DataSources
- Uses `jdbc:sqlite:file:{name}?mode=memory` URL pattern, `maximumPoolSize=1` for thread safety

**`SqlParser`:**
- Purpose: Splits SQL scripts into individual statements with accurate line numbers
- File: `sqlive-backend/.../service/sql/SqlParser.java`
- Tracks: single/double quotes with escape handling, `BEGIN`/`END` depth, `CASE`/`END` depth, line comments (`--`), block comments (`/* */`)
- Used for: Statement boundary detection AND error line location via `locateErrorLine()`
- Returns `List<SqlStatement>` records with `sql`, `startLine`, `startPos`

**`MetadataExtractor`:**
- Purpose: Reverse-engineers SQLite database schema from introspection queries
- File: `sqlive-backend/.../service/metadata/MetadataExtractor.java`
- Queries: `sqlite_master` for tables, indexes, views, triggers; `PRAGMA foreign_key_list` and `PRAGMA index_info` for FK/index metadata
- Constraint: Must use `ResultSetExtractor` (not `RowCallbackHandler`) to avoid silently dropping 0-row tables

## Entry Points

**Frontend:**
- `sqlive-frontend/index.html`: HTML shell, loads Vite-bundled `src/main.ts`
- `sqlive-frontend/src/main.ts`: `createApp(App).mount('#app')` — Vue app bootstrap
- `sqlive-frontend/src/App.vue`: Root component orchestrating CodeEditor, DataVisualizer, AiChatPanel, KnowledgePanel, LearningCompanion

**Backend:**
- `sqlive-backend/.../SqliveApplication.java`: `@SpringBootApplication` entry point
- Endpoints:

| Method | Path | Controller | Purpose |
|--------|------|-----------|---------|
| `POST` | `/api/execute` | `SqlController` | Execute SQL script |
| `POST` | `/api/ai/chat` | `AiController` | AI streaming chat (SSE) |
| `POST` | `/api/ai/analyze-error` | `AiController` | AI error analysis |
| `POST` | `/api/ai/fix-code` | `AiController` | AI code fix for errors |
| `POST` | `/api/ai/explain` | `AiController` | AI SQL explanation |
| `POST` | `/api/ai/optimize` | `AiController` | AI SQL optimization |
| `GET` | `/api/knowledge/graph` | `KnowledgeController` | Knowledge graph topic data |
| `GET` | `/health` | `HealthController` | Health check (returns "OK") |

## Architectural Constraints

- **Threading:** Frontend is single-threaded event loop. Backend uses Spring Boot thread pool (Tomcat). `DatabasePoolManager` uses `Collections.synchronizedMap` with `synchronized` blocks for thread-safe creation and eviction. Each `JdbcTemplate` has `maximumPoolSize=1` for SQLite thread safety. `RateLimitFilter` uses `ConcurrentHashMap` with synchronized window arrays. `AiService.providers` is `volatile` for safe publication.
- **Full-script re-execution:** Every SQL change triggers re-execution of the entire script; no incremental diffing. All DDL is re-run, all DML re-inserted. `BEGIN`/`END` transaction constructs must be tracked by `SqlParser`.
- **Global state:** `DatabasePoolManager.jdbcTemplates` is a `Collections.synchronizedMap` scoped to the Spring application context. `RateLimitFilter` uses static `ConcurrentHashMap` counters. On `@PreDestroy`, all connections are closed gracefully.
- **Circular imports:** No known circular dependencies. Backend is strictly layered (Controller -> Service -> DTO). Frontend has composables importing other composables (e.g., `useAiChat` imports `useAiStreaming`), but all edges flow downstream (components -> composables -> utils).
- **Rate limiting:** Per-client-IP, per-endpoint-type (sql vs ai) rate limiting via `RateLimitFilter`. 60s sliding window. Configurable via `rate.limit.ai` system property (default 100/min) and `rate.limit.sql` (default 500/min).
- **Request race conditions:** `useSqlEngine` uses `currentRequestId` counter to discard stale responses from previous (aborted) requests. Each execution increments the counter; only the latest response is processed.
- **State machine mode enforcement:** `useSqlEngine` enforces strict mode transitions via `ALLOWED_TRANSITIONS` matrix. Illegal transitions log a DEV warning but do not block (to allow recovery from edge cases).

## Anti-Patterns

### Full-script re-execution with `BEGIN`/`END` depth tracking

**What happens:** `SqlParser.parseStatementsPrecise()` tracks `BEGIN`/`END` and `CASE`/`END` depth to avoid splitting on semicolons inside transaction blocks. However, new SQL constructs containing `END` (e.g., `END AS`, column aliases containing `end`) can cause incorrect statement boundary detection. The parser assumes `END` always matches `BEGIN` or `CASE`. Any unaccounted `END` keyword in a string or identifier context corrupts the depth tracking.
**Why it's wrong:** The parser relies on a simple depth counter rather than a full SQL grammar. When depth tracking goes wrong, statements are split in the wrong place causing incorrect execution groups and error line reporting. The parser also does not distinguish `END` as a keyword vs `END` in identifiers or strings.
**Do this instead:** Add a whitelist of `END` contexts where it should not decrement depth, or parse via a more robust SQL grammar. See `SqlParser.java:130-138`. Alternatively, integrate a proper SQL parser library that handles tokenization correctly.

### Monaco `deltaDecorations()` deprecated in 0.55+

**What happens:** `useMonacoEditor.ts` previously used `deltaDecorations()` which is deprecated as of Monaco 0.55. The code now correctly uses `createDecorationsCollection()`.
**Why it's wrong:** Deprecated APIs may be removed in future Monaco versions, causing compilation or runtime failures.
**Do this instead:** Already fixed — use `createDecorationsCollection()` as done in `useMonacoEditor.ts:111`. Verify no remaining calls to `deltaDecorations()`.

### Vue `$emit` silent fail in template

**What happens:** Vue `<script setup>` template expressions can silently fail when using `$emit` or inline ref assignments in event handlers — tests pass because they trigger the event correctly, but in browser runtime the expression evaluates to nothing.
**Why it's wrong:** The silent failure means features appear to work in unit tests but break in the browser. This is particularly dangerous because tests will not catch it.
**Do this instead:** Always use handler functions (not inline expressions) in event bindings. For example, `@click="handler"` instead of `@click="someVar = val"`. This convention is documented in `CLAUDE.md` under `Vue-Specific Conventions`.

### dagre layout on `onPaneReady` only

**What happens:** `useDagreLayout.ts` runs dagre layout only on the `onPaneReady` vue-flow event. When a panel (ER diagram or knowledge graph) is reopened, nodes remain at position `{0,0}` because `onPaneReady` does not fire again.
**Why it's wrong:** Users reopening an ER diagram or knowledge graph see all nodes stacked at the origin until a manual re-layout is triggered (e.g., by resizing the browser or toggling a filter). This creates a poor user experience and the bug is not caught by tests.
**Do this instead:** Trigger dagre layout on both `onPaneReady` and when the component becomes visible (e.g., via a `watch` on a visibility prop or `IntersectionObserver`).

### Race condition in `RateLimitFilter` cleanup flag

**What happens:** `RateLimitFilter.doFilter()` uses a double-checked locking pattern with a `volatile` field `cleanupStarted` to initialize a scheduled cleanup task on first request (`RateLimitFilter.java:48-54`). While this works, the cleanup scheduler thread is daemon and could be terminated prematurely in some container environments.
**Why it's wrong:** If the cleanup task does not run, the `ConcurrentHashMap` counters grow unboundedly, leaking memory over time.
**Do this instead:** Move cleanup scheduler initialization to a `Filter.init()` override which is guaranteed to be called once per filter lifecycle.

## Error Handling

**Strategy:** Controller-level error responses with consistent payload format. Frontend retry/rollback via state machine.

**Patterns:**
- **Validation errors:** `GlobalExceptionHandler` extends `ResponseEntityExceptionHandler`, overrides `handleMethodArgumentNotValid()` to return `SqlResponse.error()` with field-level concatenated validation messages. Returns HTTP 400.
- **AI provider errors:** `AiProviderException` maps to `AiChatResponse.error()` with HTTP 503 (`SERVICE_UNAVAILABLE`).
- **General errors:** `Exception.class` handler returns HTTP 500 with `SqlResponse.error("Internal server error")`. Full stack trace logged server-side.
- **SQL execution errors:** Caught per-statement in `SqlExecutionService.execute()`, returns `SqlResponse.error()` with SQLite error message (cleaned of `SQLITE_ERROR` prefix) and line number derived from `SqlParser.locateErrorLine()`. All subsequent statements are skipped on first error.
- **Rate limiting:** `RateLimitFilter` returns HTTP 429 with JSON error payload `{"success":false,"error":{"message":"Too many requests, please slow down"}}`.
- **Frontend network errors:** `useSqlEngine.executeSqlRemote()` catches `fetch` errors, sets `executionError` to `{line: 0, message: "cannot connect to backend"}` (`useSqlEngine.ts:176-177`).
- **Frontend reconciliation errors:** On error during `reconciling` mode, `mode` transitions to `rollback` and `code.value` is restored to `getLastValidCode()` (`useSqlEngine.ts:125-127`).
- **AI streaming errors:** `AiController.chat()` `onErrorResume` sends `StreamChunk.error("AI service error, please try again later")` with a `StreamChunk.done()` to close the SSE stream gracefully.

## Cross-Cutting Concerns

**Logging:**
- Backend: SLF4J via Lombok `@Slf4j` on all controllers and services. Log levels: `log.info()` for successful requests (with duration), `log.warn()` for failures and rate limiting, `log.error()` for unhandled exceptions. Structured messages include key-value pairs: `"Execute request: db={}, reset={}, sqlLength={}"`. Rolling file policy: 10MB max, 30-day history, 500MB total cap (configured in `application.yml`).
- Frontend: Conditional DEV-only warnings via `import.meta.env.DEV && console.warn(...)` pattern (`useSqlEngine.ts:29-31`). Error logging via `console.error()` in catch blocks.

**Validation:**
- Backend: `@Valid` + `@RequestBody` on all POST endpoints. `SqlRequest.sql` validated `@NotBlank` + `@Size(max=100000)`. `SqlRequest.dbName` validated with `@Pattern(regexp = "^[a-zA-Z0-9_-]{1,64}$")`. `AiChatRequest` validates message (`@Size(max=50000)`), history (`@Size(max=50)`), SQL and selected code sizes (`@Size(max=100000)` each).
- Frontend: Type constraints enforced client-side via `enforceTypeConstraints()` in `useBidirectionalSync` for inline edits. `useSqlEngine` skips empty SQL (`useSqlEngine.ts:22-25`).

**Authentication:** None. The application runs locally with no authentication layer. CORS is permissive (`http://localhost:*`, `http://127.0.0.1:*`, `http://[::1]:*`) with `allowCredentials(false)`. AI API keys are configured server-side in `application.yml`, sourced from environment variables (`DEEPSEEK_API_KEY`, `OPENAI_API_KEY`, `LM_STUDIO_API_KEY`).

**Serialization:**
- Backend: Jackson `ObjectMapper` configured as a `@Bean` in `WebConfig.java`. Spring Boot default auto-configuration for JSON serialization. Lombok `@Data` on all DTOs.

**Rate Limiting:**
- `RateLimitFilter` applies per-IP, per-path sliding window (60s). `/api/ai/*` rate limited (default 100/min). `/api/execute` rate limited (default 500/min). All other `/api/*` paths pass through without rate limiting.

**CORS:**
- `WebConfig.addCorsMappings()` configures permissive CORS for `/api/**` from localhost origins. Allowed methods: GET, POST, PUT, DELETE, OPTIONS. Allowed headers: Content-Type, Authorization, Accept. Credentials disabled.

---

*Architecture analysis: 2026-05-30*
