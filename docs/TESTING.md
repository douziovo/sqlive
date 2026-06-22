<!-- generated-by: gsd-doc-writer -->

# Testing

Sqlive uses Vitest for frontend unit/component tests, Playwright for end-to-end tests, and JUnit 5 for backend tests.

## Test frameworks and setup

| Layer | Framework | Version | Test directory | Environment |
|---|---|---|---|---|
| Frontend (unit/component) | [Vitest](https://vitest.dev) | ^4.1.6 | `sqlive-frontend/src/__tests__/` | jsdom |
| Frontend (e2e) | [Playwright](https://playwright.dev) | ^1.60.0 | `sqlive-frontend/tests/e2e/specs/` | Chrome |
| Backend | JUnit 5 + Spring Boot Test | (Spring Boot 4.0.6) | `sqlive-backend/src/test/java/` | JVM |

**Frontend test setup:** The Vitest configuration is embedded in `sqlive-frontend/vite.config.ts` (`test` block). It uses jsdom for DOM emulation and loads a global setup file at `sqlive-frontend/src/__tests__/setup.ts` which polyfills `document.queryCommandSupported` -- required by Monaco Editor's ESM initialization.

**Backend test setup:** `@SpringBootTest` integration tests load the main `src/main/resources/application.yml` for configuration. Unit tests (e.g., `SqlExecutionServiceTest`) instantiate dependencies directly without Spring context. The `src/test/resources/` directory contains test fixtures such as `knowledge-graph.json`. JaCoCo is configured in `sqlive-backend/build.gradle` for code coverage reporting.

## Running tests

### Frontend unit tests

```bash
# Run all unit/component tests (33 files, 528 tests)
cd sqlive-frontend
npm run test

# Watch mode (re-run on file changes)
npm run test:watch

# Run a specific test file
npx vitest run src/__tests__/useSqlEngine.test.ts

# Run tests matching a pattern
npx vitest run -t "updateRow"
```

### Frontend end-to-end tests

E2E tests require both the backend and frontend servers running. Playwright auto-starts them via the `webServer` block in `tests/e2e/playwright.config.ts`.

```bash
cd sqlive-frontend

# Run all e2e tests (requires backend on :8080 and frontend on :5173)
npm run test:e2e

# Interactive UI mode
npm run test:e2e:ui
```

### Backend tests

```bash
# Run all backend tests (JUnit 5 via Gradle)
cd sqlive-backend
./gradlew test

# Run JaCoCo coverage report (auto-runs after test)
./gradlew jacocoTestReport

# Run coverage verification (enforces 50% minimum)
./gradlew jacocoTestCoverageVerification
```

## Writing new tests

### Frontend (Vitest)

- **File naming:** `*.test.ts` files placed in `sqlive-frontend/src/__tests__/` or subdirectories mirroring `src/` structure.
- **Test utilities:** Vue Test Utils (`@vue/test-utils`) is used for component mounting. Use `vitest` globals (`describe`, `it`, `expect`, `vi`) which are enabled in the config.
- **Mocking:** Use `vi.mock()` for module mocking. The `jsdom` environment provides a browser-like DOM. For Monaco-dependent tests, the setup file handles the `queryCommandSupported` polyfill. ECharts mocks are set up per-test-file as needed.
- **Coverage:** No coverage thresholds are configured in Vitest. To generate a coverage report, run `npx vitest run --coverage`.

### Frontend (Playwright e2e)

- **File naming:** `*.spec.ts` files in `sqlive-frontend/tests/e2e/specs/`.
- **Fixtures:** Shared page fixtures are in `tests/e2e/fixtures/`.
- **Config:** `tests/e2e/playwright.config.ts` -- uses Chrome channel, 4 workers, 30s test timeout.

### Backend (JUnit 5)

- **File naming:** `*Test.java` files in `sqlive-backend/src/test/java/`, mirroring the main source package structure under `com.douzi.sqlive`.
- **Test annotations:** Standard JUnit 5 annotations (`@Test`, `@BeforeEach`, `@AfterEach`, `@BeforeAll`, `@AfterAll`, `@SpringBootTest`). Integration tests use `@SpringBootTest`; unit tests use direct constructor-based instantiation.
- **Lombok:** The `testCompileOnly` and `testAnnotationProcessor` Gradle configs make Lombok available in test sources.

## Coverage requirements

### Backend (JaCoCo)

Enforced by `jacocoTestCoverageVerification` in `build.gradle`:

| Type | Threshold |
|---|---|
| Overall instruction coverage | 50% minimum |

Reports are generated in XML and HTML formats after each `./gradlew test` run.

### Frontend (Vitest)

No coverage threshold is currently configured. Coverage can be generated on demand with `npx vitest run --coverage`.

## CI integration

No CI/CD workflows are detected in the repository (no `.github/workflows/` directory exists). Tests are run locally during development. <!-- VERIFY: CI/CD pipeline status -- no workflows directory found at time of writing -->
