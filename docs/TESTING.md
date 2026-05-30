<!-- generated-by: gsd-doc-writer -->
# Testing

Sqlive uses a three-tier testing strategy: **unit / integration tests** (Vitest for the frontend, JUnit 5 with Spring Boot for the backend) and **end-to-end tests** (Playwright).

---

## Frontend: Vitest

### Framework and setup

The frontend uses [Vitest](https://vitest.dev/) v4.1.6 with the following configuration (defined in `vite.config.ts`):

| Setting | Value |
|---|---|
| Environment | `jsdom` |
| Globals | `true` |
| Setup file | `src/__tests__/setup.ts` |
| Excluded | `tests/e2e/**`, `node_modules/**` |

The setup file (`src/__tests__/setup.ts`) polyfills `document.queryCommandSupported` which Monaco Editor calls during ESM module initialisation.

### Running tests

```bash
# Run all tests once
npm run test

# Run tests in watch mode (useful during development)
npm run test:watch
```

All test files live under `src/__tests__/` and use the `*.test.ts` naming convention.

### Writing new tests

**File naming:** Place new test files inside `src/__tests__/` and use the `.test.ts` suffix. Mirror the source module's path:

- `src/composables/useSqlEngine.ts` -> `src/__tests__/useSqlEngine.test.ts`
- `src/utils/sql.ts` -> `src/__tests__/utils/sql.test.ts`
- `src/components/DataVisualizer.vue` -> `src/__tests__/components/DataVisualizer.test.ts`

**Test helpers:** A shared utility module at `src/__tests__/test-utils.ts` provides:

- `setupSqlEngine()` / `teardownSqlEngine()` -- Prepares a fake timer + mock `fetch` environment for `useSqlEngine` tests. Returns the composable factory and the fetch spy.
- `setupAiChat()` -- Same pattern for `useAiChat`, including a fake `localStorage` stub.
- `mockSuccess(fetchSpy, data)` / `mockError(fetchSpy, message, line)` / `mockReject(fetchSpy, err)` -- Shorthand response stubs.
- `tick(ms)` -- Advances fake timers by the given milliseconds (default 150).
- `API_URL` -- The endpoint constant (`http://localhost:8080/api/execute`).

**Pattern:** Tests run via `describe` / `it` blocks. Use `beforeEach` to initialise the composable under test and `afterEach` to restore real timers and mocks:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupSqlEngine, teardownSqlEngine, mockSuccess, tick } from './test-utils'

describe('myFeature', () => {
  beforeEach(async () => {
    const setup = await setupSqlEngine()
    // use setup.useSqlEngine and setup.fetchSpy
  })
  afterEach(() => { teardownSqlEngine() })
  // ...
})
```

### Coverage requirements

No coverage threshold is configured for frontend tests. Vitest does not report coverage by default because no `coverage` key is present in the test configuration.

---

## End-to-end: Playwright

### Framework and setup

E2E tests use [Playwright](https://playwright.dev/) v1.60.0 (configured at `tests/e2e/playwright.config.ts`):

| Setting | Value |
|---|---|
| Test directory | `tests/e2e/specs/` |
| Test pattern | `**/*.spec.ts` |
| Workers | 4 |
| Test timeout | 30 s |
| Expect timeout | 10 s |
| Viewport | 1440 x 900 |
| Browser | Chrome (via `channel: 'chrome'`) |

The Playwright config starts two web servers before running:

1. **Backend** -- `./gradlew bootRun` on port `8080`, health-checked at `/health` (180 s timeout).
2. **Frontend** -- `npm run dev` on port `5173` (Vite dev server).

The `reuseExistingServer: true` flag allows keeping servers running across test runs for faster iteration.

### Running E2E tests

```bash
# Run all E2E specs headlessly
npm run test:e2e

# Run with Playwright UI mode (interactive browser + timeline)
npm run test:e2e:ui
```

### Fixtures and conventions

A custom fixture at `tests/e2e/fixtures/sql-editor.fixture.ts` provides:

- `gotoApp(page)` -- Navigates to `/?e2e=1` and waits for `#table-departments` to appear (auto-execution complete signal).
- `SqlEditor` helper class -- Wraps the Monaco editor with `type()`, `replaceAll()`, `getText()`, and `waitForExecution()`.

Tests load the app with `?e2e=1` query parameter, which may suppress onboarding modals or tutorial overlays.

### Writing new E2E tests

Create a new spec file in `tests/e2e/specs/` with the `.spec.ts` extension. Use the fixture's `test` and `expect` exports:

```typescript
import { test, expect, gotoApp } from '../fixtures/sql-editor.fixture';

test('my scenario', async ({ page }) => {
  await gotoApp(page);
  // ... page interactions and assertions
});
```

**Existing specs** cover: SQL execution, table editing, AI chat, create-table modal, error handling, ER diagram, import/export, and tab management (8 spec files total).

---

## Backend: JUnit 5 with Spring Boot

### Framework and setup

Backend tests use **JUnit 5** (via `spring-boot-starter-test`) with the **JaCoCo** code coverage plugin. Tests run under **Gradle**:

| Setting | Value |
|---|---|
| Test framework | JUnit 5 (Platform Launcher) |
| Coverage tool | JaCoCo |
| Coverage threshold | 50% minimum instruction coverage (enforced by `jacocoTestCoverageVerification`) |
| Java version | 21 |

### Running backend tests

```bash
# Run all backend tests
./gradlew test

# Run a single test class
./gradlew test --tests "com.douzi.sqlive.service.sql.SqlParserTest"

# Re-run tests without re-building
./gradlew test --rerun-tasks
```

Test reports (XML + HTML) are generated by JaCoCo at `build/reports/jacoco/`. The Gradle `check` task depends on `jacocoTestCoverageVerification`, so a build fails if overall coverage drops below 50%.

### Writing new tests

**File naming:** Place test classes in `src/test/java/com/douzi/sqlive/` mirroring the source package. Use the `*Test.java` naming convention (e.g., `SqlParserTest.java`).

**Test types:**

- **Unit tests** -- Directly instantiate the service class and call its methods (e.g., `SqlParserTest`, `AiServiceTest`, `KnowledgeGraphServiceTest`). No Spring context needed.
- **Integration tests** -- Annotated with `@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)` to start the full application context on a random port (e.g., `SqlControllerTest`, `SqlControllerValidationTest`). Use `RestTemplate` to send HTTP requests.
- **Concurrency tests** -- Verify thread-safety of shared resources (e.g., `RateLimitFilterConcurrencyTest`).

**Helpers:** `SqlControllerTestSupport` provides static utility methods for constructing HTTP requests to the `POST /api/execute` endpoint (`url()`, `jsonHeaders()`, `postForBody()`, `postForEntity()`).

**Database isolation:** Each integration test uses a unique `dbName` (e.g., `"controller_test"`, `"error_ctrl_test"`) to avoid cross-test interference in the shared in-memory SQLite cache (`ConcurrentHashMap<String, JdbcTemplate>`).

**Multi-statement fixture:** Some backend tests reference `test-multi-table.sql` (located at the project root) for full-script execution scenarios. The file is loaded in `@BeforeAll` via `Files.readString()`.

### Structure of backend test classes

| Class | Type | What it tests |
|---|---|---|
| `SqlParserTest` | Unit | Statement boundary detection, quote/depth tracking, line number reporting |
| `SqlExecutionServiceTest` | Unit + fixture | Full SQL execution pipeline, DDL/DML verification, concurrency |
| `SqlControllerTest` | Integration | HTTP endpoint, success/error responses, table metadata |
| `SqlControllerValidationTest` | Integration | Request validation (null/empty SQL, missing fields) |
| `GlobalExceptionHandlerTest` | Unit | Error response format, HTTP status codes |
| `AiControllerTest` | Integration | AI chat endpoint |
| `AiServiceTest` | Unit | AI provider chain, prompt building |
| `PromptBuilderTest` | Unit | System prompt construction |
| `OpenAiCompatibleProviderTest` | Unit | OpenAI-compatible provider adapter |
| `ProtocolTest` | Unit | AI protocol handling |
| `KnowledgeGraphServiceTest` | Unit | Knowledge graph extraction and classification |
| `MetadataExtractorTest` | Unit | SQLite metadata collection |
| `DatabasePoolManagerTest` | Unit | Database pool lifecycle, eviction, concurrent access |
| `RateLimitFilterConcurrencyTest` | Concurrency | Thread-safety of rate limiting |

---

## CI integration

No CI workflow configuration was detected in the repository. Tests are currently run manually via the commands above.
