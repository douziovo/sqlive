# Requirements: sqlive Tech Debt Cleanup

**Defined:** 2026-05-29
**Core Value:** 用户能可靠地在浏览器中编写 SQL、查看结果、内联编辑数据——SQL 解析必须正确，数据库会话不会被意外淘汰，AI 功能不会因超时耗尽线程池。

## v1 Requirements

### Core Correctness

- [x] **CORE-01**: 后端 API 响应中暴露 canonical 语句边界（start/end 字符偏移），前端使用其替代独立解析（SQL 解析器统一）
- [x] **CORE-02**: `clearDatabase()` 使用拓扑排序按 FK 依赖顺序 DROP 表，不再开关 `PRAGMA foreign_keys`（外键竞争修复）
- [x] **CORE-03**: `@SuppressWarnings("SqlSourceToSinkFlow")` 收缩到具体 `stmt.execute()` 调用行（警告抑制精确化）
- [x] **CORE-04**: 统一 `SqlRequest` DTO 和 `DatabasePoolManager` 的 dbName 校验正则，使用严格模式 `^[a-zA-Z0-9_-]{1,64}$`（dbName 校验一致）

### Infrastructure

- [x] **INFRA-01**: `DatabasePoolManager` 实现 LRU 淘汰策略，替代 ConcurrentHashMap 随机淘汰（数据库 LRU 淘汰）
- [x] **INFRA-02**: `RateLimitFilter` 添加定时清理过期条目，防止 ConcurrentHashMap 无界增长（限流器内存泄漏）

### AI Robustness

- [x] **AI-01**: `OpenAiCompatibleProvider` 的 WebClient 添加 connect/read/write 超时配置，按 provider 类型区分流式/非流式超时值（AI 超时修复）
- [x] **AI-02**: 修复 `AiService.providers` 的 `volatile` 语义——移除误导性 volatile 或实现原子替换（AI volatile 修复）

### Frontend Quality

- [ ] **FRONT-01**: `useInlineEdit` 的 emit 参数改为泛型，保留 TypeScript 类型安全（emit 类型修复）
- [ ] **FRONT-02**: `enforceTypeConstraints` 截断 VARCHAR 值时通过 toast/提示告知用户，不再静默截断（内联编辑截断告警）
- [ ] **FRONT-03**: 插入失败时保留幽灵行输入状态，不清空输入框，让用户修正后重试（幽灵行状态修复）
- [ ] **FRONT-04**: 修复 ER 图面板重新打开后节点坐标归零 `{x: 0, y: 0}` 的问题（ER 图节点复位）

### Security

- [x] **SEC-01**: 禁用 `ATTACH DATABASE` + `PRAGMA trusted_schema=OFF`，防止用户通过 SQLite 读写服务器文件系统（SQL 沙箱加固）
- [x] **SEC-02**: 脱敏 AI provider 错误日志中的 Authorization header，防止 API key 泄露（日志脱敏）

## v2 Requirements

Deferred to future release.

- **速率限制锁优化** — `synchronized` 窗口替换为 striped lock 或 LongAdder（当前规模未达瓶颈）
- **CORS 端口收窄** — 从 `localhost:*` 收窄到固定端口（待部署模式确定）
- **前端解析器完全移除** — 待 canonical 边界方案稳定后移除 `extractSqlStatements()`
- **MetadataExtractor 缓存** — 单次请求内复用 sqlite_master 查询结果

## Out of Scope

| Feature | Reason |
|---------|--------|
| 增量 UPDATE（替代全脚本重执行） | 架构变更大，当前数据量未触及瓶颈 |
| 前端 SQL 解析器支持 dollar-quoted string | SQLite 不支持此语法，非必要 |
| 测试覆盖率提升（JaCoCo 50%→80%） | 不在本里程碑范围，技术债修复后再规划 |
| AI 流式响应完全非阻塞化 | 涉及架构调整，当前 Tomcat 默认 200 线程够用 |
| 新功能开发 | 本里程碑仅做技术债清理 |
| 第三方 AI provider endpoint 配置化 | 改动范围超出技术债修复 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CORE-01 | Phase 2 | Complete |
| CORE-02 | Phase 2 | Complete |
| CORE-03 | Phase 1 | Complete |
| CORE-04 | Phase 2 | Complete |
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Complete |
| AI-01 | Phase 1 | Complete |
| AI-02 | Phase 1 | Complete |
| FRONT-01 | Phase 3 | Pending |
| FRONT-02 | Phase 3 | Pending |
| FRONT-03 | Phase 3 | Pending |
| FRONT-04 | Phase 3 | Pending |
| SEC-01 | Phase 4 | Complete |
| SEC-02 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 14 total
- Mapped to phases: 14 (all mapped)
- Unmapped: 0

---
*Requirements defined: 2026-05-29*
*Last updated: 2026-05-29 after roadmap creation*
