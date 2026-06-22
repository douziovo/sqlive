<!-- generated-by: gsd-doc-writer -->

# API Reference

## Authentication

The Sqlive API has **no authentication**. All endpoints are publicly accessible. There is no Spring Security dependency, no token validation, and no session management.

**CORS:** Cross-origin requests are allowed from `localhost` origins only (`http://localhost:*`, `http://127.0.0.1:*`, `http://[::1]:*`) for all `/api/**` paths. The allowed methods are GET, POST, PUT, DELETE, OPTIONS, and the allowed headers are Content-Type, Authorization, and Accept. Credentials are not sent.

## Endpoints overview

| Method | Path | Description | Auth Required | Streaming |
|---|---|---|---|---|---|
| GET | `/health` | Health check, returns `"OK"` | No | No |
| POST | `/api/execute` | Execute SQL script against an in-memory SQLite database | No | No |
| POST | `/api/ai/chat` | AI chat with streaming SSE response | No | Yes (SSE) |
| POST | `/api/ai/analyze-error` | Analyze a SQL error and suggest causes | No | No |
| POST | `/api/ai/fix-code` | Fix broken SQL and return corrected code | No | No |
| POST | `/api/ai/explain` | Explain what a SQL snippet does | No | No |
| POST | `/api/ai/optimize` | Optimize a SQL query for performance | No | No |
| GET | `/api/knowledge/graph` | Retrieve the knowledge graph node topology | No | No |

All `/api` paths are served on `http://localhost:8080` by default (Spring Boot default port). In development, the Vite frontend uses `VITE_API_URL`, `VITE_AI_API_URL`, and `VITE_KNOWLEDGE_API_URL` environment variables (with `/api/*` relative fallbacks) to reach the backend directly at `http://localhost:8080`.

## Request/response formats

### POST /api/execute

Execute one or more SQL statements against a per-user in-memory SQLite database. The backend parses the SQL script, resets or appends to the named database, re-executes every statement, and returns a full schema snapshot.

**Request**

```json
{
  "sql": "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);\nINSERT INTO users VALUES (1, 'Alice');\nSELECT * FROM users;",
  "dbName": "my-session",
  "reset": true
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `sql` | string | **Yes** | SQL script to execute. Maximum 100,000 characters. |
| `dbName` | string | No | Database identifier. Defaults to `"default"`. Accepts up to 64 characters, excluding `?`, `&`, `=`, `#`, `;`, `/`, `\`, and `:`. A new in-memory database is created per `dbName`. |
| `reset` | boolean | No | If `true`, drop and recreate the database before executing. If `false` or absent, append statements to the existing database state. |

**Response (success)**

```json
{
  "success": true,
  "data": {
    "tables": [
      {
        "name": "users",
        "columns": ["id", "name"],
        "columnTypes": { "id": "INTEGER", "name": "TEXT" },
        "data": [{ "id": 1, "name": "Alice" }]
      }
    ],
    "queryResults": [],
    "indexes": [],
    "views": [],
    "triggers": [],
    "foreignKeys": [],
    "metadata": {
      "durationMs": 12,
      "statementCount": 3
    }
  }
}
```

- `tables` -- All user-created tables with their full schema and all row data.
- `queryResults` -- Result sets from standalone SELECT queries that do not target a known table. Each result uses the same `TableSchema` shape.
- `indexes` -- All user-created indexes.
- `views` -- All user-created views with their definition SQL.
- `triggers` -- All user-created triggers with the associated table and definition SQL.
- `foreignKeys` -- All foreign key relationships discovered via `PRAGMA foreign_key_list`.
- `metadata.durationMs` -- Wall-clock execution time in milliseconds.
- `metadata.statementCount` -- Number of SQL statements parsed and executed.

**Response (error)**

```json
{
  "success": false,
  "error": {
    "message": "near \"SELEC\": syntax error",
    "line": 3
  }
}
```

The `line` field is 1-based and points to the line in the original SQL script where the error occurred. The `message` is the raw SQLite JDBC error message.

### POST /api/ai/chat (streaming SSE)

Send a prompt to the configured AI provider and receive a streamed response via Server-Sent Events. The response content type is `text/event-stream`.

**Request**

```json
{
  "mode": "chat",
  "message": "帮我优化这个查询",
  "stream": true,
  "history": [
    { "role": "user", "content": "我有一张 orders 表" },
    { "role": "assistant", "content": "好的，请提供你的 SQL" }
  ],
  "currentSql": "SELECT * FROM orders WHERE created_at > '2025-01-01'",
  "schema": [
    {
      "table": "orders",
      "columns": ["id", "user_id", "amount", "created_at"],
      "columnTypes": { "id": "INTEGER", "user_id": "INTEGER", "amount": "REAL", "created_at": "TEXT" }
    }
  ]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `mode` | string | No | Set by the controller to `"chat"` for this endpoint. |
| `message` | string | No | User prompt. Maximum 50,000 characters. |
| `stream` | boolean | No | Whether to use SSE streaming. Defaults to `true`. When `false`, returns a single JSON response wrapped in `StreamChunk` objects. |
| `history` | array | No | Chat message history. Maximum 50 messages. Each entry has `role` (user/assistant/system) and `content`. |
| `currentSql` | string | No | The full SQL script currently in the editor. Maximum 100,000 characters. |
| `selectedCode` | string | No | The SQL snippet currently selected by the user. Maximum 50,000 characters. |
| `schema` | array | No | Current database schema as an array of `{ table, columns, columnTypes }` objects. |
| `error` | object | No | Current execution error, if any. Has `message` (string) and `line` (number). |

**Response (SSE stream)**

Each SSE event contains a JSON chunk:

```json
{"type": "text", "content": "要优化这个查询，"}
{"type": "text", "content": "建议在 created_at 列上添加索引。"}
{"type": "usage", "prompt": 120, "completion": 50, "total": 170}
{"type": "done"}
```

| Chunk type | Fields | Description |
|---|---|---|
| `text` | `content` | A fragment of the AI-generated text response. |
| `reasoning` | `content` | Provider reasoning content (supported providers: LM Studio, Ollama). |
| `usage` | `prompt`, `completion`, `total` | Token usage statistics from the provider. |
| `done` | -- | End-of-stream sentinel. |
| `error` | `content` | An error occurred during streaming. |

When `stream` is set to `false`, the endpoint returns two fixed chunks: a `text` chunk with the full response content, followed by a `done` chunk.

### POST /api/ai/analyze-error

Analyze a SQL execution error and return a cause analysis with optional fix suggestions.

**Request** -- Same shape as the chat request, with `mode` set to `"analyze-error"` by the controller. The `error` field is typically populated with the SQL execution error.

**Response**

```json
{
  "success": true,
  "data": {
    "content": "错误分析结果...",
    "summary": "缺少分号导致语句解析错误",
    "fixedCode": "SELECT * FROM users;",
    "tips": ["确保每条语句以分号结尾", "检查关键字拼写"]
  }
}
```

### POST /api/ai/fix-code

Fix broken SQL code and return a corrected version.

**Request** -- Same shape, with `mode` set to `"fix-code"`. The `currentSql` and `error` fields are typically populated.

**Response**

```json
{
  "success": true,
  "data": {
    "content": "修复说明...",
    "fixedCode": "SELECT * FROM users WHERE id = 1;",
    "summary": "修正了 WHERE 子句语法"
  }
}
```

### POST /api/ai/explain

Explain what a SQL snippet does, optionally with step-by-step breakdowns.

**Request** -- Same shape, with `mode` set to `"explain"`. The `selectedCode` field carries the SQL to explain, and `schema` provides table context.

**Response**

```json
{
  "success": true,
  "data": {
    "content": "这条查询...",
    "summary": "从 orders 表中统计各用户的订单总额",
    "stepByStep": [
      { "step": 1, "what": "FROM orders", "why": "从 orders 表读取所有行" },
      { "step": 2, "what": "GROUP BY user_id", "why": "按用户ID分组" },
      { "step": 3, "what": "SELECT SUM(amount)", "why": "计算每组的金额总和" }
    ],
    "tips": ["该查询会扫描全表"]
  }
}
```

### POST /api/ai/optimize

Suggest performance optimizations for a SQL query.

**Request** -- Same shape, with `mode` set to `"optimize"`. The `selectedCode` carries the SQL to optimize.

**Response**

```json
{
  "success": true,
  "data": {
    "content": "优化建议...",
    "summary": "添加索引可使查询速度提升10倍",
    "fixedCode": "CREATE INDEX idx_orders_user ON orders(user_id);",
    "tips": ["GROUP BY 操作在没有索引时需要全表扫描和排序"]
  }
}
```

### GET /api/knowledge/graph

Retrieve the full knowledge graph node topology.

**Request** -- No request body (GET).

**Response**

```json
{
  "topics": [
    {
      "id": "sql-select",
      "label": "SELECT",
      "difficulty": 1,
      "nextTopics": ["sql-where", "sql-join"]
    }
  ]
}
```

The `topics` array contains all knowledge graph nodes. Each topic has an `id`, `label`, `difficulty` (1-5 scale), and an array of `nextTopics` IDs.

## Error codes

All endpoints return HTTP status codes consistent with REST semantics:

| Status code | Meaning | Response body |
|---|---|---|
| 200 | Success | Standard response shape with `success: true` |
| 400 | Validation error | `SqlResponse` with `success: false` and a descriptive `error.message` listing the failed field constraints |
| 429 | Rate limit exceeded | `{"success": false, "error": {"message": "Too many requests, please slow down"}}` |
| 500 | Internal server error | `SqlResponse` with `success: false` and `error.message: "Internal server error"` |
| 503 | AI provider unavailable | `AiChatResponse` with `success: false` and the provider-specific error message |

The `GlobalExceptionHandler` at `GlobalExceptionHandler.java` handles three categories of errors:

1. **`MethodArgumentNotValidException`** (400) -- Raised when request body validation fails. The error message aggregates all field-level errors (e.g., `"sql: SQL cannot be empty; sql: SQL script too large"`).
2. **`AiProviderException`** (503) -- Raised when the configured AI provider is unreachable, returns an error, or times out.
3. **`Exception`** (500) -- Catch-all for unhandled exceptions. Always returns `"Internal server error"`.

## Rate limits

The `RateLimitFilter` enforces per-IP, per-endpoint sliding-window rate limiting with a **60-second window**:

| Endpoint | Default limit | Configurable via |
|---|---|---|
| `/api/ai/*` (all AI endpoints) | 100 requests/minute | System property `rate.limit.ai` |
| `/api/execute` (SQL execution) | 500 requests/minute | System property `rate.limit.sql` |
| `/api/knowledge/*` | No limit | -- |
| `/health` | No limit | -- |

When the limit is exceeded, the server returns HTTP 429 with a JSON error body. The counters are per-client-IP and per-endpoint-path. Each 60-second window starts from the first request in the window.

**Example 429 response:**

```json
{"success": false, "error": {"message": "Too many requests, please slow down"}}
```
