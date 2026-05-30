# Testing Patterns

**Analysis Date:** 2026-05-30

## Test Framework

**Frontend Runner:**
- Framework: Vitest v4.1.6
- Config: Inline in `sqlive-frontend/vite.config.ts` under `test:` block
- Environment: `jsdom`
- Globals: `true` (though most tests still import `describe`/`it`/`expect` from `vitest` explicitly)
- Setup file: `src/__tests__/setup.ts` (polyfills `document.queryCommandSupported` for Monaco editor)
- Exclude: `['tests/e2e/**', 'node_modules/**']`

**Backend Runner:**
- Framework: JUnit 5 (via `spring-boot-starter-test`)
- Config: `sqlive-backend/build.gradle` — `useJUnitPlatform()`
- Coverage: JaCoCo with 50% minimum line coverage enforced
- Reports: XML + HTML at `build/reports/jacoco/`
- Test runtime: `junit-platform-launcher` for Gradle test discovery

**E2E Runner:**
- Framework: Playwright v1.60.0
- Config: `sqlive-frontend/tests/e2e/playwright.config.ts`
- Workers: 4, timeout: 30s, expect timeout: 10s
- Viewport: 1440x900

**Run Commands:**
```bash
npm run test              # Frontend: vitest run
npm run test:watch        # Frontend: vitest (watch mode)
npm run test:e2e          # Frontend: Playwright E2E (starts backend + frontend)
npm run test:e2e:ui       # Frontend: Playwright E2E with UI mode
./gradlew test            # Backend: all tests + JaCoCo report
```

## Test File Organization

**Frontend Location:**
- All unit tests co-located in `src/__tests__/` directory (not alongside source files)
- Naming: `<target>.test.ts` (e.g., `useSqlEngine.test.ts`, `App.test.ts`, `sqlStatements.test.ts`)
- Setup/helpers: `setup.ts` (vitest polyfills), `test-utils.ts` (shared test utilities and setup factories)
- Subdirectory structure mirrors source:

```
src/__tests__/
  setup.ts                              # Vitest setup (monaco-editor polyfill)
  test-utils.ts                         # Shared helpers (mock functions, setup factories)
  App.test.ts                           # Root component mount test
  useSqlEngine.test.ts                  # Core engine composable
  useAiChat.test.ts                     # AI chat composable
  useKnowledgeGraph.test.ts             # Knowledge graph composable
  useDagreLayout.test.ts                # Pure function (dagre layout utility)
  sqlStatements.test.ts                 # Integration-style SQL statement coverage
  aiFormatter.test.ts                   # Pure function (AI response formatter)
  errorDisplay.test.ts                  # Integration-style error state tests
  KnowledgeDetail.test.ts               # Knowledge graph detail component
  KnowledgeNode.test.ts                 # Knowledge graph node component
  KnowledgePanel.test.ts                # Knowledge graph panel component
  LearningCompanion.test.ts             # Learning companion component
  components/
    AiMessageFooter.test.ts             # AI message footer component
    ChartView.test.ts                   # Chart visualization component
    CreateTableModal.test.ts            # Create table modal component
    DataVisualizer.test.ts              # Data visualizer (tabbed view) component
    ErDiagram.test.ts                   # ER diagram component
    HoverPreview.test.ts                # Hover preview component
    ResultTable.test.ts                 # Result table component
    SortFilterToolbar.test.ts           # Sort/filter toolbar component
    TableSection.test.ts                # Individual table display component
    chart/
      chartOptionBuilder.test.ts        # Chart option builder utility
    er/
      ErSearchBar.test.ts               # ER diagram search bar component
  composables/
    useErDiagram.test.ts                # ER diagram composable
    useMultiTabs.test.ts                # Multi-tab composable
    useSortFilter.test.ts               # Sort/filter composable
    useTablePipeline.test.ts            # Table pipeline composable
  utils/
    file.test.ts                        # File import/export utilities
    html.test.ts                        # HTML escaping utilities
    sql.test.ts                         # SQL type utilities
    sse.test.ts                         # SSE stream reader
    sqlStatements.test.ts               # SQL statement parsing utilities
```

**Backend Location:**
- Tests mirror source structure under `src/test/java/`
- Package names match source packages

```
src/test/java/com/douzi/sqlive/
  controller/
    SqlControllerTest.java              # Full integration via RestTemplate
    SqlControllerValidationTest.java    # Validation-specific HTTP tests
    SqlControllerTestSupport.java       # Shared test utilities (HTTP helpers)
    AiControllerTest.java               # AI controller HTTP tests
    KnowledgeControllerTest.java        # Knowledge controller HTTP tests
  service/
    SqlExecutionServiceTest.java        # Full SQL execution with real in-memory SQLite
    ai/
      AiServiceTest.java                # AI service with mocked provider
      OpenAiCompatibleProviderTest.java # Provider HTTP client tests
      PromptBuilderTest.java            # Prompt template builder tests
      ProtocolTest.java                 # Provider protocol adapter tests
    database/
      DatabasePoolManagerTest.java      # Pool lifecycle, eviction, concurrency
    knowledge/
      KnowledgeGraphServiceTest.java    # Knowledge graph loading tests
    metadata/
      MetadataExtractorTest.java        # Schema/metadata extraction tests
    sql/
      SqlParserTest.java                # SQL statement boundary parsing
  exception/
    GlobalExceptionHandlerTest.java     # Exception handler with mocked exceptions
  config/
    RateLimitFilterConcurrencyTest.java # Rate limit filter thread safety test
```

**E2E Test Organization:**
```
tests/e2e/
  fixtures/
    sql-editor.fixture.ts               # Shared fixtures (SqlEditor page object, gotoApp helper)
  specs/
    sql-execution.spec.ts               # Basic SQL execution, table display, metadata
    ai-chat.spec.ts                     # AI chat panel interactions
    create-table.spec.ts                # Create table modal flow
    er-diagram.spec.ts                  # ER diagram display and interaction
    error-handling.spec.ts              # Error display on invalid SQL
    import-export.spec.ts               # Tab import/export functionality
    table-editing.spec.ts               # Inline table cell editing
    tabs.spec.ts                        # Multi-tab management
```

## Test Structure

**Frontend Suite Organization (composable tests):**
```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockSuccess, setupSqlEngine, teardownSqlEngine, tick } from './test-utils'

describe('useSqlEngine', () => {
  let useSqlEngine: SqlEngineSetup['useSqlEngine']
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    const setup = await setupSqlEngine()
    useSqlEngine = setup.useSqlEngine
    fetchSpy = setup.fetchSpy
  })

  afterEach(() => {
    teardownSqlEngine()
  })

  it('should populate db.tables after successful fetch', async () => {
    // test body
  })
})
```

**Frontend Suite Organization (pure utility tests):**
```typescript
import { describe, expect, it } from 'vitest'

describe('readSseStream', () => {
  it('calls onEvent for a single data event', async () => {
    // test body
  })
})
```

**Frontend Suite Organization (component tests):**
```typescript
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import DataVisualizer from '../../components/DataVisualizer.vue'
import { SQL_CONTEXT_KEY } from '../../model/injectionKeys'

describe('DataVisualizer', () => {
  it('renders 6 tab buttons', () => {
    const wrapper = mount(DataVisualizer, {
      global: {
        provide: provideContext(mockDb, defaultHighlight),
        stubs: minimalStubs
      }
    })
    expect(wrapper.text()).toContain('表数据')
  })
})
```

**Backend Suite Organization:**
```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SqlControllerTest {
    @Value("${local.server.port}")
    private int port;
    private final RestTemplate restTemplate = new RestTemplate();

    @Test
    void shouldExecuteSimpleSql() {
        SqlRequest req = new SqlRequest();
        req.setSql("CREATE TABLE t (x INTEGER); INSERT INTO t VALUES (1); SELECT * FROM t;");
        req.setDbName("controller_test");
        req.setReset(true);
        SqlResponse body = post(req);
        assertTrue(body.isSuccess());
        assertEquals(1, body.getData().getTables().size());
    }
}
```

**Service unit test (no Spring context):**
```java
class DatabasePoolManagerTest {
    private final List<DatabasePoolManager> managers = new ArrayList<>();

    @AfterEach
    void cleanup() {
        for (var mgr : managers) {
            try { mgr.cleanup(); } catch (Exception ignored) {}
        }
        managers.clear();
    }

    @Test
    void shouldCreateJdbcTemplateForValidName() {
        var mgr = createManager();
        JdbcTemplate jdbc = mgr.getOrCreateJdbcTemplate("test_db");
        assertNotNull(jdbc);
    }
}
```

**Patterns:**
- `describe` blocks for grouping related tests in frontend; section comments (`// ======`) in backend
- `beforeEach`/`afterEach` for setup/teardown in both frontend and backend
- Descriptive test names starting with `should`: `shouldExecuteSimpleSelect`, `shouldRejectEmptyScript`
- Pure function tests are simplest: no `beforeEach`, no mock setup needed
- Boundary/edge cases grouped after main functionality tests with section headers
- `@Test` methods in backend use `void` return type, assertion-based
- `async`/`await` in frontend tests for debounce and async composable testing

## Mocking

**Frontend Framework:** Manual mocking with `vi.fn()` (Vitest built-in) — no external mocking library

**Frontend Patterns:**

```typescript
// Shared mock helpers in test-utils.ts
export function jsonOk(data: any) {
  return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve(data) })
}
export function mockSuccess(fetchSpy: ReturnType<typeof vi.fn>, data: any) {
  fetchSpy.mockResolvedValue(jsonOk({ success: true, data }))
}
export function mockError(fetchSpy: ReturnType<typeof vi.fn>, message: string, line: number) {
  fetchSpy.mockResolvedValue(jsonOk({ success: false, error: { message, line } }))
}
export function mockReject(fetchSpy: ReturnType<typeof vi.fn>, err: Error) {
  fetchSpy.mockRejectedValue(err)
}
```

- `globalThis.fetch` is replaced with `vi.fn()` in setup helpers
- `vi.useFakeTimers()` for debounce (`useDebounceFn` from `@vueuse/core`) and timeout testing
- `vi.resetModules()` to get fresh module instances (clears cached module state)
- `vi.spyOn(console, 'error').mockImplementation(() => {})` to silence expected error logs
- `vi.restoreAllMocks()` in `afterEach` to clean up spies
- `vi.useRealTimers()` in `afterEach` to restore real timer behavior
- SSE stream responses constructed manually with `TextEncoder` + `getReader` mock
- Component stubs: `stubs: { Splitpanes: { template: '<div><slot /></div>' }, DataVisualizer: true }`
- `provide` for injection keys in component mount tests: `provide: { [SQL_CONTEXT_KEY as symbol]: {...} }`
- Mock localStorage for composable tests: `vi.stubGlobal('localStorage', { getItem, setItem, ... })`
- Matcher functions: `expect.stringContaining()`, `expect.any(Number)` for flexible assertions

**Backend Framework:** Mockito (via `spring-boot-starter-test`)

**Backend Patterns:**
```java
mockProvider = mock(AiProvider.class);
when(mockProvider.getProviderName()).thenReturn("test");
when(mockProvider.complete(anyString(), anyString()))
        .thenReturn("{\"summary\":\"done\"}");
```

- `mock()` for interface/class dependencies
- `when().thenReturn()` for stubbing
- `anyString()`, `anyInt()` for matchers
- No `@Mock` / `@InjectMocks` annotations used — all mocks created manually in `setUp()` methods
- `assertThrows()` for exception assertions
- No Mockito `verify()` calls observed in existing tests

**What to Mock:**
- Frontend: Always mock `fetch` (no real API calls in unit tests). Mock `localStorage` for composables that use `useLocalStorage`.
- Backend: Mock external AI providers (`AiProvider` interface). Mock no database calls — use real in-memory SQLite.
- Never mock the SQLite database in `SqlExecutionServiceTest` — real SQLite execution is the point.

**What NOT to Mock:**
- Frontend: Vue reactivity system, DOM APIs (jsdom provides these), `TextEncoder`/`TextDecoder`
- Backend: SQLite JDBC driver, `JdbcTemplate` for service tests, Spring context for controller tests
- E2E: Nothing is mocked — full stack end-to-end

## Fixtures and Factories

**Frontend Test Data:**
- No separate fixture files — all test data is defined inline in test bodies as plain objects
- Backend response shapes provided directly via `mockSuccess(fetchSpy, { tables: [...] })`
- Component test data is inline `const mockDb: DatabaseModel = { tables: [...], ... }`
- Factory function pattern for reusable mock data:
  ```typescript
  function makeItems(): Item[] {
    return [
      { id: 1, name: 'Alice', count: 10 },
      { id: 2, name: 'Bob', count: 30 },
      { id: 3, name: 'Cathy', count: 20 }
    ]
  }
  ```

**Backend Test Data:**
- Large SQL scripts loaded from external files: `Paths.get("../test-multi-table.sql")` in `SqlExecutionServiceTest`
- Small inline SQL strings defined directly in test methods using Java text blocks (multi-line `"""`)
- In-memory SQLite databases created fresh per test with unique names (`"test_db_1"`, `"test_db_2"`, etc.)

**E2E Test Fixtures:**
- Page object model in `tests/e2e/fixtures/sql-editor.fixture.ts`:
  ```typescript
  export class SqlEditor {
    async click() { ... }
    async type(sql: string) { ... }
    async replaceAll(sql: string) { ... }
    async waitForExecution(timeout = 15_000) { ... }
  }
  ```
- `gotoApp(page)` helper navigates to app root with `/e2e=1` query param
- `test` object extends Playwright base with `sqlEditor` fixture
- `expect` re-exported from `@playwright/test`

## Coverage

**Frontend Requirements:** None enforced (no coverage threshold configured in vitest)

**Backend Requirements:** 50% minimum line coverage (JaCoCo)
- Config in `sqlive-backend/build.gradle`:
  ```gradle
  jacocoTestCoverageVerification {
      violationRules {
          rule {
              limit { minimum = 0.50 }
          }
      }
  }
  ```
- `check.dependsOn jacocoTestCoverageVerification` fails the build if below threshold
- Coverage reports generated at `build/reports/jacoco/html/index.html` and `build/reports/jacoco/test/xml/default.xml`
- JaCoCo configured for XML + HTML output

**View Coverage:**
```bash
./gradlew test         # Runs tests + JaCoCo report
open build/reports/jacoco/html/index.html
```

## Test Types

**Unit Tests (Frontend — pure function):**
- `aiFormatter.test.ts` — 229 lines testing AI response formatting (error analysis, explain, optimize, generate-sql)
- `useDagreLayout.test.ts` — 25 lines testing layout utility
- `src/__tests__/utils/*.test.ts` — utility function tests
- No component rendering, no DOM interaction, no composable lifecycle

**Composable Tests (Frontend):**
- `useSqlEngine.test.ts` — 446 lines: fetch lifecycle, debounce, error handling, mode transitions, rollback
- `useAiChat.test.ts` — 188 lines: SSE streaming, message management, panel toggle, provider error handling
- `useKnowledgeGraph.test.ts` — 221 lines: data fetch, progress tracking, in-progress detection
- `useMultiTabs.test.ts` — tab CRUD operations
- `useSortFilter.test.ts` — sort/filter/paginate logic
- `useTablePipeline.test.ts` — table data pipeline integration
- `useErDiagram.test.ts` — ER diagram state building

**Integration-style Tests (Frontend — composable + mock API):**
- `sqlStatements.test.ts` — 2166 lines: full SQL DDL/DML/DQL/CTE/window function coverage through composable
- `errorDisplay.test.ts` — 106 lines: error state with multi-statement script execution
- These use `setupSqlEngine()` helper which creates a real composable instance with mocked fetch
- Pattern: setup composable, call methods, assert on reactive refs

**Component Tests (Frontend):**
- `App.test.ts` — Mount with full stubs (`Splitpanes`, `Pane`, all child components) and provide contexts
- `DataVisualizer.test.ts` — Tab rendering, metadata display, `provide` context with mock `DatabaseModel`
- `TableSection.test.ts`, `ResultTable.test.ts`, `ChartView.test.ts`, `CreateTableModal.test.ts`
- `ErDiagram.test.ts`, `ErSearchBar.test.ts` — ER diagram components
- Pattern: `mount(Component, { global: { stubs: {...}, provide: {...} } })`
- `provide` used for injection keys (`SQL_CONTEXT_KEY`, `AI_ACTIONS_KEY`)
- Minimal stubs: child components stubbed with `true` or simple templates

**Integration Tests (Backend):**
- `SqlControllerTest.java` — `@SpringBootTest(webEnvironment = RANDOM_PORT)`, full HTTP calls via `RestTemplate`
- `SqlControllerValidationTest.java` — Validation-specific HTTP tests (null/empty/blank SQL, valid SQL)
- `AiControllerTest.java`, `KnowledgeControllerTest.java` — Controller-level HTTP tests
- Test databases are isolated by name, real SQLite in-memory execution
- Helper: `SqlControllerTestSupport.java` provides `url()`, `jsonHeaders()`, `postForBody()`, `postForEntity()`

**Service Unit Tests (Backend):**
- `SqlExecutionServiceTest.java` — 982 lines: Tests real SQL execution with in-memory SQLite databases
  - Loads external SQL fixture: `Paths.get("../test-multi-table.sql")`
  - Tests DDL creation, DML inserts, SELECT queries, error handling, concurrent execution
  - Uses `CountDownLatch` + `ExecutorService` for concurrency tests
- `AiServiceTest.java` — 167 lines: Tests AI service with `mock(AiProvider.class)`
- `SqlParserTest.java` — ~200 lines: Statement boundary parsing with quotes, comments, BEGIN/END, CASE/END
- `DatabasePoolManagerTest.java` — Pool creation, reuse, eviction, name validation, concurrency
- `OpenAiCompatibleProviderTest.java`, `PromptBuilderTest.java`, `ProtocolTest.java` — AI detail tests
- `MetadataExtractorTest.java` — Schema extraction from real SQLite
- `KnowledgeGraphServiceTest.java` — Knowledge graph JSON loading
- `RateLimitFilterConcurrencyTest.java` — Thread safety test for rate limiter

**Exception Handler Test:**
- `GlobalExceptionHandlerTest.java` — 66 lines: Tests `AiProviderException` and `MethodArgumentNotValidException` paths with mocked exceptions and `MockHttpServletResponse`

**E2E Tests (Frontend):**
- 8 spec files, all in `tests/e2e/specs/`
- `sql-execution.spec.ts` — loads default SQL, verifies tables, columns, metadata, tabs, SELECT queries, auto-execute debounce
- `ai-chat.spec.ts` — AI panel open/send/response
- `create-table.spec.ts` — creates table via modal
- `er-diagram.spec.ts` — ER diagram interactions
- `error-handling.spec.ts` — invalid SQL error display, rollback behavior
- `import-export.spec.ts` — SQL file import and export
- `table-editing.spec.ts` — inline cell edits, row operations
- `tabs.spec.ts` — multi-tab add/close/rename
- Auto-starts backend (`./gradlew bootRun`) and frontend (`npm run dev`) via `webServer` config
- `webServer` reuseExistingServer: true (avoids restarting on repeated runs)
- Backend health check: `http://localhost:8080/health`
- Browser: Chrome only (no cross-browser)
- Pattern: `gotoApp(page)` -> interact -> `expect(...).toBeVisible()`

## Common Patterns

**Async Testing (Frontend — debounce):**
```typescript
// Using fake timers + async advancement
it('should debounce rapid user typing to a single call', async () => {
  mockSuccess(fetchSpy, { tables: [] })
  const engine = useSqlEngine()
  await tick()  // await vi.advanceTimersByTimeAsync(150)

  const callCount = fetchSpy.mock.calls.length
  engine.code.value = `${engine.code.value}\n-- a`
  engine.code.value = `${engine.code.value}\n-- b`
  engine.code.value = `${engine.code.value}\n-- c`

  await vi.advanceTimersByTimeAsync(50)
  expect(fetchSpy.mock.calls.length).toBe(callCount)

  await vi.advanceTimersByTimeAsync(100)
  expect(fetchSpy.mock.calls.length).toBe(callCount + 1)
})
```

**Setup/Teardown Pattern:**
```typescript
// test-utils.ts — shared setup factory
export async function setupSqlEngine(): Promise<SqlEngineSetup> {
  vi.useFakeTimers()
  const fetchSpy = vi.fn()
  globalThis.fetch = fetchSpy as any
  vi.resetModules()
  const mod = await import('../composables/useSqlEngine')
  return { useSqlEngine: mod.useSqlEngine, fetchSpy }
}

export function teardownSqlEngine() {
  vi.useRealTimers()
  vi.restoreAllMocks()
}
```

**Stream Mocking (Frontend — for AI SSE tests):**
```typescript
function mockStreamResponse(chunks: string[]) {
  const encoder = new TextEncoder()
  let chunkIndex = 0
  fetchSpy.mockResolvedValue({
    ok: true, status: 200,
    body: {
      getReader: () => ({
        read: () => {
          if (chunkIndex >= chunks.length)
            return Promise.resolve({ done: true, value: undefined })
          const data = chunks[chunkIndex++]
          return Promise.resolve({ done: false, value: encoder.encode(data) })
        }
      })
    }
  })
}
```

**Error Testing (Frontend):**
```typescript
it('should set error on network failure', async () => {
  mockReject(fetchSpy, new Error('Connection refused'))
  vi.spyOn(console, 'error').mockImplementation(() => {})

  const engine = useSqlEngine()
  await tick()

  expect(console.error).toHaveBeenCalledTimes(1)
  expect(engine.executionError.value).toBeTruthy()
  expect(engine.executionError.value.line).toBe(0)
})
```

**Component Provide/Stub Pattern:**
```typescript
function provideContext(db: DatabaseModel, highlight: HighlightState) {
  return { [SQL_CONTEXT_KEY as symbol]: { db, highlight } }
}

const minimalStubs = {
  ErDiagram: true,
  ChartView: true,
  CreateTableModal: true
}

const wrapper = mount(DataVisualizer, {
  global: {
    provide: provideContext(mockDb, defaultHighlight),
    stubs: minimalStubs
  }
})
```

**Concurrency Testing (Backend):**
```java
@Test
void shouldHandleConcurrentRequestsOnDifferentDatabases() throws Exception {
    int threadCount = 4;
    CountDownLatch latch = new CountDownLatch(threadCount);
    List<Exception> errors = Collections.synchronizedList(new ArrayList<>());

    try (ExecutorService executor = Executors.newFixedThreadPool(threadCount)) {
        for (int i = 0; i < threadCount; i++) {
            final int n = i;
            executor.submit(() -> {
                try {
                    SqlResponse r = service.execute("SELECT 1;", "concurrent_db_" + n, true);
                    assertTrue(r.isSuccess());
                } catch (Exception e) { errors.add(e); }
                finally { latch.countDown(); }
            });
        }
        assertTrue(latch.await(10, TimeUnit.SECONDS));
        assertTrue(errors.isEmpty());
    }
}
```

**Section Organization (Backend frontend tests):**
```java
// Frontend (in test files):
// ============================================================
//  DDL — CREATE TABLE
// ============================================================

// Backend (in test files):
// ============================================================
//  Sanity checks
// ============================================================

// Frontend boundary/edge sections:
// --- Boundary and edge case tests ---
```

**Controller test support (Backend):**
```java
public final class SqlControllerTestSupport {
    public static String url(int port) {
        return "http://localhost:" + port + "/api/execute";
    }
    public static SqlResponse postForBody(RestTemplate restTemplate, int port, SqlRequest req) {
        HttpEntity<SqlRequest> entity = new HttpEntity<>(req, jsonHeaders());
        try {
            ResponseEntity<SqlResponse> resp = restTemplate.exchange(
                    url(port), HttpMethod.POST, entity, SqlResponse.class);
            return resp.getBody();
        } catch (HttpClientErrorException e) {
            return e.getResponseBodyAs(SqlResponse.class);
        }
    }
}
```

## Key Test Files

| File | Type | Lines | What It Tests |
|------|------|-------|---------------|
| `src/__tests__/sqlStatements.test.ts` | Integration-style | 2166 | Full SQL DDL/DML/DQL/CTE/window coverage through composable |
| `src/__tests__/useSqlEngine.test.ts` | Composable unit | 446 | Core engine: fetch, debounce, highlight, error, rollback |
| `src/__tests__/useAiChat.test.ts` | Composable unit | 188 | AI chat: SSE streaming, message management, error handling |
| `src/__tests__/useKnowledgeGraph.test.ts` | Composable unit | 221 | Knowledge graph: fetch, progress, in-progress detection |
| `src/__tests__/aiFormatter.test.ts` | Pure function unit | 229 | Error/explain/optimize/generate-sql formatting functions |
| `src/__tests__/errorDisplay.test.ts` | Integration-style | 106 | Error state with multi-statement scripts |
| `src/__tests__/useDagreLayout.test.ts` | Pure function unit | 25 | Dagre layout utility |
| `src/__tests__/components/DataVisualizer.test.ts` | Component | ~80 | Tab rendering, metadata display |
| `src/__tests__/composables/useSortFilter.test.ts` | Composable unit | ~120 | Sort/filter/paginate reactive logic |
| `SqlExecutionServiceTest.java` | Service unit | 982 | Full SQL execution with real in-memory SQLite |
| `SqlControllerTest.java` | Integration | 110 | HTTP-level controller tests with `RestTemplate` |
| `SqlControllerValidationTest.java` | Integration | 74 | Validation-specific HTTP tests |
| `SqlParserTest.java` | Unit | ~200 | SQL statement boundary parsing |
| `AiServiceTest.java` | Unit | 167 | AI service with mocked provider |
| `DatabasePoolManagerTest.java` | Unit | ~130 | Pool lifecycle, eviction, concurrency |
| `GlobalExceptionHandlerTest.java` | Unit | 66 | Exception handler coverage |
| `tests/e2e/specs/sql-execution.spec.ts` | E2E | 67 | Full-stack: SQL execution lifecycle |

---

*Testing analysis: 2026-05-30*
