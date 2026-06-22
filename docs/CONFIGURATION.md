<!-- generated-by: gsd-doc-writer -->

# Configuration

## Environment variables

### Frontend (`.env`)

The frontend reads these variables at build time via Vite's `import.meta.env`. The `.env` file is located at `sqlive-frontend/.env`.

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_API_URL` | No | `/api/execute` | Base URL for SQL execution endpoint |
| `VITE_AI_API_URL` | No | `/api/ai` | Base URL for AI chat and inline action endpoints |
| `VITE_KNOWLEDGE_API_URL` | No | `/api/knowledge` | Base URL for knowledge graph endpoint |

The default values are relative paths, meaning the frontend and backend must be served from the same origin in production. In development, the `.env` file sets these to `http://localhost:8080/api/...` so the Vite dev server sends cross-origin requests to the Spring Boot backend (CORS is enabled for localhost origins).

### Backend (environment variables)

These environment variables are read by Spring Boot from `application.yml` placeholders.

| Variable | Required | Default | Description |
|---|---|---|---|
| `DEEPSEEK_API_KEY` | **Required** (if using DeepSeek) | (empty) | API key for the DeepSeek AI provider. Failure to set this when `ai.provider` is `deepseek` will cause AI features to fail. |
| `OPENAI_API_KEY` | No | `not-required` | API key for the OpenAI-compatible provider. Only needed when using `openai-compatible` with a keyed endpoint. |
| `LM_STUDIO_API_KEY` | No | `not-required` | API key for LM Studio. Typically not required for local LM Studio instances. |

## Config file format

### Backend: `application.yml`

Located at `sqlive-backend/src/main/resources/application.yml`.

#### Datasource

```yaml
spring:
  datasource:
    url: jdbc:sqlite:file:playground?mode=memory&cache=shared
    driver-class-name: org.sqlite.JDBC
```

The SQLite database runs entirely in memory with shared cache mode enabled. Each tab session uses a separate in-memory database keyed by session ID.

#### Logging

```yaml
logging:
  level:
    root: info
    com.douzi.sqlive: debug
    org.springframework.web: info
  file:
    name: logs/sqlive.log
  logback:
    rollingpolicy:
      max-file-size: 10MB
      max-history: 30
      total-size-cap: 500MB
  pattern:
    console: "%d{yyyy-MM-dd HH:mm:ss.SSS} %-5level [%thread] %logger{36} - %msg%n"
    file: "%d{yyyy-MM-dd HH:mm:ss.SSS} %-5level [%thread] %logger{36} - %msg%n"
```

Logs are written to both console and file (`logs/sqlive.log`). Application-level logging (`com.douzi.sqlive`) is set to `debug` for development. Log files rotate when they reach 10 MB, retaining up to 30 files or 500 MB total.

#### AI providers

```yaml
ai:
  provider: deepseek
  providers:
    deepseek:
      base-url: https://api.deepseek.com/v1
      api-key: ${DEEPSEEK_API_KEY:}
      model: deepseek-v4-flash
      max-tokens: 4096
      max-context-tokens: 16384
      temperature: 1
    openai-compatible:
      base-url: http://localhost:1234/v1
      api-key: ${OPENAI_API_KEY:not-required}
      model: google/gemma-4-e2b
      max-tokens: 4096
      max-context-tokens: 16384
      temperature: 1
    lmstudio:
      base-url: http://localhost:1234
      api-key: ${LM_STUDIO_API_KEY:not-required}
      model: ibm/granite-4-micro
      max-tokens: 4096
      max-context-tokens: 16384
      temperature: 1
      reasoning-effort: "medium"
    ollama:
      base-url: http://172.16.1.200:11434
      api-key: ""
      model: gemma4:e2b
      max-tokens: 4096
      max-context-tokens: 16384
      temperature: 1
      reasoning-effort: "true"
```

The `ai.provider` key selects the active provider: `deepseek`, `openai-compatible`, `lmstudio`, or `ollama`. Each provider block defines:

| Property | Description |
|---|---|
| `base-url` | API endpoint URL |
| `api-key` | API key, resolved from environment variable |
| `model` | Model identifier sent to the provider |
| `max-tokens` | Maximum tokens in the generated response |
| `max-context-tokens` | Context window size (maps to `num_ctx` for Ollama) |
| `temperature` | Sampling temperature (0-2) |
| `reasoning-effort` | Reasoning model effort level (`low`, `medium`, `high`, or empty to disable). Used by LM Studio and Ollama providers. |

The configuration is mapped to `AiProperties.java` via `@ConfigurationProperties(prefix = "ai")` and each provider block is deserialized into `AiProviderConfig` DTOs.

#### Management endpoints

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health
  endpoint:
    health:
      show-details: never
```

Only the `/actuator/health` endpoint is exposed, with no detail shown. This endpoint returns a simple up/down status.

### Frontend: `vite.config.ts`

The Vite configuration is at `sqlive-frontend/vite.config.ts`. Key settings:

| Setting | Value | Description |
|---|---|---|
| `optimizeDeps.include` | `['monaco-editor']` | Pre-bundles Monaco Editor for faster cold start |
| `worker.format` | `'es'` | ES module format for web workers (required by Monaco) |
| `build.rollupOptions.output.manualChunks` | Monaco in separate chunk | Code-splits Monaco Editor into its own bundle |
| `test.environment` | `jsdom` | Uses jsdom for Vitest DOM simulation |
| `test.globals` | `true` | Vitest global API (`describe`, `it`, `expect`) without imports |

The dev server command (`npm run dev`) runs `vite --host`, binding to all network interfaces. The default port is `5173`.

## Required vs optional settings

### Required

- **`DEEPSEEK_API_KEY`** -- If `ai.provider` is `deepseek` (the default), this environment variable must be set. The backend will start successfully without it, but AI requests will fail at runtime when the API key is missing or empty.

### Optional

- **`VITE_API_URL`, `VITE_AI_API_URL`, `VITE_KNOWLEDGE_API_URL`** -- The frontend uses sensible defaults (relative paths) if these are not set.
- **`OPENAI_API_KEY`** -- Only needed when using the `openai-compatible` provider with an authentication-required endpoint. Defaults to `not-required`.
- **`LM_STUDIO_API_KEY`** -- Not needed for typical local LM Studio usage. Defaults to `not-required`.
- **`rate.limit.ai`** -- System property (Java `-D` flag). Controls AI endpoint rate limit. Default: `100` requests per 60-second window.
- **`rate.limit.sql`** -- System property (Java `-D` flag). Controls SQL execute endpoint rate limit. Default: `500` requests per 60-second window.

## Defaults

| Setting | Default | Location |
|---|---|---|
| Backend server port | `8080` | Spring Boot default (not overridden in `application.yml`) |
| Frontend dev server port | `5173` | Vite default |
| Active AI provider | `deepseek` | `application.yml` `ai.provider` |
| AI `max-tokens` | `4096` | Per-provider in `application.yml` |
| AI `temperature` | `1` | Per-provider in `application.yml` |
| AI `max-context-tokens` | `16384` | Per-provider in `application.yml` |
| SQLite mode | `memory` (shared cache) | `application.yml` datasource URL |
| Log level (app) | `debug` | `application.yml` `logging.level.com.douzi.sqlive` |
| Log max file size | `10 MB` | `application.yml` rolling policy |
| Actuator health details | `never` | `application.yml` management endpoint |
| Gradle JVM heap | `256 MB` | `gradle.properties` `org.gradle.jvmargs` |
| AI rate limit | `100` / 60s window | `RateLimitFilter.java` system property `rate.limit.ai` |
| SQL rate limit | `500` / 60s window | `RateLimitFilter.java` system property `rate.limit.sql` |
| JaCoCo coverage minimum | `0.50` (50%) | `build.gradle` `jacocoTestCoverageVerification` |

## Per-environment overrides

This project does not use Spring Boot profiles (`application-{profile}.yml`) or Vite mode-specific `.env` files (`.env.development`, `.env.production`, `.env.test`). Configuration across environments is managed as follows:

### Development

The `.env` file in `sqlive-frontend/` sets API URLs to `http://localhost:8080/api/...`. The backend runs on port `8080` with CORS enabled for `localhost:*` origins. No additional environment setup is required beyond setting `DEEPSEEK_API_KEY` if using AI features.

### Testing

- **Frontend (Vitest)**: Tests mock `fetch()` globally via `vi.fn()`, so no real API calls are made. The `test-utils.ts` helper exports a constant `API_URL = 'http://localhost:8080/api/execute'` for reference but tests do not depend on a running backend.
- **Frontend (Playwright E2E)**: Configured in `tests/e2e/playwright.config.ts` <!-- VERIFY: Playwright config may specify a base URL for the running frontend -->.
- **Backend (JUnit 5)**: Integration tests use `@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)`, so a random port is allocated for each test class. No special environment variables are required.

### Production

Production deployments should set the frontend API URLs to relative paths (`/api/execute`, `/api/ai`, `/api/knowledge`) so the frontend and backend share the same origin. The backend CORS configuration would need to be updated to allow the production origin. <!-- VERIFY: Production deployment configuration -- CORS allowed origins, TLS, and reverse proxy settings are deployment-dependent. -->
