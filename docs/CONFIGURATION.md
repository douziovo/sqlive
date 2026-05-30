<!-- generated-by: gsd-doc-writer -->
---
title: Configuration
description: Environment variables, config files, and runtime settings for sqlive
---

# Configuration

The sqlive playground uses a two-tier configuration model: **environment variables** for the frontend (Vite convention), and a **Spring Boot application.yml** plus **JVM system properties** for the backend. This document covers every configuration surface.

---

## Environment Variables

### Frontend (Vite)

The frontend uses Vite's `import.meta.env` convention. Variables prefixed with `VITE_` are exposed to the browser bundle. A `.env` file in `sqlive-frontend/.env` provides defaults for local development.

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_API_URL` | No | `/api/execute` | Full URL to the SQL execution endpoint. In dev, proxied through Vite to `http://localhost:8080/api/execute`. |
| `VITE_AI_API_URL` | No | `/api/ai` | Full URL to the AI chat endpoint. In dev, proxied through Vite to `http://localhost:8080/api/ai`. |
| `VITE_KNOWLEDGE_API_URL` | No | `/api/knowledge` | Full URL to the knowledge graph endpoint. In dev, proxied through Vite to `http://localhost:8080/api/knowledge`. |

All three variables are consumed in `sqlive-frontend/src/config.ts`:

```ts
export const API_URL = import.meta.env.VITE_API_URL || '/api/execute'
export const API_BASE = import.meta.env.VITE_AI_API_URL || '/api/ai'
export const KNOWLEDGE_API_BASE = import.meta.env.VITE_KNOWLEDGE_API_URL || '/api/knowledge'
```

In production, set these to the deployed backend's URL. During development with `npm run dev`, Vite's dev server auto-proxies `/api/*` to `http://localhost:8080`, so the defaults work without an `.env` file.

### Backend (Spring Boot / JVM)

The backend reads configuration from three sources in order of precedence:

1. **JVM system properties** (passed via `-D` flags)
2. **Environment variables** (from the OS or container)
3. **`application.yml`** (in `sqlive-backend/src/main/resources/`)

The following environment variables are consumed by the backend:

| Variable | Required | Default | Description |
|---|---|---|---|
| `DEEPSEEK_API_KEY` | Yes (when `ai.provider=deepseek`) | *(none)* | API key for DeepSeek AI provider. If empty, DeepSeek provider will fail at runtime. |
| `OPENAI_API_KEY` | No | `not-required` | API key for openai-compatible provider. Default is a placeholder because local servers often do not require a key. |
| `LM_STUDIO_API_KEY` | No | `not-required` | API key for LM Studio provider. Default is a placeholder because local servers often do not require a key. |
| `rate.limit.ai` | No | `100` | JVM system property. Maximum AI API requests per IP per 60-second window. |
| `rate.limit.sql` | No | `500` | JVM system property. Maximum SQL execution requests per IP per 60-second window. |

> **Note:** `rate.limit.ai` and `rate.limit.sql` are read via `Integer.getInteger()` in `RateLimitFilter.java`. They must be set as JVM system properties (`-Drate.limit.ai=200`), not OS environment variables.

---

## Backend Configuration File (`application.yml`)

The canonical configuration file lives at `sqlive-backend/src/main/resources/application.yml`. The file is divided into several sections.

### Application Meta

```yaml
spring:
  application:
    name: sqlive-backend
```

Simply declares the application name for Spring Boot's `ApplicationContext` and actuator endpoints.

### Datasource (SQLite)

```yaml
spring:
  datasource:
    url: jdbc:sqlite:file:playground?mode=memory&cache=shared
    driver-class-name: org.sqlite.JDBC
```

- Uses an **in-memory SQLite database** with shared cache mode.
- `mode=memory` ensures the database is volatile and destroyed when the JVM exits or the connection pool is closed.
- `cache=shared` allows multiple connections (from the same JVM) to share the same in-memory database, which is required because the backend maintains one `JdbcTemplate` per session in a `ConcurrentHashMap<String, JdbcTemplate>`.
- No username/password — SQLite in memory does not support authentication.
- HikariCP is the connection pool (Spring Boot default); no explicit pool tuning is configured, so all HikariCP defaults apply (maximum pool size 10, connection timeout 30 s, etc.).

> **Warning:** Changing the datasource URL to a file-based SQLite path (e.g., `jdbc:sqlite:playground.db`) would persist data across restarts but break the per-session isolation model.

### Logging

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

| Setting | Value | Notes |
|---|---|---|
| Root log level | `info` | |
| `com.douzi.sqlive` package | `debug` | All application code runs under this package; debug level during development is useful for SQL tracing. |
| `org.springframework.web` | `info` | |
| Log file path | `logs/sqlive.log` | Relative to the working directory where the JVM is launched. |
| Max file size | 10 MB | Triggers rollover. |
| Max history | 30 rotated files | |
| Total size cap | 500 MB | Older rotated files are deleted when this limit is exceeded. |
| Console pattern | `%d{yyyy-MM-dd HH:mm:ss.SSS} %-5level [%thread] %logger{36} - %msg%n` | Timestamp, level, thread, logger, message. |
| File pattern | Same as console | |

### AI Provider Configuration

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
  timeout:
    connect: 5s
    read: 60s
    write: 30s
```

This is mapped to the `AiProperties` class (`@ConfigurationProperties(prefix = "ai")` in `sqlive-backend/src/main/java/com/douzi/sqlive/config/AiProperties.java`).

**`ai.provider`** -- The active provider key. Must match one of the keys under `ai.providers`. Default: `deepseek`.

**Provider-specific options:**

| Key | Type | Description |
|---|---|---|
| `base-url` | URL | API endpoint base URL. |
| `api-key` | string | Authentication key. Supports Spring-style `${ENV_VAR:default}` placeholders. |
| `model` | string | Model identifier used in the provider's API request body. |
| `max-tokens` | integer | Maximum tokens in the response (maps to provider's `max_tokens` parameter). |
| `max-context-tokens` | integer | Maximum tokens in the context window (truncates older messages when exceeded). |
| `temperature` | float | Sampling temperature (0.0 - 2.0). Default: 1. |
| `reasoning-effort` | string (optional) | Provider-specific reasoning parameter (`"medium"`, `"true"`, etc.). Only supported by `lmstudio` and `ollama`. |

**Timeout configuration (`ai.timeout`):**

| Setting | Default | Description |
|---|---|---|
| `connect` | `5s` | Maximum time to establish a connection to the AI provider. |
| `read` | `60s` | Maximum time to wait between bytes (response idle timeout). |
| `write` | `30s` | Maximum time to send the request body. |

Values use ISO-8601 duration format (e.g., `5s`, `60s`). These are mapped to `java.time.Duration` in `AiProperties.TimeoutConfig`.

<!-- VERIFY: The Ollama base URL `http://172.16.1.200:11434` is a LAN address specific to the developer's environment. In production or other developer environments, this must be changed. -->

### Management (Actuator)

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

- Only the `/actuator/health` endpoint is exposed.
- Health details (database connectivity, disk space) are hidden from responses (`show-details: never`).
- No shutdown, metrics, or info endpoints are exposed in the default configuration.

### CORS

CORS is configured in `WebConfig.java` (not in `application.yml`):

```java
registry.addMapping("/api/**")
        .allowedOriginPatterns("http://localhost:*", "http://127.0.0.1:*", "http://[::1]:*")
        .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
        .allowedHeaders("Content-Type", "Authorization", "Accept")
        .allowCredentials(false);
```

- Allows any port on `localhost`, `127.0.0.1`, and `[::1]` (IPv6 loopback).
- Credentials (cookies, authorization headers) are NOT forwarded (`allowCredentials: false`).
- To allow additional origins in deployment, modify the `allowedOriginPatterns` array in `WebConfig.java`.

---

## Rate Limiting

Rate limiting is implemented in `RateLimitFilter.java` (registered at order 1 for all `/api/*` paths).

| Endpoint group | Default limit | Window |
|---|---|---|
| `/api/ai/*` | 100 requests | 60 seconds (per client IP) |
| `/api/execute` | 500 requests | 60 seconds (per client IP) |

The limits are adjustable via JVM system properties:

```bash
# Example: double the AI rate limit
java -Drate.limit.ai=200 -jar sqlive-backend.jar
```

When a client exceeds the limit, the endpoint returns HTTP 429 with:

```json
{
  "success": false,
  "error": {
    "message": "Too many requests, please slow down"
  }
}
```

Counter entries expire after 5 minutes of inactivity (cleanup runs every 5 minutes on a daemon thread).

---

## Required vs. Optional Settings

| Setting | Required | Fails at | Error on missing |
|---|---|---|---|
| `DEEPSEEK_API_KEY` (env var) | Yes, when `ai.provider=deepseek` | First AI request | AI requests return 500 with provider error |
| `OPENAI_API_KEY` | No (default: `not-required`) | -- | N/A |
| `LM_STUDIO_API_KEY` | No (default: `not-required`) | -- | N/A |
| `spring.datasource.url` | Yes | Startup | Spring Boot fails to start |
| `VITE_API_URL` (frontend) | No (default: `/api/execute`) | -- | Falls back to proxy path |
| `rate.limit.ai` | No (default: 100) | -- | Uses default |
| `rate.limit.sql` | No (default: 500) | -- | Uses default |

---

## Defaults Summary

| Variable / Setting | Default Value | Set In |
|---|---|---|
| Active AI provider | `deepseek` | `AiProperties.java` field initializer |
| AI provider API key defaults | `${ENV_VAR:not-required}` or empty | `application.yml` |
| AI connect timeout | `5s` | `AiProperties.TimeoutConfig` field initializer |
| AI read timeout | `60s` | `AiProperties.TimeoutConfig` field initializer |
| AI write timeout | `30s` | `AiProperties.TimeoutConfig` field initializer |
| Rate limit AI | `100` per 60 s window | `RateLimitFilter.java` |
| Rate limit SQL | `500` per 60 s window | `RateLimitFilter.java` |
| Root log level | `info` | `application.yml` |
| Application package log level | `debug` | `application.yml` |
| Frontend API endpoint | `/api/execute` | `config.ts` default |
| Frontend AI endpoint | `/api/ai` | `config.ts` default |
| Frontend knowledge endpoint | `/api/knowledge` | `config.ts` default |
| Spring Boot server port | `8080` | Spring Boot default (not overridden) |
| JaCoCo minimum coverage | 50% | `build.gradle` |

---

## Per-Environment Overrides

### Profile-specific YAML files

The project does **not** define profile-specific configuration files (e.g., `application-dev.yml`, `application-prod.yml`). To override settings per environment, use one of these methods:

1. **Environment variables** -- Set `DEEPSEEK_API_KEY`, etc. in the OS environment or container secrets manager.
2. **JVM system properties** -- Pass `-D` flags when launching the JAR.
3. **External `application.yml`** -- Spring Boot loads an `application.yml` from the same directory as the JAR if it exists, merging with and overriding the packaged file.
4. **Vite `.env` files** -- Vite supports `.env.development`, `.env.production`, etc. Create these in `sqlive-frontend/` for frontend per-environment overrides.

### Common production adjustments

- Set `logging.level.com.douzi.sqlive` to `info` or `warn` to reduce log volume.
- Remove or restrict `allowedOriginPatterns` in `WebConfig.java` to the production domain only.
- Increase `spring.datasource.hikari.maximum-pool-size` if concurrent sessions exceed 10.
- Set `DEEPSEEK_API_KEY` via a secure environment variable (never commit it to the repository).
