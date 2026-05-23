# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A full-stack SQL playground: write SQL in a code editor on the left, see tables and data rendered on the right. You can edit data inline in the visualizer and it reverse-engineers the SQL to update the source code. The backend runs SQLite in-memory (shared cache mode), clearing and re-executing the full script on every request.

## Commands

### Frontend (`sqlive-frontend/`)

```bash
npm run dev       # Start dev server with --host (hot reload)
npm run build     # Type-check (vue-tsc) then production build
npm run preview   # Preview production build
npm run test      # Run all vitest tests
npm run test:watch # Run tests in watch mode
npm run test:e2e    # Run Playwright e2e tests
npm run test:e2e:ui # Run e2e tests with Playwright UI
```

### Backend (`sqlive-backend/`)

```bash
./gradlew bootRun          # Start Spring Boot (port 8080)
./gradlew test             # Run all tests
./gradlew test --tests "*ClassName*"  # Run single test class
```

## Architecture

### Frontend (`src/`)

**Core files:**

| File | Role |
|---|---|
| `App.vue` | Top-level layout with tabbed panels (CodeEditor, DataVisualizer, ER diagram, AI chat) |
| `viewmodel/useSqlEngine.ts` | **Core state machine** — reactive SQL `code`, `db` model, calls `POST /api/execute`, handles bidirectional sync and multi-tab database isolation |
| `viewmodel/useAiChat.ts` | AI chat state — sends SQL context to backend AI endpoints, manages conversation history and streaming |
| `viewmodel/useErDiagram.ts` | Data transformation (TableSchema → nodes, ForeignKeyInfo → edges), dagre auto-layout |
| `components/CodeEditor.vue` | Monaco-based SQL editor with syntax highlighting and flash-highlight for sync regions |
| `components/DataVisualizer.vue` | Renders tables from `db.tables`, inline cell editing (blur commits), ghost-row insertion, drop-table |
| `model/DatabaseTypes.ts` | TypeScript interfaces: `DatabaseModel`, `TableSchema`, `Row`, `HighlightState`, `ForeignKeyInfo` |

**Supporting components:**

| File | Role |
|---|---|
| `components/TableSection.vue` | Single table view with sort/filter/pagination and index badge navigation |
| `components/ResultTable.vue` | Minimal query-result table with chart toggle |
| `components/ChartView.vue` | Chart.js visualization for query result data |
| `components/AiChatPanel.vue` | Chat interface with markdown rendering, reasoning mode, inline quick-fixes |
| `components/AiInlineResult.vue` | Inline AI result display (code diff, explanation, optimization) |
| `components/CreateTableModal.vue` | Modal form builder that generates `CREATE TABLE` + `INSERT` SQL |
| `components/EmptyState.vue` | Empty state with SQL topic suggestions and sample queries |
| `components/HoverPreview.vue` | Column hover preview in index badge |
| `components/SortFilterToolbar.vue` | Table sort/filter UI toolbar |
| `components/AiMessageFooter.vue` | AI message footer with token count and action buttons |
| `composables/useMultiTabs.ts` | Multi-tab state: tab CRUD, dbName assignment, import/export |
| `composables/useTablePipeline.ts` | Sort/filter/pagination logic for table data |
| `composables/useSortFilter.ts` | Column-level sort and filter state |
| `utils/sqlStatements.ts` | SQL parsing utilities for the frontend |
| `utils/sse.ts` | SSE stream parsing (handles chunked responses from AI endpoints) |
| `utils/aiQuickFix.ts` | AI response parsing into quick-fix actions |

**UI component library (`components/ui/`):** Reka-ui v2 based wrappers — button, dialog, dropdown-menu, select, command, tooltip, hover-card, input-group, button-group, avatar, separator, input, textarea, collapsible, scroll-area. All UI primitives follow the same wrapper pattern (import from `reka-ui`, wrap with consistent styling).

**AI elements (`components/ai-elements/`):** conversation, message, prompt-input, reasoning, suggestion, loader, shimmer — used by chat panel and inline results.

**ER diagram (`components/er/`):**

| File | Role |
|---|---|
| `ErDiagram.vue` | `<VueFlow>` container, registers custom node types |
| `ErTableNode.vue` | Custom node (table card with PK/FK/UQ badges) |
| `ErToolbar.vue` | Auto-layout / fit-view / minimap toggle buttons |
| `ErSearchBar.vue` | Table/column search filter |

**Data flow:** User edits code → debounced watch (1s) → `executeSqlRemote()` → `POST /api/execute` → response builds new `db.tables` array. Cell edit in DataVisualizer calls `updateRow()` which finds and replaces the matching `VALUES` tuple in the SQL text, then the watch triggers a fresh execute.

**Key types:**
- `DatabaseModel.tables` is an **ordered array** (not a map). The first entry may be a synthetic "查询结果" (query result) table from the last `SELECT`.
- `Row` has optional `id`, `_highlightId`, `_rawSql` fields plus arbitrary column keys.

### Backend (`src/main/java/com/douzi/sqlive/`)

**SQL execution:**

| File | Role |
|---|---|
| `controller/SqlController.java` | `POST /api/execute` — validates input, delegates to service, logs timing |
| `service/SqlExecutionService.java` | Core logic: parses SQL script, clears DB per `reset` flag, executes each statement, captures `ResultSet` as synthetic query-result table, collects all physical tables via `sqlite_master`, collects indexes/views/triggers/foreign keys |
| `dto/SqlRequest.java` | `{ sql: string, dbName: string, reset: boolean }` |
| `dto/SqlResponse.java` | `{ success, data: { tables, queryResults, indexes, views, triggers, foreignKeys, metadata }, error: { message, line } }` |
| `dto/TableSchema.java` | `{ name, columns[], columnTypes{}, data[] }` — columnTypes values include constraint annotations like `INTEGER | NOT NULL` |
| `exception/GlobalExceptionHandler.java` | Catches `SqlExecutionException` (→400), `AiProviderException` (→503), `MethodArgumentNotValidException` (→400), and general exceptions (→500). **Must extend `ResponseEntityExceptionHandler`** for `@Valid` validation to work in Spring Boot 4.0.6. |
| `exception/SqlExecutionException.java` | Custom exception with `message` + `line` number |

**AI integration (`service/ai/`):**

| File | Role |
|---|---|
| `controller/AiController.java` | `POST /api/ai/chat` (streaming), `POST /api/ai/suggest` — delegates to `AiService` |
| `service/ai/AiService.java` | Orchestrates AI providers — builds system prompt from SQL context, calls provider, parses response |
| `service/ai/AiProvider.java` | Interface with `getProviderName()` and `streamChat()` |
| `service/ai/AbstractOpenAiCompatibleProvider.java` | Base class for OpenAI-compatible APIs (auth, WebClient config) |
| `service/ai/OpenAiCompatibleProvider.java` | Generic OpenAI-compatible provider |
| `service/ai/DeepSeekProvider.java` | DeepSeek-specific provider |
| `service/ai/OllamaProvider.java` | Ollama local provider |
| `service/ai/LmStudioProvider.java` | LM Studio local provider |
| `service/ai/PromptBuilder.java` | Builds mode-specific prompts (analyze-error, fix-code, explain, optimize, chat) |
| `dto/ai/AiChatRequest.java` | `{ mode, messages, currentSql, dbName, selectedCode }` |
| `dto/ai/AiChatResponse.java` | `{ success, data: { summary, content, fixedCode }, error }` |

**Knowledge graph (`service/knowledge/`):**

| File | Role |
|---|---|
| `KnowledgeGraphService.java` | Loads `knowledge-graph.json`, generates learning suggestions from classified SQL topics |
| `SqlTopicClassifier.java` | Keyword + regex pattern matching to classify SQL into knowledge topics |

**SQLite config** (`application.yml`): `jdbc:sqlite:file:playground?mode=memory&cache=shared` — the shared cache is required so HikariCP's connection pool doesn't lose tables between connections. Each `dbName` gets its own in-memory database via `ConcurrentHashMap<String, JdbcTemplate>`.

**Statement parsing:** `parseStatementsPrecise()` splits on `;` while tracking single/double-quote state, `BEGIN`/`END` block depth, and `CASE`/`END` depth, and skipping `--` and `/* */` comments. Line numbers are tracked for error reporting.

### Bidirectional sync (the hard part)

When a user edits a cell in DataVisualizer:
1. `useSqlEngine.updateRow()` extracts all SQL statements from the current code
2. For each statement that inserts into the target table, it calls `findTupleInBatch()` which matches the old row data against `VALUES` tuples by comparing normalized values
3. The matched tuple is replaced with a new `VALUES` tuple via `generateValuesTuple()`
4. The code change triggers the `watch` which calls `executeSqlRemote()`
5. If the backend returns an error, the code is rolled back to `lastValidCode` and the error is displayed

## Environment

- **Java:** JDK 21 required — backend must use Zulu JDK 21 at `C:\Program Files\Zulu\zulu-21\bin\`
- **Node:** Works with any recent LTS
- **Backend port:** 8080; frontend dev server auto-proxies `/api` requests

## Dependencies

- **Frontend:** Vue 3 (Composition API, `<script setup>`), Vite 8.x, Tailwind CSS 4 (CSS-based config, `@tailwindcss/vite` plugin), vue-tsc for type checking
- **Backend:** Spring Boot 4.0.6, Java 21, JdbcTemplate (plain JDBC, no JPA/Hibernate), SQLite JDBC via `org.xerial:sqlite-jdbc`, HikariCP, Lombok, JUnit 5

### Key libraries

| Library | Version | Usage |
|---------|---------|-------|
| `@vue-flow/core` | ^1.48 | ER diagram canvas — nodes, edges, zoom/pan, built-in edge types (`smoothstep`, `bezier`, `straight`, `step`) |
| `@vue-flow/background` | ^1.3 | Grid background for ER diagram |
| `@vue-flow/controls` | ^1.1 | Zoom control buttons |
| `@vue-flow/minimap` | ^1.5 | MiniMap overview |
| `dagre` | ^0.8.5 | Auto-layout algorithm for ER diagram nodes |
| `monaco-editor` | ^0.55 | SQL code editor |
| `chart.js` | ^4.5 | Chart rendering for query results |
| `reka-ui` | ^2.9 | Headless UI primitives (wrapped in `components/ui/`) |
| `ai` (Vercel AI SDK) | ^6.0 | AI chat streaming and conversation management |
| `marked` | ^18.0 | Markdown rendering for AI responses |
| `vue-stream-markdown` | ^1.0.0-beta.2 | Streaming markdown rendering in chat |
| `sql-formatter` | ^15.7 | SQL code formatting |

## Development principles

### Read before edit, research before change

- **Before editing any file, read it first.** Never edit a file you haven't read — stale assumptions lead to bad diffs.
- **Before modifying a function, grep for all callers.** Understand the full blast radius. A seemingly safe signature change can break distant call sites.
- **Research before you edit.** Use Grep, Glob, and LSP tools to trace references before writing code. Don't guess.

### Prioritize mature off-the-shelf solutions over custom code

When adding a new feature, first research what battle-tested options already exist in the ecosystem — libraries, tools, SaaS, or established patterns. Only build custom code when no mature option fits. Writing and maintaining custom code is a last resort, not the default.

### Prefer library built-ins over custom code

Before writing a custom component or utility, always check whether the library/framework already provides that capability:

1. **vue-flow**: Has built-in edge types (`smoothstep`, `bezier`, `straight`, `step`) with native support for `label`, `markerEnd`, `labelStyle`, `labelBgStyle`, `labelBgPadding`, `labelBgBorderRadius`. Do NOT write custom edge components — configure the built-in edges via their props. Use `MarkerType.ArrowClosed` for arrowheads.

2. **Vue 3**: Prefer `<script setup>` + Composition API. Use `ref`/`computed`/`watch` from Vue, not external state libraries.

3. **Tailwind CSS**: Use utility classes for styling. Only write custom CSS when Tailwind can't express the design (e.g., specific SVG path styles, vue-flow internal element overrides).

4. **dagre**: Already integrated for graph layout. No need for elkjs or other layout engines unless dagre proves insufficient for very large schemas.

### ER diagram component structure

```
src/components/er/
  ErDiagram.vue      — <VueFlow> container, registers custom node types only
  ErTableNode.vue    — Custom node (table card with PK/FK/UQ badges)
  ErToolbar.vue      — Auto-layout / fit-view / minimap toggle buttons
  ErSearchBar.vue    — Table/column search filter
src/viewmodel/
  useErDiagram.ts    — Data transformation (TableSchema → nodes, ForeignKeyInfo → edges), dagre layout
```

Edges use vue-flow's built-in `smoothstep` type — NO custom edge component. Edge config lives in `useErDiagram.ts` where `foreignKeysToEdges()` sets `type: 'smoothstep'`, `markerEnd`, `label`, and style properties.

## Debugging principles

### Trace the full pipeline before fixing

When data flows through multiple layers (LLM → backend → SSE → frontend → render), isolate the broken layer FIRST. Don't guess — add logging at each boundary and compare input vs output. In this session, heading rendering was broken because LLM tokenization split `###` from its text with `\n`, producing empty headings. Four fix attempts (system prompt, CSS, escape/restore, JSON wrapping) before identifying the real root cause.

### Don't paper over symptoms with fallbacks

A static fallback message (`"AI 未返回任何内容"`) hides the real problem (backend provider pointing to a dead LLM). The user sees the message and thinks the feature is broken, when the fix is changing one config line. Fallbacks should surface the actual error, not replace it.

### Fix the right layer

Don't fix a rendering problem by editing the system prompt. Don't modify the DeepSeek provider when the user is using openai-compatible. Always identify which layer owns the bug before touching code:
- Content quality → AI prompt/model
- Content corruption → transport (SSE/JSON)
- Display issues → frontend renderer

### End-to-end verify before claiming done

`npm test` passing ≠ feature working. For full-stack changes, start both servers and test the actual user flow in the browser. A two-minute end-to-end test would have caught the empty heading and missing token count issues immediately.

### Minimal change, not rewrite

When fixing a single bug (whitespace in Markdown), don't rewrite the entire SSE parser or the full provider class. Targeted edits reduce blast radius and make it obvious what changed. Rewriting files mid-debugging also destroys evidence of what was there before.

### Ask before touching backend config

`application.yml` controls which AI provider and model are active. Don't change it without explicit user approval — the user may have a specific setup running (LM Studio on localhost:1234, etc.).

## Anti-patterns and process

### Verification before planning

- **External claims are not facts.** Agent reports, documentation, AI output claiming something is "invalid" or "broken" — verify with actual commands before writing into a plan. One `./gradlew dependencies` or `npm install` trumps any report.
- **Static analysis reports can be >85% false positive** in framework-heavy code. Grep-verify each finding before creating tasks. Don't create tasks for warnings you haven't personally confirmed.
- **Plan statements need code evidence.** Every line number, type signature, and dependency claim in a plan must be verified by reading the actual file in the same cycle — not "plan first, verify later."

### Scope and design

- **Scope creep guard.** When work naturally extends to another area, pause and ask the user whether to continue before proceeding. "锐评一下" shouldn't silently become a 30-file refactor across both frontend and backend.
- **Strategy over-splitting.** Don't split an interface when its implementations never vary independently. If Ollama's request format is always paired with Ollama's SSE format, they belong in one Protocol implementation, not 4 strategy interfaces with 9 implementations.
- **God composable detection.** If `return { ... }` in a composable exceeds 5 entries, consider splitting. A 615-line composable with 28 exports managing 7 responsibilities is not a composable — it's a mini-framework.
- **Props/events pipeline across 3+ layers** → use `provide`/`inject` instead. Signal: a component receives props or emits events it never consumes — it only forwards them. When every new AI feature requires touching 3 files, the layering is wrong.

### Code hygiene

- **`any` contagion.** `response.json()` returns `any`, and every destructured field downstream inherits it. Mirror backend DTOs in TypeScript interfaces so a renamed field breaks at compile time, not silently in the browser.
- **Delete import → grep entire file first.** Don't assume only the lines you just edited reference the symbol. Gradle/tsc will catch it, but the round-trip is wasted time.
- **Deprecation: check ownership before migrating.** Is the deprecated symbol yours or the framework's? Framework-controlled symbols (overridden methods, inherited annotations) can only be suppressed; only migrate APIs you control.
- **Floating promises:** mark intentional discard with `void`. `sendMessage(context)` returns `Promise<void>` — write `void sendMessage(context)` to make the intent explicit.
- **Error lifecycle is independent of UI mode.** Don't gate `executionError = null` on `mode === 'user'` — reconciling mode also needs fresh errors cleared.
- **Implicit state machines:** when a variable has 3+ discrete modes with specific transition rules, make transitions explicit with an `ALLOWED_TRANSITIONS` table. Silently swallowing illegal transitions creates debugging nightmares.
- **Module-scope mutable state** (`let editor`, `let ignoreChanges` at `<script setup>` top level) leaks state across component instances. Wrap in a `state` object or use Vue `ref`.
- **Remove unused types/interfaces after refactors.** Don't let type definition files accumulate dead entries — grep for references before declaring cleanup done.

### Testing

- **Short-circuit assertions make tests worthless.** `expect(fn()).toBeTruthy() || true` always passes. If a test can never fail, delete it or fix the assertion.
- **Verify more than "was called."** `expect(fetchSpy).toHaveBeenCalled()` without checking URL, method, or body catches zero regressions.
- **Test timings must match production.** If prod debounce is 100ms, test tick should be ~150ms (debounce + buffer), not 1100ms. Mismatched timing means the test never actually verified the debounce behavior.

## MCP tools

### chrome-devtools vs playwright

- **chrome-devtools MCP** — Browser automation + DevTools diagnostics (performance traces, memory snapshots, Lighthouse audits, device emulation). Use for perf/memory/accessibility debugging.
- **playwright MCP** — Browser automation + E2E testing facilities (slow typing, native `<select>`, external file drag-drop, full Playwright API escape hatch via `browser_run_code_unsafe`). Use for clean reproducible automation flows.
- Daily page interactions (click, fill, screenshot, snapshot) work with either. Pick based on whether you need diagnostics (chrome-devtools) or test-grade reproducibility (playwright).

## Gotchas

### Spring Boot validation

`@Valid` on `@RequestBody` parameters requires the `GlobalExceptionHandler` to **extend `ResponseEntityExceptionHandler`** and override `handleMethodArgumentNotValid()`. Without this, `MethodArgumentNotValidException` falls through to Spring's default error handler and returns a 500 with a generic error body instead of the custom `SqlResponse`.

### SQLite JDBC: ResultSetExtractor vs RowCallbackHandler

When reading table data, use `JdbcTemplate.query(sql, ResultSetExtractor)` — NOT `RowCallbackHandler`. The `RowCallbackHandler` is called per row, but `extractTableSchema()` consumes the entire ResultSet internally. This causes tables with 0 rows to be silently dropped (callback never fires).

### Monaco Editor decorations

`editor.deltaDecorations()` is deprecated in Monaco 0.55. The replacement is `editor.createDecorationsCollection()` with `.set()` / `.clear()` methods. The code still uses the old API — change cautiously, as the return type differs.

### SQL script parsing

`parseStatementsPrecise()` tracks `BEGIN`/`END` block depth (for triggers) and `CASE`/`END` depth (for CASE expressions within statements). When adding new SQL constructs that use `END`, ensure they don't break statement boundary detection.

### Frontend vite config

`rollupOptions` is deprecated in Rolldown-powered Vite; the new key is `rolldownOptions`. However, `rolldownOptions.output.codeSplitting` doesn't accept the `manualChunks` function syntax — it expects `boolean | CodeSplittingOptions`. Keep `rollupOptions` until the Rolldown code-splitting API stabilizes.
