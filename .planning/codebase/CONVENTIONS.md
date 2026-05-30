# Coding Conventions

**Analysis Date:** 2026-05-30

## Naming Patterns

**Files:**
- Vue components: PascalCase (e.g., `AiChatPanel.vue`, `CodeEditor.vue`, `DataVisualizer.vue`)
- Composables: camelCase with `use` prefix (e.g., `useSqlEngine.ts`, `useAiChat.ts`, `useErDiagram.ts`)
- Utilities: camelCase descriptive (e.g., `sqlStatements.ts`, `aiFormatter.ts`, `tupleParser.ts`)
- Types/Models: PascalCase (e.g., `DatabaseTypes.ts`, `ApiTypes.ts`, `SchemaTypes.ts`)
- Tests: `<module>.test.ts` format (e.g., `useSqlEngine.test.ts`, `sqlStatements.test.ts`, `App.test.ts`)
- Test utility/helper files: kebab-case (e.g., `test-utils.ts`)
- Backend Java: PascalCase classes matching their purpose (`SqlController.java`, `SqlExecutionService.java`, `GlobalExceptionHandler.java`)

**Functions:**
- Frontend: `camelCase` for all functions, methods, and composable returns
- Backend: `camelCase` for methods in Java (e.g., `executeSql()`, `getOrCreateJdbcTemplate()`, `locateErrorLine()`)
- Private non-exported helpers: `camelCase`, may be prefixed with underscore or left unadorned

**Variables:**
- Frontend: `camelCase` for all variables including refs and computed
- Backend: `camelCase` for local variables, ALL_CAPS for constants (`MAX_DATABASES`, `IDLE_TIMEOUT_MS`, `DB_NAME_PATTERN`)
- Boolean refs: prefixed with `is` (e.g., `isLoading`, `showPanel`, `isSubmitting`)
- Refs wrapped in `ref()` accessed via `.value` in script, auto-unwrapped in template

**Types:**
- Interfaces: PascalCase (`AiMessage`, `ExecuteRequest`, `TableSchema`, `Row`, `DatabaseModel`)
- Type aliases: PascalCase (`EngineMode`, `AiPanelMode`, `DisplayHandler`, `SortField`)
- Enums: Not used in frontend; string literal unions preferred (`type AiPanelMode = 'chat' | 'error-analysis' | ...`)
- Backend DTOs: PascalCase (`SqlRequest`, `SqlResponse`, `AiChatRequest`)
- Backend records/interfaces: PascalCase (`SqlStatement` record in `SqlParser.java`)

## Code Style

**Formatting:**
- Tool: Biome (v2.4.16) — config in `sqlive-frontend/biome.json`
- Indent: spaces, 2 width
- Line width: 120
- Quotes: single (`'`) for JavaScript/TypeScript
- Semicolons: `asNeeded` (only added when required to avoid ASI issues)
- Trailing commas: none

**Linting:**
- Tool: Biome (same config)
- Key rules enabled: `noUnusedVariables` (error), `noUnusedImports` (error), `noConsole` (warn, allows `console.log`)
- Scoped to: `src/**/*.ts`, `src/**/*.vue`, `src/**/*.json`, excludes `node_modules/**`, `dist/**`
- Backend: No explicit linter config detected; standard IntelliJ conventions apply

**TypeScript Strictness:**
- `strict: true` enabled in `tsconfig.app.json`
- `noUnusedLocals: true`, `noUnusedParameters: true`
- `erasableSyntaxOnly: true` (TypeScript 6 — no enums, no namespaces, no parameter properties)
- `noFallthroughCasesInSwitch: true`
- `noUncheckedSideEffectImports: true`
- Path alias: `@/*` maps to `./src/*`
- Base config extends `@vue/tsconfig/tsconfig.dom.json`

## Import Organization

**Order (frontend):**
1. External library imports (e.g., `vue`, `vitest`, `@vueuse/core`, `@vue-flow/core`, `monaco-editor`)
2. Internal `@/` path imports (e.g., `@/config`, `@/composables/useSqlEngine`, `@/model/DatabaseTypes`)
3. Relative imports from `../` or `./` (e.g., `../model/ApiTypes`, `./useInlineActions`)

**Path Aliases:**
- `@/` — maps to `src/` (configured in both `vite.config.ts` and `tsconfig.json`) — used primarily for imports from composables/utils that are consumed by other modules
- Relative imports `../` used for intra-directory and sibling references
- No barrel files — imports point directly to source files. No `index.ts` barrel re-exports.

**Type-only imports:**
- `import type { Foo }` used consistently for type-only imports across all frontend files
- Pattern: `import type { DatabaseModel } from '../model/DatabaseTypes'` vs `import { useSqlEngine } from '../composables/useSqlEngine'`

## Error Handling

**Frontend Patterns:**
- `executionError` stored as `ref<{ line: number; message: string } | null>(null)` in `useSqlEngine.ts`
- Backend returns `{success, data?, error?: {message, line}}` envelope pattern in `SqlResponse`
- Network errors caught with `try/catch`, errors typed as `e instanceof Error` in `useSqlEngine.ts` and `useAiChat.ts`
- Rollback pattern in `useSqlEngine.ts` — on error during reconciling, `code.value` is restored to `getLastValidCode()`
- Error display uses `executionError` ref which components read reactively
- Console errors suppressed in tests: `vi.spyOn(console, 'error').mockImplementation(() => {})`

**Backend Patterns:**
- `GlobalExceptionHandler` extends `ResponseEntityExceptionHandler` at `sqlive-backend/src/main/java/com/douzi/sqlive/exception/GlobalExceptionHandler.java`
- Custom `AiProviderException` for AI service errors
- `@ExceptionHandler` methods for specific exception types: `AiProviderException` -> 503, `MethodArgumentNotValidException` -> 400, `Exception` -> 500
- `handleMethodArgumentNotValid` override for `@Valid` validation errors using field-error aggregation
- `SqlResponse.error(message, line)` static factory for error responses
- SQL execution errors caught per-statement in `SqlExecutionService.java`, returns error with line number from `sqlParser.locateErrorLine()`
- `IllegalStateException` for pool-full conditions in `DatabasePoolManager` maps to 200 with error payload (not 500)

## Logging

**Frontend Framework:** `console.log` / `console.warn` / `console.error` (Biome warns about `console` but allows `log`)
- Conditional DEV-only warnings: `import.meta.env.DEV && console.warn(...)` pattern in `useSqlEngine.ts` (line 29-31) for illegal state transitions
- Pattern: `import.meta.env.DEV && console.warn(...)` — only emits in dev mode, stripped in production builds

**Backend Framework:** Lombok `@Slf4j` on all controllers and services (14+ classes annotated)
- `@Slf4j` on: `SqlController`, `AiController`, `KnowledgeController`, `HealthController`, `SqlExecutionService`, `AiService`, `DatabasePoolManager`, `MetadataExtractor`, `GlobalExceptionHandler`, `RateLimitFilter`, `OpenAiCompatibleProvider`, `KnowledgeGraphService`, `OllamaProtocol`, `LmStudioProtocol`, `OpenAiProtocol`
- Log levels: `log.info()` for successful requests, `log.warn()` for failures, `log.error()` for unhandled exceptions
- Structured log messages with SLF4J parameterized placeholders:
  ```java
  log.info("Execute request: db={}, reset={}, sqlLength={}", dbName, request.isReset(), request.getSql().length());
  log.info("Execute success: db={}, tables={}, statements={}, elapsed={}ms", dbName, tableCount, stmtCount, elapsed);
  log.warn("SQL execution failed at line {}: {}", s.startLine(), e.getMessage());
  ```

## Comments

**When to Comment:**
- JSDoc/TSDoc: Used sparingly — only for public API surface like composable entry points
- Section headers: `// -- Section name --` style with em-dashes for visual grouping in tests (frontend)
- Section headers: `// ============================================================` patterns in backend tests
- Chinese comments: Mixed Chinese and English, used for inline implementation notes
- Tests use section comments for boundary/edge case grouping: `// --- Boundary and edge case tests ---`

**JSDoc/TSDoc:**
- Minimal usage — only on complex composable entry points and utility module heads
- Example from `useAiChat.ts`:
  ```typescript
  /**
   * Core AI chat composable. Must be instantiated once in App.vue.
   * Handles SSE streaming chat, error auto-analysis, and learning suggestions.
   */
  ```
- Example from `sse.ts`:
  ```typescript
  /**
   * Lightweight SSE stream reader. Parses the SSE wire format ...
   */
  ```
- Example from `tupleParser.ts`:
  ```typescript
  /**
   * Parse VALUES tuples from SQL INSERT statements, correctly handling
   * nested parentheses (function calls) and quoted strings.
   */
  ```

**Inline Comments:**
- Chinese comments for implementation notes: `// 处理块注释`, `// 检测行注释开始`
- Commented-out code: Minimal. Some commented template elements remain (e.g., `DataVisualizer.vue` line 4 has commented-out h2)

## Function Design

**Size:**
- Composables: 100-350 lines, well-organized into sections with blank-line separation
- Module-level helper functions: 5-20 lines (e.g., `hashString()`, `transition()` in `useSqlEngine.ts`)
- Vue component scripts: typically 100-200 lines
- Backend services: Methods typically 10-80 lines, single responsibility (e.g., `DatabasePoolManager.getOrCreateJdbcTemplate()` ~30 lines, `MetadataExtractor.extractTableSchema()` ~40 lines)
- Test files can be large (e.g., `SqlExecutionServiceTest.java` at 982 lines, `sqlStatements.test.ts` at 2166 lines)

**Parameters:**
- Composables: Accept context objects for dependency injection (e.g., `useAiChat(ctx: { executionError, code, db })`)
- Functions: Named parameters only for complex signatures, destructured where possible
- Backend: Constructor injection for services, method parameters for operations
- Module-level pure functions: Positional parameters, typed (e.g., `enforceTypeConstraints(val: any, rawType: string)`)

**Return Values:**
- Composables: Return plain object with refs and functions destructured by callers
- Backend Controllers: DTO objects (`SqlResponse`, `AiChatResponse`)
- Backend Services: Return DTOs or domain objects directly
- Pure utility functions: Return plain values or typed result objects
- Boolean API: `isSuccess()` / `isAvailable()` getter convention in Java DTOs via Lombok

## Module Design

**Exports:**
- Composables: Single named `export function useX()` per file
- Utilities: Multiple named `export const fn = ...` exports per file (e.g., `sqlStatements.ts` exports `extractSqlStatements`, `enforceTypeConstraints`, `compareValuesForHighlight`, etc.)
- Types: `export interface/type` per logical grouping, multiple interfaces per file
- Vue components: Default export via `<script setup>` (component name from filename)

**Barrel Files:** Not used. All imports are direct to source files.

**Frontend Module Tree:**
- `src/composables/` — 16 composable files: `useAiChat.ts`, `useAiStreaming.ts`, `useBidirectionalSync.ts`, `useDagreLayout.ts`, `useDatabaseLifecycle.ts`, `useErDiagram.ts`, `useFilteredList.ts`, `useHighlight.ts`, `useInlineActions.ts`, `useInlineEdit.ts`, `useKnowledgeGraph.ts`, `useMonacoEditor.ts`, `useMultiTabs.ts`, `useSortFilter.ts`, `useSqlEngine.ts`, `useTablePipeline.ts`
- `src/utils/` — 7 utility files: `aiFormatter.ts`, `file.ts`, `html.ts`, `sql.ts`, `sqlStatements.ts`, `sse.ts`, `tupleParser.ts`
- `src/model/` — 4 type definition files: `ApiTypes.ts`, `DatabaseTypes.ts`, `SchemaTypes.ts`, `injectionKeys.ts`
- `src/components/` — Component directories: `ai-elements/`, `chart/`, `er/`, `knowledge/`, `ui/` plus root components like `CodeEditor.vue`, `DataVisualizer.vue`, `AiChatPanel.vue`, `TableSection.vue`, `ResultTable.vue`, etc.

**Backend Package Structure:**
- `controller/` — REST endpoints: `SqlController.java`, `AiController.java`, `KnowledgeController.java`, `HealthController.java`
- `service/` — Business logic: `SqlExecutionService.java`, sub-packages `ai/`, `database/`, `knowledge/`, `metadata/`, `sql/`
- `dto/` — Request/Response objects: `SqlRequest.java`, `SqlResponse.java`, data payloads; `dto/ai/` subpackage for AI DTOs
- `config/` — Spring configuration: `WebConfig.java`, `RateLimitFilter.java`, `AiProperties.java`
- `exception/` — Custom exceptions and handlers: `GlobalExceptionHandler.java`, `AiProviderException.java`

## Vue-Specific Conventions

**Component Structure:**
- `<script setup lang="ts">` required — no Options API
- Order: Template first, then `<script setup>`, then `<style scoped>` (scoped CSS)
- Typed emits: `defineEmits<{ 'event-name': [arg: type] }>()` — function-call syntax
- Typed props: `defineProps<{ propName: Type }>()` — generics syntax
- `inject` for dependency injection from ancestor components (using injection keys from `model/injectionKeys.ts`)
- `ref` for local state, `computed` for derived state, `watch` for side effects
- `data-testid` attributes on interactive elements for E2E test targeting

**Composable Patterns:**
- All composables are `use*` factory functions that return a plain object of refs and functions
- Accept dependencies as function parameters or getter functions (not as constructor injection)
- Provide/inject pattern: Composable instances created in `App.vue`, provided via `SQL_CONTEXT_KEY` and `AI_ACTIONS_KEY` symbols, injected in child components
- State machine pattern: `useSqlEngine.ts` uses explicit mode transitions with `ALLOWED_TRANSITIONS` matrix

**Anti-Patterns to Avoid:**
- Template inline `$emit` calls and inline ref assignments — silent fail in browser but pass in tests. Always use handler functions.
- Monaco `deltaDecorations()` deprecated in 0.55+ — use `createDecorationsCollection()` instead
- `RowCallbackHandler` in SQLite JDBC — use `ResultSetExtractor` to avoid silently dropping 0-row tables
- dagre layout on `onPaneReady` only — nodes stack at `{0,0}` on panel reopen. Re-run layout on data change.

## Backend-Specific Conventions

**API Envelope:**
- Every response has `{success: boolean, data?: T, error?: {message, line}}`
- Both successful and error responses return HTTP 200 unless validation fails (HTTP 400) or internal error (HTTP 500)
- AI provider errors return HTTP 503 (SERVICE_UNAVAILABLE)

**Dependency Injection:**
- Constructor injection only — no field injection (`@Autowired` not used)
- Explicit constructors for all services/controllers
- `@Service`, `@RestController`, `@ControllerAdvice` annotations on classes

**Lombok:**
- `@Slf4j` on all controllers, services, and cross-cutting components (15+ classes)
- `@Data` on DTOs (`SqlRequest.java`, `SqlResponse.java`, payloads in `dto/` subpackage) for automatic getter/setter/equals/hashCode/toString
- `@Data` also on configuration properties (`AiProperties.java`)
- No `@RequiredArgsConstructor` — explicit constructors used instead
- `@Builder` / `@Value` / `@NoArgsConstructor` / `@AllArgsConstructor` not observed in the codebase

**Database:**
- `JdbcTemplate` only — no JPA/Hibernate
- `Connection`/`Statement`/`ResultSet` used directly for higher control in `SqlExecutionService.java`
- `ResultSetExtractor` required (not `RowCallbackHandler`) to preserve 0-row tables in `MetadataExtractor.java`
- `PRAGMA foreign_keys = OFF` on cleanup to avoid FK constraint failures during teardown
- `jdbc:sqlite:file:{name}?mode=memory&cache=shared` URL pattern for named in-memory databases

**Validation:**
- `@Valid` on `@RequestBody` in controllers with `jakarta.validation` constraints
- `@NotBlank`, `@Size`, `@Pattern` on `SqlRequest` fields
- `GlobalExceptionHandler` must extend `ResponseEntityExceptionHandler` and override `handleMethodArgumentNotValid()` — without this, validation errors return 500 instead of 400

## Testing Conventions

**Frontend:**
- Vitest with `vi.fn()` for all mocking — `globalThis.fetch` is replaced with `vi.fn()`
- `vi.useFakeTimers()` for debounce testing with `vi.advanceTimersByTimeAsync()`
- `vi.resetModules()` to get fresh module instances before each test file group
- Setup/teardown through centralized helpers in `test-utils.ts`
- Component tests use `@vue/test-utils` `mount()` with `stubs` and `provide` options
- Test names are descriptive strings (not `should` prefix, but `it('should ...')` convention)
- Section headers in large test files use `// ======` block comments

**Backend:**
- JUnit 5 (`@Test`, `@BeforeEach`, `@BeforeAll`, `@AfterEach`)
- `@SpringBootTest(webEnvironment = RANDOM_PORT)` for controller integration tests
- `RestTemplate` for HTTP-level testing (no `MockMvc`)
- Mockito `mock()` / `when()` for external dependencies
- Test methods named `shouldXxx` (e.g., `shouldExecuteSimpleSelect`, `shouldRejectEmptyScript`)
- Section comments use `// ==========` block dividers
- Shared test utilities in `SqlControllerTestSupport.java`, `DatabasePoolManagerTest.java` uses `@AfterEach` cleanup pattern

---

*Convention analysis: 2026-05-30*
