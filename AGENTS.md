# Repository Guidelines

## Project Structure & Module Organization

SQLive is a SQL playground with AI assistance. `sqlive-frontend/src/` contains Vue/TypeScript components, `composables/`, `utils/`, and models. Unit tests live in `src/__tests__/`; Playwright specs live in `tests/e2e/specs/`. Backend Java code lives in `sqlive-backend/src/main/java/com/douzi/sqlive/`, with tests under `src/test/java/` and configuration/assets under `src/main/resources/`. Consult `docs/` for architecture, configuration, and operations; screenshots are in `screenshots/`.

## Build, Test, and Development Commands

Use Node.js LTS, pnpm 12.6.0, and JDK 25. On Windows, use `pwsh`.

From `sqlive-frontend/`:

- `pnpm install --frozen-lockfile`: install locked dependencies.
- `pnpm dev`: start Vite on port 5173.
- `pnpm build`: check types with the TypeScript 7 Go engine, then produce `dist/`; `pnpm typecheck` runs the same checks alone (vue-tsc uses typescript-native-bridge for Vue SFCs, native TypeScript 7 checks Vite/E2E).
- `pnpm lint` / `pnpm format:check`: run oxlint / oxfmt checks.
- `pnpm test`: run Vitest.
- `pnpm test:e2e`: run Playwright against installed Chrome and Edge; starts both services.

From `sqlive-backend/`, use `.\gradlew.bat bootRun` to serve port 8080, `.\gradlew.bat test` for tests, and `.\gradlew.bat build` to test/package. On Unix, use `./gradlew`.

## Coding Style & Naming Conventions

Frontend formatting uses four spaces, single quotes, no semicolons, no trailing commas, and LF endings. Use PascalCase for Vue components, `useXxx.ts` for composables, and camelCase for functions/variables. Java uses PascalCase classes and camelCase methods; match adjacent indentation. Keep changes focused; avoid repository-wide formatting churn.

## Testing Guidelines

Add regression tests for changed behavior. Name frontend unit tests `*.test.ts`, browser tests `*.spec.ts`, and backend tests `*Test.java` or existing Spring test conventions. Vitest uses jsdom; backend tests use JUnit/Mockito.

Configured frontend coverage minimums are 98% statements/functions/lines and 91% branches. Enable coverage explicitly with `pnpm exec vitest run --coverage`; the provider matches Vitest. Backend's 98% line/branch JaCoCo gate runs with `.\gradlew.bat build -Pjacoco=true` on JDK 25. Ordinary test commands do not enforce coverage gates. See `docs/TESTING.md`.

## Commit & Pull Request Guidelines

Follow history: `fix:`, `refactor(frontend):`, `test(backend):`, or `chore:` plus a concise imperative summary. PRs should describe behavior, link relevant issues, list checks/results and unverified areas, and include screenshots for UI changes.

## Configuration & Agent Workflow

Keep API keys in environment variables and local overrides in ignored `local-tweaks.yml`; never commit secrets. Read `docs/DEVELOPMENT.md#当前焦点` for planning guidance. Local `.planning/` state is ignored and may be absent from fresh clones. Preserve unrelated working-tree changes.
