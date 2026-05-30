# Phase 4: Security Hardening - Context

**Gathered:** 2026-05-30
**Status:** Ready for planning

<domain>
## Phase Boundary

在 `SqlExecutionService` 层面拦截危险 SQL 语句——ATTACH DATABASE 和所有用户发出的 PRAGMA 语句在到达 SQLite 之前被拒绝，防止服务器文件系统访问和信息泄露。

纯后端改动，只修改 `SqlExecutionService.java`，不涉及新依赖，最小变更。
</domain>

<decisions>
## Implementation Decisions

### 拦截策略
- **D-01:** 拦截所有 `ATTACH DATABASE` 和 `ATTACH` 语句——使用正则 `(?i)^\s*ATTACH\s` 匹配语句开头（不区分大小写），同时覆盖 `ATTACH DATABASE '...' AS ...` 和简写 `ATTACH '...' AS ...` 两种形式
- **D-02:** 拦截所有用户提交的 PRAGMA 语句——使用正则 `(?i)^\s*PRAGMA\b` 匹配语句开头。选择全量拦截而非黑名单原因：(a) SQL playground 场景下用户无需 PRAGMA；(b) 维护黑名单有遗漏风险（SQLite 版本升级可能新增危险 PRAGMA）；(c) 实现更简单
- **D-03:** 后端自身的 PRAGMA（`foreign_keys = OFF`、`index_info`、`foreign_key_list`）不受影响——它们在逐语句循环外通过独立 `jdbc.execute()` 调用执行
- **D-04:** 注：由于每个请求执行前都会 `reset`（重建数据库），上一个请求通过 ATTACH 附加的数据库不会影响下一个请求，但 ATTACH 本身在单个请求内仍有文件系统访问风险，必须拦截

### 注入点
- **D-05:** 在 `SqlExecutionService.execute()` 第 51 行（空白语句跳过）和第 53 行（`jdbc.execute(...)`）之间注入检查——解析后、执行前
- **D-06:** 使用 `s.sql().trim()` 获取标准化语句文本进行匹配
- **D-07:** 使用 `s.startLine()` 返回错误行号（1-based，与现有错误行号格式一致）

### 错误返回
- **D-08:** 被拦截语句返回 `SqlResponse.error(message, s.startLine())`，复用现有静态工厂方法和错误格式
- **D-09:** ATTACH 错误消息：`"ATTACH DATABASE is not allowed for security reasons"`
- **D-10:** PRAGMA 错误消息：`"PRAGMA statements are not allowed"`

### Claude's Discretion

- 正则表达式的具体写法、是否提取为私有方法 `isBlockedStatement(String sql)` 
- 检查代码的具体位置（在空白跳过之后第一个插入即可）
- 是否添加单元测试文件 `SqlExecutionServiceTest.java`（计划阶段决定）
- 后端测试验证的具体用例
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning artifacts
- `.planning/ROADMAP.md` — Phase 4 成功标准与需求映射
- `.planning/REQUIREMENTS.md` — SEC-01 需求定义
- `.planning/PROJECT.md` — 项目约束（不引入新依赖、最小变更原则、技术栈锁定）

### Source files to modify
- `sqlive-backend/src/main/java/com/douzi/sqlive/service/SqlExecutionService.java` — 注入拦截检查（SEC-01）

### Source files to read (for context)
- `sqlive-backend/src/main/java/com/douzi/sqlive/service/sql/SqlParser.java` — `SqlStatement` record 结构（`sql()`, `startLine()`, `startPos()`），`isKeyword()` 辅助方法
- `sqlive-backend/src/main/java/com/douzi/sqlive/dto/SqlResponse.java` — 错误响应格式和 `SqlResponse.error()` 静态工厂
- `sqlive-backend/src/main/java/com/douzi/sqlive/dto/ErrorPayload.java` — 错误载荷结构
- `sqlive-backend/src/main/java/com/douzi/sqlive/service/database/DatabasePoolManager.java` — PRAGMA foreign_keys 使用点（确认不受影响）
- `sqlive-backend/src/main/java/com/douzi/sqlive/service/metadata/MetadataExtractor.java` — PRAGMA index_info/foreign_key_list 使用点（确认不受影响）

### Backend tests (to read/add)
- `sqlive-backend/src/test/java/com/douzi/sqlive/service/SqlExecutionServiceTest.java` — 现有测试，需新增 ATTACH/PRAGMA 拦截测试用例
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SqlResponse.error(message, line)` 静态工厂——已用于连接池满、SQL 执行错误等场景，拦截检查直接复用
- `SqlParser.SqlStatement` record——已提供 `sql()`（语句文本）、`startLine()`（1-based 行号）、`startPos()`（字符偏移）

### Established Patterns
- 逐语句错误处理：`catch (Exception e)` 在循环中捕获 SQLite 错误，通过 `SqlResponse.error()` 返回优雅错误——拦截检查遵循同样的立即返回模式
- 控制器级输入验证：`SqlController` 检查空 SQL 后立即返回 `SqlResponse.error("SQL cannot be empty", 0)`——同样的提前返回守卫模式
- 后端测试使用 JUnit Platform + `@SpringBootTest`，测试方法命名清晰

### Integration Points
- `SqlExecutionService.execute()` 第 50-73 行——逐语句执行循环，拦截插入在第 51-52 行之间
- 拦截后的 `return SqlResponse.error(...)` 会跳过后续语句执行、元数据提取、规范语句构建——与现有异常处理路径一致
</code_context>

<specifics>
## Specific Ideas

无特殊偏好——标准方案实现。ATTACH DATABASE 关键字检测和 PRAGMA 关键字检测都使用简单正则，匹配语句开头的关键字（排除在字符串或注释中的误匹配——此时语句已被 SqlParser 正确解析）。
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.
</deferred>

---

*Phase: 4-Security Hardening*
*Context gathered: 2026-05-30*
