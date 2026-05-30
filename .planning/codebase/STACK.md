# Technology Stack

**Analysis Date:** 2026-05-30

## Languages

**Primary:**
- Java 21 (Zulu JDK 21) - Backend at `sqlive-backend/src/main/java/`
- TypeScript 6.0.3 - Frontend at `sqlive-frontend/src/`

**Secondary:**
- SQL (SQLite dialect) - In-memory database playground, schemas extracted via `sqlite_master`

## Runtime

**Environment:**
- JVM (Zulu JDK 21, path `C:\Program Files\Zulu\zulu-21\bin\`) for backend
- Node.js (LTS) for frontend dev toolchain

**Package Manager:**
- Gradle 9.2.1 (via `./gradlew` wrapper at `sqlive-backend/gradle/wrapper/gradle-wrapper.properties`) - Backend dependency management
- npm - Frontend dependency management
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Spring Boot 4.0.6 - Backend web framework (`sqlive-backend/build.gradle`)
- Vue 3.5.34 - Frontend SPA framework (`sqlive-frontend/package.json`), Composition API with `<script setup>`

**Testing:**
- Vitest 4.1.6 - Frontend unit test runner (configured in `vite.config.ts`)
- `@vue/test-utils` 2.4.10 - Vue component test utilities
- JUnit Platform - Backend test runner (via `spring-boot-starter-test`)
- Playwright 1.60.0 - Frontend E2E tests (`sqlive-frontend/tests/e2e/playwright.config.ts`)
- JaCoCo - Backend code coverage (minimum 50% per `build.gradle`)

**Build/Dev:**
- Vite 8.0.13 - Frontend bundler and dev server (`sqlive-frontend/vite.config.ts`)
- vue-tsc 3.3.0 - TypeScript type checker for Vue
- Tailwind CSS 4.3.0 - Utility-first CSS via `@tailwindcss/vite` plugin
- Gradle 9.2.1 - Backend build system
- Biome 2.4.16 - Frontend linter and formatter (`sqlive-frontend/biome.json`)

## Key Dependencies

**Critical (Backend - `sqlive-backend/build.gradle`):**

| Package | Version | Purpose |
|---------|---------|---------|
| `spring-boot-starter-webmvc` | 4.0.6 (managed) | REST controllers, embedded Tomcat |
| `spring-boot-starter-jdbc` | 4.0.6 | `JdbcTemplate` for SQL execution |
| `spring-boot-starter-validation` | 4.0.6 | `@Valid` request validation |
| `spring-boot-starter-webflux` | 4.0.6 | Reactive `WebClient` for AI SSE streaming |
| `org.xerial:sqlite-jdbc` | 3.51.1.0 | SQLite JDBC driver |
| `com.zaxxer:HikariCP` | (managed) | Connection pooling for SQLite in-memory databases |
| `com.fasterxml.jackson.core:jackson-databind` | (managed) | JSON serialization |
| `org.projectlombok:lombok` | (managed) | Boilerplate reduction (`@Data`, `@Slf4j`, etc.) |
| `spring-boot-starter-actuator` | 4.0.6 | Health endpoint |

**Critical (Frontend - `sqlive-frontend/package.json`):**

| Package | Version | Purpose |
|---------|---------|---------|
| `vue` | ^3.5.34 | UI framework |
| `monaco-editor` | ^0.55.1 | Code editor component |
| `@vue-flow/core` | ^1.48.2 | ER diagram node/edge rendering |
| `@vue-flow/background` | ^1.3.2 | vue-flow background grid |
| `@vue-flow/controls` | ^1.1.3 | vue-flow zoom controls |
| `@vue-flow/minimap` | ^1.5.4 | vue-flow minimap |
| `dagre` | ^0.8.5 | Graph layout for ER diagrams |
| `echarts` | ^6.1.0 | Chart visualizations |
| `reka-ui` | ^2.9.7 | Headless UI primitives (dialog, dropdown, select, etc.) |
| `@vueuse/core` | ^14.3.0 | Composable utilities (`useDebounceFn`, `watchDebounced`, `useLocalStorage`) |
| `ai` (Vercel) | ^6.0.184 | AI SDK integration |
| `tailwindcss` | ^4.3.0 | Utility CSS framework |
| `splitpanes` | ^4.0.4 | Resizable split panes |
| `marked` | ^18.0.3 | Markdown rendering |
| `lucide-vue-next` | ^1.0.0 | Icon library |
| `sql-formatter` | ^15.8.0 | SQL formatting |
| `class-variance-authority` | ^0.7.1 | Component variant management |
| `tailwind-merge` | ^3.6.0 | Tailwind class deduplication |
| `motion-v` | ^2.2.1 | Animations |
| `nanoid` | ^5.1.11 | Unique ID generation (tab keys, etc.) |
| `vue-stick-to-bottom` | ^1.0.0 | Auto-scroll chat to bottom |
| `vue-stream-markdown` | ^1.0.0-beta.2 | Streaming markdown rendering for AI chat |
| `codeburn` | ^0.9.9 | Code quality cleanup tooling |

**Dev Dependencies (Frontend):**

| Package | Version | Purpose |
|---------|---------|---------|
| `@playwright/test` | ^1.60.0 | E2E test runner |
| `@tailwindcss/vite` | ^4.3.0 | Vite plugin for Tailwind CSS 4 |
| `@vitejs/plugin-vue` | ^6.0.7 | Vite plugin for Vue 3 SFC |
| `@vue/test-utils` | ^2.4.10 | Vue component test utilities |
| `@vue/tsconfig` | ^0.9.1 | Shared tsconfig for Vue projects |
| `jsdom` | ^29.1.1 | DOM environment for vitest |
| `tw-animate-css` | ^1.4.0 | Tailwind CSS animation utilities |
| `typescript` | ^6.0.3 | TypeScript compiler |
| `vite` | ^8.0.13 | Build tool and dev server |
| `vitest` | ^4.1.6 | Unit test runner |
| `vue-tsc` | ^3.3.0 | TypeScript checker for Vue SFCs |
| `@types/dagre` | ^0.7.54 | TypeScript types for dagre |
| `@types/node` | ^25.9.0 | TypeScript types for Node.js |

**Maven Repository (Backend):**
- Aliyun mirror: `https://maven.aliyun.com/repository/public/` (primary, faster access in China)
- Aliyun Spring mirror: `https://maven.aliyun.com/repository/spring/`
- `mavenLocal()` then `mavenCentral()` as fallbacks

## Configuration

**Frontend Configuration:**
- Environment variables via `import.meta.env.VITE_*` pattern
- Config file: `sqlive-frontend/src/config.ts` exports `API_URL`, `API_BASE`, `KNOWLEDGE_API_BASE`
- `.env` file present at `sqlive-frontend/.env` (gitignored)
- TypeScript configs: `tsconfig.json` (root references), `tsconfig.app.json` (app code, strict mode), `tsconfig.node.json` (Node/vite config)
- Vite config: `sqlive-frontend/vite.config.ts` (includes vitest config, `@` alias, monaco-editor optimization)
- Biome config: `sqlive-frontend/biome.json` (Biome 2.4.16, space indent 2, single quotes, no trailing commas, line width 120)

**Backend Configuration:**
- `sqlive-backend/src/main/resources/application.yml`
- AI provider config under `ai.providers`: deepseek (default), openai-compatible, lmstudio, ollama
- AI API keys via system environment variables: `DEEPSEEK_API_KEY`, `OPENAI_API_KEY`, `LM_STUDIO_API_KEY`
- AI timeouts: connect=5s, read=60s, write=30s
- Logging: SLF4J/Logback, rolling file policy (10MB max, 30 history, 500MB cap), DEBUG level for `com.douzi.sqlive`
- Management: Actuator health endpoint only, `show-details: never`
- Rate limits configurable via system properties: `rate.limit.ai` (default 100/min), `rate.limit.sql` (default 500/min)
- SQLite datasource: `jdbc:sqlite:file:playground?mode=memory&cache=shared`

**Build Configuration:**
- Vite config: `sqlive-frontend/vite.config.ts`
- TypeScript configs: `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`
- Gradle config: `sqlive-backend/build.gradle`, `sqlive-backend/settings.gradle`
- Gradle wrapper: `sqlive-backend/gradle/wrapper/gradle-wrapper.properties`

## Platform Requirements

**Development:**
- Zulu JDK 21 at `C:\Program Files\Zulu\zulu-21\bin\` (configured in Gradle wrapper)
- Node.js LTS
- npm
- Backend port 8080 (Spring Boot embedded Tomcat)
- Frontend port 5173 (Vite dev server, auto-proxies `/api` to 8080)
- Chrome browser for Playwright E2E tests (existing system Chrome)
- Local HTTP proxy at `localhost:10809` for accessing foreign websites (e.g., DeepSeek API, Google Fonts)

**Production:**
- Not configured (no Dockerfile, no deployment manifests detected)
- No CI/CD pipeline configured (no GitHub Actions, no `.gitlab-ci.yml`, no Jenkinsfile)
- Local development only at this stage

---

*Stack analysis: 2026-05-30*
