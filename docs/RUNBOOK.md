# Runbook

操作手册——部署、调试、故障排查。架构见 [ARCHITECTURE.md](ARCHITECTURE.md)，当前工作入口与本地开发见 [DEVELOPMENT.md](DEVELOPMENT.md#当前焦点)，检查命令见 [TESTING.md](TESTING.md)。

## 部署

### Render（生产）

`render.yaml` 单服务配置：Docker runtime、free tier、绑 `master` 分支自动部署、健康检查 `/actuator/health`。

**必配环境变量**（Render Dashboard → Environment）：

| 变量 | 必填 | 说明 |
|---|---|---|
| `DEEPSEEK_API_KEY` | 是（生产）| DeepSeek API key，`AiService` 默认 provider 用 |
| `AI_API_KEY` | **是（生产）** | `render.yaml` 尚未声明，需在部署环境配置。设置后 `/api/ai/**` 要求匹配的 `X-API-Key`；未设置时允许公开访问，并在非 dev/test profile 启动时输出告警。前端从 `VITE_AI_API_KEY` 或 localStorage 的 `ai_api_key` 读取请求凭据 |
| `SQLIVE_SQLITE_URL` | 否（有默认）| 配置 `spring.datasource.url`，默认 `jdbc:sqlite:file:playground?mode=memory&cache=shared`；按 dbName 创建的执行会话使用下文所述的独立连接串 |
| `SQLIVE_POOL_MAX_DB` | 否（有默认）| Render 配置为 50；本地 `application.yml` 默认为 500 |
| `JAVA_TOOL_OPTIONS` | 否（render.yaml 已配）| `-Xmx384m -Xms128m -XX:MaxMetaspaceSize=128m -XX:+UseSerialGC`——free tier 512MB JVM 限制（commit `edba435`）|

**Docker 构建**：多阶段 `Dockerfile`——前端 `node:22-alpine` 用 pnpm 构建 dist → 后端 `eclipse-temurin:25-jdk` 将 dist 拷入 Spring Boot static resources → 运行时 `eclipse-temurin:25-jre`。本地、CI 和 Docker 统一使用 Gradle wrapper 9.2.1，Docker 执行 `./gradlew bootJar --no-daemon -x test`；此构建步骤跳过测试，测试范围见 [TESTING.md](TESTING.md)。

```bash
docker build -t sqlive .
docker run -p 8080:8080 sqlive
```

### 本地 dev

在 `sqlive-frontend` 执行 `pnpm run dev`（默认 5173）；默认相对 API 路径通过 Vite 代理到 :8080，`.env` 中的绝对地址可覆盖该路径。
在 `sqlive-backend` 执行 `./gradlew bootRun`；Windows 使用 pwsh 和 `.\gradlew.bat bootRun`（默认 8080）。

JDK 25（Zulu），设置环境变量 `JAVA_HOME` 后用 `java -version` 和 `./gradlew --version` 验证。Windows 使用 `$env:JAVA_HOME = 'C:\Program Files\Zulu\zulu-25'` 和 `.\gradlew.bat --version`。

## 调试

### SQLite in-memory pool

执行会话由 [DatabasePoolManager.java](../sqlive-backend/src/main/java/com/douzi/sqlive/service/database/DatabasePoolManager.java) 按 dbName 创建：`jdbc:sqlite:file:{name}?mode=memory&busy_timeout=5000`。每个池最多一个 JDBC 连接；相同 dbName 复用同一个池，不同 dbName 使用不同池。这些连接串不读取 `SQLIVE_SQLITE_URL`。

池按 LinkedHashMap access-order 维护 LRU。获取、释放、空闲清理和淘汰共享 `DatabasePoolManager` 对象锁；淘汰跳过仍有引用的池。同一数据库的整段脚本执行（含 reset、语句和元数据提取）由 `SqlExecutionService` 的 `synchronized (jdbc)` 串行化。当前实现已在 `c00deef` 中替换旧的 generation 校验方案。

LRU 淘汰参数（`application.yml` 可覆盖）：

- `pool.idle-timeout` 默认 30m（`SQLIVE_POOL_IDLE_TIMEOUT`）
- `pool.cleanup-interval` 默认 5m（`SQLIVE_POOL_CLEANUP_INTERVAL`）
- `pool.max-databases` 默认 500（`SQLIVE_POOL_MAX_DB`），hardMax = softMax × 4；Render 覆盖 softMax 为 50

### JdbcTemplate

**必须保留零行表的 schema**。[MetadataExtractor.java](../sqlive-backend/src/main/java/com/douzi/sqlive/service/metadata/MetadataExtractor.java) 使用 `ResultSetExtractor`，并通过 ResultSetMetaData 提取列结构；替换查询回调时，要保留没有数据行时的列信息。

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

池数超过 softMax 时，定时清理按 LRU 淘汰空闲池；每轮清理也检查空闲超时。获取池时可见以下日志：

```
WARN  ... SOFT_MAX reached: 500 pools (current: 500), triggering eager eviction
```

被淘汰的会话下次执行 SQL 会创建空库；`SqlExecutionService` 在非显式 reset 时设置 `sessionRecreated`。达到 hardMax 会拒绝新库请求；非本地 IP 还受每 IP 50 个池限制。可按容量调整 `SQLIVE_POOL_MAX_DB`、空闲超时和清理周期。

### AI 超时

AI provider 超时配置（`application.yml` `ai.timeout`）：connect=5s、read=60s、write=30s。流式错误日志形如：

```
ERROR ... Stream chat failed: provider=deepseek, elapsed=60000ms, error=...
```

排查：

1. `DEEPSEEK_API_KEY` 是否配置（生产 Render Environment）
2. DeepSeek API 是否可达（`curl https://api.deepseek.com/v1/models -H "Authorization: Bearer $DEEPSEEK_API_KEY"`）
3. 切换 provider：`application.yml` `ai.provider: ollama` / `lmstudio` / `openai-compatible`，并检查对应 base-url 与模型名
