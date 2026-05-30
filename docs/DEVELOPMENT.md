<!-- generated-by: gsd-doc-writer -->

# Development

This document covers local development setup, build commands, code style, and contribution workflow for the SQLive project.

---

## Local setup

SQLive is a two-part application: a Vue 3 + TypeScript frontend and a Spring Boot 4 backend. Both must be running for full functionality.

### Prerequisites

- **JDK 21** (recommended: Zulu JDK 21 at `C:\Program Files\Zulu\zulu-21`)
- **Node.js 18+** (LTS recommended)
- **npm 9+**

### Backend setup

```bash
cd sqlive-backend

# Windows
set JAVA_HOME=C:\Program Files\Zulu\zulu-21
gradlew.bat bootRun

# Linux / macOS
./gradlew bootRun
```

The backend starts on `http://localhost:8080`. No additional configuration is needed for the SQL execution feature. AI features require setting `DEEPSEEK_API_KEY` (or configuring another provider) in `application.yml`.

### Frontend setup

```bash
cd sqlive-frontend

# Install dependencies (first time or after pulling)
npm install

# Copy environment file (optional; defaults proxy to localhost:8080)
cp .env.example .env   # if .env.example exists

# Start dev server
npm run dev
```

The frontend dev server starts on `http://localhost:5173` with API requests automatically proxied to `http://localhost:8080`.

### Environment variables (frontend)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `/api/execute` | SQL execution endpoint |
| `VITE_AI_API_URL` | `/api/ai` | AI chat endpoint |
| `VITE_KNOWLEDGE_API_URL` | `/api/knowledge` | Knowledge graph endpoint |

See `sqlive-frontend/src/config.ts` for how these are consumed. See `sqlive-frontend/.env` for local development values.

---

## Build commands

### Frontend (`sqlive-frontend/package.json`)

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server with hot reload (--host) |
| `npm run build` | Type check with vue-tsc then build with Vite |
| `npm run preview` | Preview the production build locally |
| `npm run test` | Run all Vitest unit tests |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:e2e` | Run Playwright end-to-end tests (headless) |
| `npm run test:e2e:ui` | Run Playwright E2E tests with interactive UI mode |

### Backend (Gradle)

| Command | Description |
|---|---|
| `./gradlew bootRun` | Start Spring Boot application on port 8080 |
| `./gradlew test` | Run JUnit 5 tests with JaCoCo coverage |
| `./gradlew build` | Full build including compilation, tests, and checks |
| `./gradlew spotlessApply` | Apply Spotless code formatting |
| `./gradlew jacocoTestCoverageVerification` | Verify coverage meets 50% minimum threshold |
| `./gradlew clean` | Clean build artifacts |

### Common workflows

**Full test run (both sides):**

```bash
# Frontend
cd sqlive-frontend && npm run test

# Backend
cd sqlive-backend && ./gradlew test
```

---

## Code style

### Frontend: Biome

The frontend uses **Biome** for both linting and formatting, configured in `sqlive-frontend/biome.json` (schema `2.4.16`).

- **Formatter**: space indentation, 2 spaces, 120 character line width
- **Linter**: recommended rules enabled
  - `noUnusedVariables` — error
  - `noUnusedImports` — error
  - `noConsole` — warn (allows `console.log`)
- **JavaScript style**: single quotes, no semicolons (`asNeeded`), no trailing commas
- **Target files**: `src/**/*.ts`, `src/**/*.vue`, `src/**/*.json` (excludes `node_modules`, `dist`)

Install Biome (if not already available):

```bash
cd sqlive-frontend
npm install -D @biomejs/biome
```

Run formatting and linting:

```bash
npx @biomejs/biome check src/        # Check lint issues
npx @biomejs/biome format --write src/  # Auto-format
npx @biomejs/biome lint --fix src/      # Auto-fix lint issues
```

There is no ESLint or Prettier configuration — Biome replaces both.

### Backend: Spotless (Google Java Format)

The backend uses **Spotless** with Google Java Format, configured in `config/spotless.gradle`.

- **Java**: Google Java Format, unused imports removal, trailing whitespace trim, trailing newline
- **Gradle scripts**: Greclipse formatting, trailing whitespace trim, trailing newline
- **Misc files** (`*.md`, `*.json`, `*.yml`, `*.yaml`): trailing whitespace trim, trailing newline

```bash
cd sqlive-backend
./gradlew spotlessApply   # Apply formatting
./gradlew spotlessCheck   # Check formatting only (part of check task)
```

Code formatting is enforced in CI — `check.dependsOn jacocoTestCoverageVerification` also includes Spotless checks.

---

## Branch conventions

| Convention | Detail |
|---|---|
| Default branch | `master` |
| Active development branch | `future` |
| Remote | `github` (origin) |
| Branch naming | No formal convention documented; commit messages follow conventional commits |

Commit messages follow a structured prefix convention visible in the git history:

| Prefix | Meaning |
|---|---|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `test:` | Test additions or changes |
| `docs:` | Documentation changes |

Branch scope identifiers (e.g., `feat(scope):`) are used to indicate the area of change where applicable.

---

## PR process

No formal PR template or review checklist has been established for this project. When submitting a pull request, follow these general guidelines:

1. **Target the correct branch**: most feature work targets the `future` branch; `master` is the stable release branch.
2. **Keep commits focused**: prefer small, single-purpose commits with clear conventional commit messages.
3. **Run tests before submitting**: ensure `npm run test` (frontend) and `./gradlew test` (backend) pass.
4. **Run code formatting**: apply `npx @biomejs/biome format --write src/` (frontend) and `./gradlew spotlessApply` (backend).
5. **Describe the change**: include a summary of what changed and why, plus any relevant context.
6. **Link related issues**: if the PR addresses a GitHub issue, reference it in the description.

---

## Related documentation

- [Getting Started](GETTING-STARTED.md) — prerequisites and first run instructions
- [Testing](TESTING.md) — test framework, running tests, and writing new tests
- [Architecture](ARCHITECTURE.md) — system overview and component diagram
- [Configuration](CONFIGURATION.md) — environment variables and config file reference
- [CLAUDE.md](../CLAUDE.md) — project-level conventions and gotchas
