<!-- generated-by: gsd-doc-writer -->

# Development

## Local setup

Sqlive has two runtimes that must be set up independently.

**Prerequisites:** Node.js LTS (>= 22), Java 21 JDK (Zulu JDK recommended), npm.

### 1. Clone and install

```bash
git clone <repo-url>
cd sqlive
```

### 2. Frontend setup

```bash
cd sqlive-frontend
npm install
```

### 3. Backend setup

The backend is a Gradle project. The Gradle wrapper handles its own installation.

```bash
cd sqlive-backend
./gradlew build
```

### 4. Start both runtimes

In two separate terminals:

```bash
# Terminal 1: backend (port 8080)
cd sqlive-backend
./gradlew bootRun
```

```bash
# Terminal 2: frontend (Vite dev server, proxies /api to :8080)
cd sqlive-frontend
npm run dev
```

Open the URL printed by Vite (typically `http://localhost:5173`).

## Build commands

All commands are run from `sqlive-frontend/` unless otherwise noted.

| Command | Runtime | Description |
|---|---|---|
| `npm run dev` | Frontend | Start Vite dev server with hot reload |
| `npm run build` | Frontend | Type-check with `vue-tsc` then production build with Vite |
| `npm run preview` | Frontend | Preview the production build locally |
| `npm run test` | Frontend | Run vitest unit tests once |
| `npm run test:watch` | Frontend | Run vitest in watch mode |
| `npm run test:e2e` | Frontend | Run Playwright end-to-end tests |
| `npm run test:e2e:ui` | Frontend | Run Playwright end-to-end tests with UI |
| `./gradlew bootRun` | Backend | Start Spring Boot application on port 8080 |
| `./gradlew test` | Backend | Run JUnit 5 backend tests with JaCoCo coverage |
| `./gradlew build` | Backend | Compile, test, and package the backend |

## Code style

A Biome configuration file exists at `sqlive-frontend/biome.json`, though Biome is not installed as an npm dependency.

- **Formatter:** 2-space indentation, single quotes, no semicolons, trailing commas disabled, 120-character line width.
- **Linter:** Recommended ruleset with additional strictness -- unused variables and unused imports are errors, `console.log` is explicitly allowed (exempted via `noConsole.allow`).

Biome runs on all `.ts`, `.vue`, and `.json` files under `sqlive-frontend/src/`, excluding `node_modules` and `dist`.

To run Biome manually (install it first with `npm install --save-dev @biomejs/biome`):

```bash
cd sqlive-frontend
npx biome check --write src/
```

The backend has no configured linter or formatter (no Checkstyle or Spotless in `build.gradle`).

## Branch conventions

No branch naming convention is documented in the repository. The default branch is `master`.

## PR process

No pull request template or CI workflow is configured in this repository. When contributing:

- Ensure all tests pass before submitting: `npm run test` (frontend) and `./gradlew test` (backend).
- Follow the existing code style enforced by Biome for the frontend.
- Keep changes minimal and focused -- address one concern per pull request.
