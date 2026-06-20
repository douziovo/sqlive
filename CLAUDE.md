# CLAUDE.md

## Project overview

Full-stack SQL playground: code editor → SQLite in-memory backend → table visualizer. Inline cell edits reverse-engineer SQL. Backend clears and re-executes full script per request (shared cache mode).

## Commands

| Command | What |
|---|---|
| `npm run dev` | Frontend dev server (hot reload, direct VITE_API_URL to :8080) |
| `npm run test` | All vitest tests |
| `./gradlew bootRun` | Backend on port 8080 |
| `./gradlew test` | All backend tests |

## Architecture

**Frontend:** `useSqlEngine.ts` (state machine, SQL execute, bidirectional sync), `useAiChat.ts` (AI streaming), `useErDiagram.ts` (schema→vue-flow nodes/edges via dagre), `CodeEditor.vue` (Monaco), `DataVisualizer.vue` (tables + inline edit), `DatabaseTypes.ts` (types). UI primitives: `components/ui/` (Reka-ui v2). ER edges use built-in `smoothstep` — NO custom edge components. Knowledge graph: `components/knowledge/`.

**Data flow:** Code edit → debounced 100ms → `POST /api/execute` → new `db.tables`. Cell edit → `updateRow()` replaces `VALUES` tuple → re-execute. Error → rollback to `lastValidCode`.

**Backend:** `SqlController` → `SqlExecutionService` (parse, execute, collect via sqlite_master). AI: `AiController` → `AiService` → provider chain (`AiProvider` interface, DeepSeek/Ollama/LMStudio/openai-compatible). Knowledge: `KnowledgeGraphService`. DB: `jdbc:sqlite:file:playground?mode=memory&cache=shared` per `ConcurrentHashMap<String, JdbcTemplate>`. Parsing: `parseStatementsPrecise()` tracks quote state, `BEGIN`/`END` depth, `CASE`/`END` depth.

## Environment & tech stack

Zulu JDK 21 (`C:\Program Files\Zulu\zulu-21\bin\`), Node LTS, backend port 8080. Vue 3 (`<script setup>`), Vite 8.x, Tailwind CSS 4, Spring Boot 4.0.6, JdbcTemplate (no JPA), SQLite JDBC, HikariCP. Key libs: vue-flow, dagre, monaco-editor, reka-ui, Vercel AI SDK, ECharts.

## Principles

- **Read before edit.** Grep callers before modifying. Off-the-shelf first.
- **Fix the right layer.** Content→prompt, transport→SSE/JSON, display→renderer.
- **End-to-end verify.** Tests green ≠ feature works. dagre layout 只在 `onPaneReady` 跑，面板重开后节点全堆 {0,0}——测试全绿也查不出。`git diff` before commit.
- **Minimal change.** Don't rewrite files to fix one bug.
- **Spec before plan.** Brainstorming → spec → plan → implement. 计划每行声明必须在规格有对应。
- **Plan needs code evidence.** 每行行号/类型/import 都要读文件核实。不去建议文件里已有或无用的 import。
- **Ask before touching `application.yml`.**

## Gated pipeline

Feature work 走四阶段门控，每阶段结束后调 `gated-pipeline` 审查，通过才能进入下一阶段：

1. **design** — 设计文档写完 → 发 `phase=design` + 设计全文
2. **spec** — 规格文档写完 → 发 `phase=spec` + 规格全文
3. **plan** — 实现计划写完 → 发 `phase=plan` + 计划全文 + `<context>` 含 spec 摘要
4. **implementation** — 代码写完、测试通过后 → 发 `phase=implementation` + `<context>` 含 task 描述、test 输出、git diff、plan 上下文

审查返回 `ok: false` 时，修正后重新发同 phase 审查（带 `<diff>` 做增量审），直到 `ok: true` 才能推进。

## Gotchas

- **Spring Boot:** `@Valid` on `@RequestBody` needs `GlobalExceptionHandler extends ResponseEntityExceptionHandler` + override `handleMethodArgumentNotValid()`. Else → 500.
- **SQLite JDBC:** Use `ResultSetExtractor`, NOT `RowCallbackHandler` — 0-row tables silently dropped with the latter.
- **Monaco:** `deltaDecorations()` deprecated in 0.55 → `createDecorationsCollection()`. Return type differs.
- **SQL parsing:** `parseStatementsPrecise()` tracks `BEGIN`/`END` and `CASE`/`END` depth. New `END` constructs may break statement boundaries.
- **Vite:** `rollupOptions` → `rolldownOptions`, but `codeSplitting` doesn't accept `manualChunks` function. Keep `rollupOptions`.
- **Vue `<script setup>`:** 模板中 `$emit` 和内联 ref 赋值在浏览器 silent fail（测试通过但不同代码路径）。始终用 handler 函数，不用内联写法。

