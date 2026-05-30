# Phase 1: Backend Infrastructure - Context

**Gathered:** 2026-05-29
**Status:** Ready for planning

<domain>
## Phase Boundary

后端基础设施修复：6 项独立的后端 bug 修复，全在 Java 层。让后端服务不再泄漏内存、不因 AI provider 慢而挂起、不泄露 API key 到日志。不涉及前端、不引入新依赖、每个修复最小变更。

</domain>

<decisions>
## Implementation Decisions

### LRU 淘汰策略 (INFRA-01)
- **D-01:** 闲置超时 20 分钟触发淘汰，所有数据库（含命名库）均可淘汰
- **D-02:** 活跃数据库（20 分钟内有请求）不淘汰
- **D-03:** Pool 满时阻塞等待淘汰完成后创建新数据库
- **D-04:** 清理机制采用两者结合：定时扫描（ScheduledExecutorService 每 5 分钟）+ pool 满时立即驱逐最久未用
- **D-05:** 淘汰后后端返回特定错误信号，前端负责提示用户 + 发起 reset 重建空库
- **D-06:** 1000 以内数据库规模用 LinkedHashMap access-order + synchronized 追踪访问顺序

### AI 超时配置 (AI-01)
- **D-07:** 所有 provider 统一默认超时值：connect=5s, read=60s, write=30s
- **D-08:** 配置在 application.yml 的 `ai.timeout` 段落下

### 日志脱敏 (SEC-02)
- **D-09:** 在 OpenAiCompatibleProvider 的 catch 块中处理
- **D-10:** 仅脱敏 Authorization header，将 `Authorization: Bearer xxx` 替换为 `Authorization: [REDACTED]`

### 限流器清理 (INFRA-02)
- **D-11:** 惰性清理（访问时淘汰过期窗口）+ 定时兜底清理（ScheduledExecutorService 每 5 分钟）

### volatile 修复 (AI-02)
- **D-12:** 保留 volatile + 实现 refreshProviders() 方法，支持运行时原子替换 provider 列表

### Claude's Discretion

- @SuppressWarnings 收缩 (CORE-03): 直接移动注解到具体 `stmt.execute()` 调用行，无需额外决策
- LRU 访问时间追踪的具体数据结构选择（LinkedHashMap vs 包装类），1000 以内用 LinkedHashMap
- 定时清理 ScheduledExecutorService 的具体线程池大小（建议单线程守护线程）
- refreshProviders() 的触发方式（建议配置变更检测或 REST 端点）
- 淘汰错误信号的 HTTP 状态码和响应格式

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning artifacts
- `.planning/ROADMAP.md` — Phase 1 需求映射与成功标准
- `.planning/REQUIREMENTS.md` — 需求追溯（CORE-03, INFRA-01, INFRA-02, AI-01, AI-02, SEC-02）
- `.planning/PROJECT.md` — 项目约束（不引入新依赖、最小变更原则、技术栈锁定）

### Source files to modify
- `sqlive-backend/src/main/java/com/douzi/sqlive/service/database/DatabasePoolManager.java` — LRU 淘汰目标文件（INFRA-01）
- `sqlive-backend/src/main/java/com/douzi/sqlive/service/ai/OpenAiCompatibleProvider.java` — WebClient 超时 + 日志脱敏目标文件（AI-01, SEC-02）
- `sqlive-backend/src/main/java/com/douzi/sqlive/service/ai/AiService.java` — volatile + refreshProviders 目标文件（AI-02）
- `sqlive-backend/src/main/java/com/douzi/sqlive/config/RateLimitFilter.java` — 限流器清理目标文件（INFRA-02）
- `sqlive-backend/src/main/java/com/douzi/sqlive/service/SqlExecutionService.java` — @SuppressWarnings 收缩目标文件（CORE-03）
- `sqlive-backend/src/main/resources/application.yml` — AI 超时配置目标文件（AI-01）

### Codebase maps
- `.planning/codebase/ARCHITECTURE.md` — 架构图、数据流、关键抽象
- `.planning/codebase/STACK.md` — 技术栈（Spring Boot 4.0.6, JDK 21, HikariCP, WebClient）
- `.planning/codebase/INTEGRATIONS.md` — AI provider 配置、端点、连接池
- `.planning/codebase/CONCERNS.md` — 已知脆弱区域和安全考量

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DatabasePoolManager`: 已有 `ConcurrentHashMap<String, JdbcTemplate>` + `ReentrantLock` + `@PreDestroy` 清理。改造为 LRU 时复用现有锁和生命周期机制
- `OpenAiCompatibleProvider.buildWebClient()`: 已有 `WebClient.builder()` 创建点，只需添加 `HttpClient` 配置
- `RateLimitFilter`: 已有 `ConcurrentHashMap<String, long[]>` + `synchronized` 窗口模式，清理逻辑在此框架内叠加

### Established Patterns
- Spring Boot 配置注入：`@Value` / `@ConfigurationProperties` 读取 application.yml
- 后端构造函数注入：所有 service 使用显式构造函数
- `@Slf4j` 日志模式：所有 controller 和 service 统一使用

### Integration Points
- `SqlController → SqlExecutionService → DatabasePoolManager`: LRU 修改影响此调用链
- `AiController → AiService → OpenAiCompatibleProvider`: 超时和脱敏修改影响此调用链
- `RateLimitFilter` (在 `WebConfig` 中注册): 限流器修改在 filter chain 中生效
- `GlobalExceptionHandler`: 淘汰错误信号的异常处理可能需新增 handler

</code_context>

<specifics>
## Specific Ideas

无特殊偏好——开放使用标准方案实现上述决策。

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-Backend Infrastructure*
*Context gathered: 2026-05-29*
