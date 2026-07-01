# Runbook

操作手册——部署、调试、故障排查。架构见 `docs/ARCHITECTURE.md`，开发规范见 `CLAUDE.md`。

## 部署

### Render（生产）

`render.yaml` 单服务配置：Docker runtime、free tier、绑 `master` 分支自动部署、健康检查 `/actuator/health`。

**必配环境变量**（Render Dashboard → Environment）：

| 变量 | 必填 | 说明 |
|---|---|---|
| `DEEPSEEK_API_KEY` | 是（生产）| DeepSeek API key，`AiService` 默认 provider 用 |
| `AI_API_KEY` | **是（生产）** | `ApiKeyFilter` 用 `@Value("${AI_API_KEY:}")` 注入；**未配置时 `/api/ai/**` 静默公开 bypass（dev 模式不强制 X-API-Key）**。生产部署必须配 `AI_API_KEY` 防 DeepSeek quota 滥用——否则任何人可无凭证调用 AI 端点 |
| `SQLIVE_SQLITE_URL` | 否（有默认）| 默认 `jdbc:sqlite:file:playground?mode=memory&cache=shared` |
| `SQLIVE_POOL_MAX_DB` | 否（有默认）| 默认 50 |
| `JAVA_TOOL_OPTIONS` | 否（render.yaml 已配）| `-Xmx384m -Xms128m -XX:MaxMetaspaceSize=128m -XX:+UseSerialGC`——free tier 512MB JVM 限制（commit `edba435`）|

**Docker 构建**（commit `b5a824f` / `9003f4c`）：多阶段 `Dockerfile`——前端 `node:22-alpine` 构建 dist → 后端 `eclipse-temurin:21-jdk` 将 dist 拷入 Spring Boot static resources → 运行时 `eclipse-temurin:21-jre`。Gradle wrapper JAR 不在 git 中，Docker 内下载 Gradle 9.2.1 直接构建（commit `b5a824f`）。

```bash
docker build -t sqlive .
docker run -p 8080:8080 sqlive
```

### 本地 dev

前端：`npm run dev`（Vite dev server，5173 端口，直连 `VITE_API_URL` 到 :8080）。
后端：`./gradlew bootRun`（8080 端口）。

JDK 21（Zulu），设置 `$JAVA_HOME` 后用 `java -version` 验证。

## 调试

### SQLite in-memory pool

连接串：`jdbc:sqlite:file:{name}?mode=memory&busy_timeout=5000`（WR-06：原文档写 `cache=shared`，但 `DatabasePoolManager.createJdbcTemplate` 实际使用 `busy_timeout=5000` 且无 `cache=shared`——HikariCP `maximumPoolSize=1`，单连接即单内存库，`cache=shared` 在此设计下不需要）。`DatabasePoolManager` 用 `synchronizedMap(LinkedHashMap)` per-db-name 隔离，每个 db-name 一个独立内存库。多 tab 打开同一 db-name 共享同一内存库；不同 db-name 完全隔离。

`DatabasePoolManager` 用 LinkedHashMap access-order（LRU）+ synchronizedMap 线程安全；`evictionGeneration` volatile 防止 TOCTOU（fast-path get 后再 check generation，若变了说明期间发生过 evict，降级走 createNewPool）。

LRU 淘汰参数（`application.yml` 可覆盖）：
- `sqlive.pool.idle-timeout` 默认 30m（`SQLIVE_POOL_IDLE_TIMEOUT`）
- `sqlive.pool.cleanup-interval` 默认 5m（`SQLIVE_POOL_CLEANUP_INTERVAL`）
- `sqlive.pool.max-databases` 默认 500（`SQLIVE_POOL_MAX_DB`），hardMax = softMax × 4

### JdbcTemplate

**必须用 `ResultSetExtractor`，不能用 `RowCallbackHandler`**——0-row 表用后者会静默丢失（CLAUDE.md Gotcha 已记录）。`SqlExecutionService` 用 `ResultSetExtractor` 收集 schema + 数据。

## 故障排查

### 端口冲突（8080 被占）

后端启动失败 "Port 8080 was already in use"：

```bash
# Windows
netstat -ano | findstr :8080
# 找到 PID 后
taskkill /PID <pid> /F

# Linux/macOS
lsof -i :8080
kill -9 <pid>
```

### DB 淘汰（多 tab 打开超 softMax）

多 tab 打开超过 `softMax`（默认 500）导致 oldest idle session 被 LRU 踢出。检查 `DatabasePoolManager` 日志：

```
WARN  ... SOFT_MAX reached: 500 pools (current: 500), triggering eager eviction
INFO  ... Batch evicted N idle pools to reach target 500
```

被踢的 tab 下次执行 SQL 会触发 `createNewPool` 重建空库——用户看到表格消失。临时缓解：调高 `SQLIVE_POOL_MAX_DB`；长期：用户关掉不用的 tab。

### AI 超时

`AiService` 超时配置（`application.yml` `ai.timeout`）：connect=5s、read=60s、write=30s。超时后日志：

```
ERROR ... Stream chat failed: provider=deepseek, elapsed=60000ms, error=...
```

排查：
1. `DEEPSEEK_API_KEY` 是否配置（生产 Render Environment）
2. DeepSeek API 是否可达（`curl https://api.deepseek.com/v1/models -H "Authorization: Bearer $DEEPSEEK_API_KEY"`）
3. 切换 provider：`application.yml` `ai.provider: ollama` / `lm-studio` / `openai-compatible`
