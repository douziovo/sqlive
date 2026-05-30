# Phase 2: Parser Unification & Data Layer - Context

**Gathered:** 2026-05-29
**Status:** Ready for planning (skip discuss — Claude's discretion)

<domain>
## Phase Boundary

统一前后端 SQL 解析和后端数据层正确性：后端 `POST /api/execute` 响应中暴露 canonical 语句边界，前端使用其替代独立解析；`clearDatabase()` 按 FK 依赖顺序 DROP 表；统一 `SqlRequest` DTO 和 `DatabasePoolManager` 的 dbName 校验正则。

3 个需求，涉及后端 2 处修改、前端 1 处消费后端新字段。
</domain>

<decisions>
## Implementation Decisions

### Canonical 语句边界 (CORE-01)
- **D-01:** 后端 `/api/execute` 响应新增 `canonicalStatements` 字段：`{ start: number, end: number }[]` — 字符偏移（非字节偏移），与前端 JS 字符串索引一致
- **D-02:** 边界值从 `SqlParser.parseStatementsPrecise()` 的 `SqlStatement` 对象中提取（已有 `position` 和 `sql` 字段）
- **D-03:** 不新增 statement type 字段——当前需求不需要，未来可扩展

### 前端解析器迁移 (CORE-01)
- **D-04:** 前端 `useBidirectionalSync` 优先使用后端返回的 `canonicalStatements` 边界；当该字段为空/不存在时 fallback 到 `extractSqlStatements()`
- **D-05:** `extractSqlStatements()` 保留不删除——完全移除属于 v2 范围（REQUIREMENTS.md 已明确）

### FK 安全的 clearDatabase (CORE-02)
- **D-06:** 使用 `MetadataExtractor.extractForeignKeys()` 已有的 FK 数据构建依赖图
- **D-07:** 拓扑排序算法：构建邻接表 → 找到所有无入边的根节点 → BFS 遍历 → 按层倒序 DROP（叶子先删）
- **D-08:** 移除外键开关逻辑：删除 `PRAGMA foreign_keys = OFF/ON` 调用，仅依赖正确顺序的 DROP TABLE CASCADE

### dbName 校验统一 (CORE-04)
- **D-09:** 统一使用严格白名单正则 `^[a-zA-Z0-9_-]{1,64}$`
- **D-10:** 修改 `SqlRequest.java` 的 `@Pattern` 注解，使其与 `DatabasePoolManager` 一致（`DatabasePoolManager` 保持不动）

### Claude's Discretion

- `canonicalStatements` 在 `SqlResponse` 中的具体字段位置（放入 `data` 内与 `tables` 同级）
- 前端 fallback 的检测条件（`canonicalStatements && canonicalStatements.length > 0`）
- 拓扑排序的具体实现（BFS Kahn算法变体，O(V+E)）
- 环检测：FK 图中若有循环依赖，降级为随机顺序 + log.warn（极端边缘情况，生产环境不应出现）
- `SqlRequest.dbName` 的 `@Pattern` message 更新为明确提示允许的字符范围
</decisions>

<canonical_refs>
## Canonical References

### Planning artifacts
- `.planning/ROADMAP.md` — Phase 2 success criteria and requirements mapping
- `.planning/REQUIREMENTS.md` — CORE-01, CORE-02, CORE-04 definitions
- `.planning/PROJECT.md` — Project constraints (no new deps, minimal change)
- `.planning/phases/01-backend-infrastructure/01-CONTEXT.md` — Phase 1 context (carry-forward D-05: LRU error signal format for reference)

### Source files to modify
- `sqlive-backend/src/main/java/com/douzi/sqlive/service/SqlExecutionService.java` — Add canonicalStatements to response (CORE-01)
- `sqlive-backend/src/main/java/com/douzi/sqlive/service/sql/SqlParser.java` — Read-only: understand SqlStatement.position (CORE-01)
- `sqlive-backend/src/main/java/com/douzi/sqlive/dto/SqlResponse.java` — Add canonicalStatements field (CORE-01)
- `sqlive-backend/src/main/java/com/douzi/sqlive/service/SqlExecutionService.java` — clearDatabase() FK ordering (CORE-02)
- `sqlive-backend/src/main/java/com/douzi/sqlive/service/metadata/MetadataExtractor.java` — Read-only: extractForeignKeys() (CORE-02)
- `sqlive-backend/src/main/java/com/douzi/sqlive/dto/SqlRequest.java` — dbName @Pattern fix (CORE-04)
- `sqlive-backend/src/main/java/com/douzi/sqlive/service/database/DatabasePoolManager.java` — Read-only: dbName regex reference (CORE-04)
- `sqlive-frontend/src/composables/useBidirectionalSync.ts` — Consume canonicalStatements; fallback to extractSqlStatements (CORE-01)
- `sqlive-frontend/src/composables/useSqlEngine.ts` — Pass canonicalStatements from response to sync layer (CORE-01)

### Frontend types
- `sqlive-frontend/src/model/DatabaseTypes.ts` — Add CanonicalStatement type
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SqlParser.parseStatementsPrecise()`: 已返回 `List<SqlStatement>`，每个 `SqlStatement` 含 `position`（行号）和 `sql`（语句文本）。需要在 `SqlExecutionService` 中额外记录字符偏移
- `MetadataExtractor.extractForeignKeys()`: 已返回 `List<ForeignKey>`（含 `tableName`, `columnName`, `referencedTable`, `referencedColumn`），可直接用于构建依赖图
- `SqlResponse`: 已有 `{success, data, error}` 结构，`data` 内含 `tables`, `indexes`, `views`, `triggers`, `foreignKeys`。canonicalStatements 加入 `data` 同级

### Established Patterns
- Spring Boot `@Pattern` 验证 + `GlobalExceptionHandler.handleMethodArgumentNotValid()` 统一返回 400
- `useSqlEngine.executeSql()` 处理后端响应并分发给子 composable
- `useBidirectionalSync` 通过 `code.value.substring(absoluteStart, absoluteEnd)` 定位 VALUES 元组——与 canonical 边界使用方式一致

### Integration Points
- `SqlExecutionService.execute()` → 构建 `SqlResponse.data` 时新增字段
- `useSqlEngine.ts:129-161` → 解析响应时提取 `canonicalStatements` 传给 sync
- `useBidirectionalSync.updateRow()` → 接收可选 `canonicalStatements` 参数，优先于 `extractSqlStatements()`
</code_context>

<specifics>
## Specific Ideas

无特殊偏好——标准方案实现。CORE-01 的关键是对齐：后端字符偏移 = 前端 `code.value` 的 `substring` 参数，无需转换。

</specifics>

<deferred>
## Deferred Ideas

- 前端 `extractSqlStatements()` 完全移除 → Phase 2 后稳定验证通过再考虑（v2）
- 循环 FK 依赖检测的自动修复 → 边缘情况，log.warn 即可

</deferred>

---

*Phase: 2-Parser Unification & Data Layer*
*Context gathered: 2026-05-29*
