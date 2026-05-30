# External Integrations

**Analysis Date:** 2026-05-30

## APIs & External Services

**AI/LLM Providers (4 configured):**

All AI providers are accessed via Spring WebFlux `WebClient` through the `OpenAiCompatibleProvider` abstraction chain. The `AiService` (`sqlive-backend/src/main/java/com/douzi/sqlive/service/ai/AiService.java`) selects a provider at runtime based on `ai.provider` config in `application.yml`. Each provider has a custom `Protocol` implementation for request building and response parsing.

| Provider | Status | Endpoint | Protocol Class | Auth |
|----------|--------|----------|----------------|------|
| **DeepSeek** (default) | Remote | `https://api.deepseek.com/v1` | `DeepSeekProtocol.java` | `DEEPSEEK_API_KEY` env var (Bearer token) |
| **Ollama** | Local network | `http://172.16.1.200:11434` | `OllamaProtocol.java` | None (empty api-key) |
| **LM Studio** | Local | `http://localhost:1234` | `LmStudioProtocol.java` | `LM_STUDIO_API_KEY` env var |
| **OpenAI-compatible** | Local | `http://localhost:1234/v1` | `OpenAiProtocol.java` | `OPENAI_API_KEY` env var |

**DeepSeek Protocol (`DeepSeekProtocol.java`):**
- Extends `OpenAiProtocol` — same `/chat/completions` endpoint format
- Adds `thinking: {type: "enabled"}` field for reasoning mode
- Model: `deepseek-v4-flash` (from config), max-tokens=4096, max-context-tokens=16384
- Requires API key (`requiresApiKey()` returns true)

**OpenAI-Compatible Protocol (`OpenAiProtocol.java`):**
- Endpoint: `{base-url}/chat/completions` (default base: `http://localhost:1234/v1`)
- Model: `google/gemma-4-e2b`
- No auth enforced (api-key defaults to `not-required`)

**LM Studio Protocol (`LmStudioProtocol.java`):**
- Endpoint: `/v1/chat/completions` (relative to `http://localhost:1234`)
- Model: `ibm/granite-4-micro`
- SSE parsing: custom line-by-line buffering for `event:` / `data:` format
- reasoning-effort: `medium`

**Ollama Protocol (`OllamaProtocol.java`):**
- Endpoint: `/api/chat` (not `/chat/completions`)
- Model: `gemma4:e2b`
- Custom request format with `num_predict`/`num_ctx` options
- reasoning-effort: `true`
- No auth
- No streaming fallback to non-streaming mode

**REST API Endpoints (all served by backend at port 8080):**

| Endpoint | Controller | Method | Purpose |
|----------|-----------|--------|---------|
| `POST /api/execute` | `SqlController.java` | JSON | Execute SQL script, return table schemas + metadata |
| `POST /api/ai/chat` | `AiController.java` | SSE | Streaming AI chat |
| `POST /api/ai/analyze-error` | `AiController.java` | JSON | AI error analysis |
| `POST /api/ai/fix-code` | `AiController.java` | JSON | AI code fix |
| `POST /api/ai/explain` | `AiController.java` | JSON | AI SQL explanation |
| `POST /api/ai/optimize` | `AiController.java` | JSON | AI SQL optimization |
| `POST /api/ai/generate-sql` | `AiController.java` | JSON | AI SQL generation |
| `GET /api/knowledge/graph` | `KnowledgeController.java` | JSON | Knowledge graph data |
| `GET /health` | `HealthController.java` | Plain text | Health check (used by Playwright E2E tests) |

**AI Provider chain architecture:**
- `AiController` -> `AiService` -> `AiProvider` (interface) -> `Protocol` (interface) -> `WebClient` (HTTP)
- `AiProvider` has two implementations: `OpenAiCompatibleProvider` (all remote providers) and potentially a local fallback
- `Protocol` has 4 implementations: `DeepSeekProtocol`, `OpenAiProtocol`, `LmStudioProtocol`, `OllamaProtocol`
- Each protocol handles provider-specific request building and response parsing

## Data Storage

**Databases:**
- SQLite (in-memory, shared cache mode)
  - Connection URL pattern: `jdbc:sqlite:file:{dbName}?mode=memory` (per `DatabasePoolManager.createJdbcTemplate()`)
  - Default connection: `jdbc:sqlite:file:playground?mode=memory&cache=shared` (from `application.yml` spring.datasource.url — used for initial setup only; actual user sessions use `DatabasePoolManager`)
  - Client: `JdbcTemplate` via `HikariDataSource` connection pool
  - Pool: `ConcurrentHashMap<String, DbEntry>` in `DatabasePoolManager` (`sqlive-backend/src/main/java/com/douzi/sqlive/service/database/DatabasePoolManager.java`)
  - Max concurrent databases: 20 (hard limit, LRU eviction vs capacity)
  - Idle timeout: 20 minutes (periodic cleanup every 5 minutes via `ScheduledExecutorService`)
  - Database names validated via regex `^[a-zA-Z0-9_-]{1,64}$`
  - Each pool limited to 1 connection (`MaximumPoolSize=1`) for SQLite thread safety
  - Metadata extracted via `sqlite_master` table, `PRAGMA` commands, and JDBC `ResultSetMetaData`
  - Client-side connection naming: `SQLitePool-{dbName}` for HikariCP pool names
  - `@PreDestroy` cleanup closes all connections gracefully with `PRAGMA foreign_keys = OFF`

**File Storage:**
- Local filesystem only
  - Tab import/export via browser `File` API (used in `useBidirectionalSync.ts`)
  - Log files: `logs/sqlive.log` (rolling policy, 10MB max per file, 30 history, 500MB total cap)
  - No cloud or persistent file storage

**Caching:**
- None detected (no Redis, no in-memory cache framework beyond Java ConcurrentHashMap)

## Authentication & Identity

**Auth Provider:**
- No authentication system implemented
- CORS (configured in `WebConfig.java` at `sqlive-backend/src/main/java/com/douzi/sqlive/config/WebConfig.java`): allows any origin matching `http://localhost:*`, `http://127.0.0.1:*`, `http://[::1]:*`
- `allowCredentials(false)` in CORS config (no cookies/auth headers forwarded)
- Rate limiting is IP-based only (no user identity, no session tracking)
- No login, no JWT, no OAuth, no API keys for frontend-to-backend communication

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, no DataDog, no external error tracking service)

**Logs:**
- SLF4J / Logback (Spring Boot default)
- Config: `sqlive-backend/src/main/resources/application.yml`
- Rolling policy: max 10MB per file, 30 history, 500MB total cap
- Log files: `logs/sqlive.log` (relative to backend working directory)
- Console pattern: `"%d{yyyy-MM-dd HH:mm:ss.SSS} %-5level [%thread] %logger{36} - %msg%n"`
- File pattern: same as console
- Log levels: `root: info`, `com.douzi.sqlive: debug`, `org.springframework.web: info`

**Health Checks:**
- Spring Boot Actuator (only `/health` endpoint exposed)
- `management.endpoints.web.exposure.include: health`
- `show-details: never` (no sensitive info leaked)
- Used by Playwright E2E tests as the backend readiness check (`url: http://localhost:8080/health`)

## CI/CD & Deployment

**Hosting:**
- None detected (local development only)

**CI Pipeline:**
- None detected (no GitHub Actions, no Jenkinsfile, no `.gitlab-ci.yml`)
- No Dockerfile present

## Environment Configuration

**Required env vars:**
| Variable | Default | Used By |
|----------|---------|---------|
| `DEEPSEEK_API_KEY` | (required) | `DeepSeekProtocol` - API key for DeepSeek AI |
| `OPENAI_API_KEY` | `not-required` | `OpenAiProtocol` - API key for OpenAI-compatible |
| `LM_STUDIO_API_KEY` | `not-required` | `LmStudioProtocol` - API key for LM Studio |
| `VITE_API_URL` | `/api/execute` | Frontend SQL execution endpoint (`src/config.ts`) |
| `VITE_AI_API_URL` | `/api/ai` | Frontend AI chat endpoint (`src/config.ts`) |
| `VITE_KNOWLEDGE_API_URL` | `/api/knowledge` | Frontend knowledge graph endpoint (`src/config.ts`) |

**Secrets location:**
- API keys: system environment variables only (no secret store, no encrypted config)
- `.env` file present at `sqlive-frontend/.env` (gitignored, contains local frontend env vars)

**Configurable system properties (JVM):**
| Property | Default | Purpose |
|----------|---------|---------|
| `rate.limit.ai` | 100 | AI endpoint max requests per minute per IP |
| `rate.limit.sql` | 500 | SQL endpoint max requests per minute per IP |

## Rate Limiting

**Implementation:** `RateLimitFilter` at `sqlive-backend/src/main/java/com/douzi/sqlive/config/RateLimitFilter.java`

- Per-IP, per-path sliding window counters (60-second window)
- Separate counter maps for AI endpoints (`/api/ai/*`) and SQL (`/api/execute`)
- Lazy cleanup: `ScheduledExecutorService` clears expired entries every 5 minutes
- Returns HTTP 429 with JSON error payload when exceeded
- Registering: via `WebConfig.java`'s `FilterRegistrationBean`

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## External Fonts

**Google Fonts:**
- Geist (sans-serif, weights 400-700) and Geist Mono (monospace, weights 400-700)
- Loaded via CSS `@import url(...)` at `sqlive-frontend/src/input.css` (line 1)
- Fallback fonts: `ui-sans-serif, system-ui, -apple-system, sans-serif` and `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
- Requires internet access to Google Fonts CDN (may need proxy in restricted networks)

## Knowledge Graph

**Knowledge Graph:**
- Static JSON file: `sqlive-backend/src/main/resources/knowledge-graph.json`
- Loaded on `@PostConstruct` by `KnowledgeGraphService.java` (`sqlive-backend/src/main/java/com/douzi/sqlive/service/knowledge/KnowledgeGraphService.java`)
- Contains SQL learning topics with nodes, prerequisites, keywords, difficulty levels
- Served via `GET /api/knowledge/graph` endpoint
- No external knowledge base, vector database, or embedding service
- Frontend renders as vue-flow graph in `KnowledgePanel.vue`

## External Build Dependencies

**Maven Repositories (Backend):**
- Primary: `https://maven.aliyun.com/repository/public/` (Aliyun mirror, faster in China)
- Spring: `https://maven.aliyun.com/repository/spring/` (Aliyun Spring mirror)
- Fallback: `mavenLocal()`, then `mavenCentral()`

**npm Registry (Frontend):**
- Default npm registry (no custom registry configured in `package.json`)

## Playwright E2E Test Integration

**Config:** `sqlive-frontend/tests/e2e/playwright.config.ts`
- Workers: 4
- Timeout: 30s (expect: 10s)
- Viewport: 1440x900
- Browser: Chrome (existing system Chrome, no Playwright browser install)
- Test pattern: `**/*.spec.ts` in `tests/e2e/specs/`
- Boots backend via `cmd /c ".\\gradlew.bat bootRun"` with health check at `http://localhost:8080/health` (180s timeout)
- Boots frontend via `npm run dev` at `http://localhost:5173` (no explicit timeout, auto-detects port)

---

*Integration audit: 2026-05-30*
