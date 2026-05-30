# sqlive

## What This Is

一个全栈 SQL 在线 playground：Monaco 代码编辑器 → SQLite 内存后端 → 表格可视化与内联编辑。支持 AI 对话（多 provider）、ER 图生成和知识图谱。当前进入技术债清理阶段，修复已识别的正确性问题、资源泄漏、已知 Bug 和安全加固项。

## Core Value

用户能可靠地在浏览器中编写 SQL、查看结果、内联编辑数据——SQL 解析必须正确，数据库会话不会被意外淘汰，AI 功能不会因超时耗尽线程池。

## Requirements

### Validated

- 基于 Monaco 的 SQL 代码编辑器，1 秒防抖自动执行
- SQLite 内存数据库（shared cache 模式），每 tab/session 独立实例
- 表格结果可视化，支持内联单元格编辑（双向同步到源码）
- AI 流式对话，支持 DeepSeek / Ollama / LM Studio / OpenAI 兼容接口
- ER 图自动生成（vue-flow + dagre 布局）
- 知识图谱可视化
- 多 tab / 多数据库会话管理

### Active

- [ ] **SQL-01**: 统一前后端 SQL 语句解析——前端使用后端返回的 canonical 语句边界，不再独立解析
- [ ] **FK-01**: 修复 `clearDatabase()` 在共享连接上开关 `foreign_keys` 的并发竞争
- [ ] **WARN-01**: 将 `@SuppressWarnings("SqlSourceToSinkFlow")` 收缩到具体 `stmt.execute()` 调用行
- [ ] **VALID-01**: 统一 `SqlRequest` DTO 和 `DatabasePoolManager` 的 `dbName` 校验正则
- [ ] **EVICT-01**: 实现 LRU 数据库淘汰策略，替代 `ConcurrentHashMap` 随机淘汰
- [ ] **RATE-01**: 为 `RateLimitFilter` 添加过期条目定期清理
- [ ] **AI-01**: 为 `OpenAiCompatibleProvider` 的 WebClient 添加连接/读/写超时配置
- [ ] **AI-02**: 修复 `AiService.providers` 的 `volatile` 语义——去除误导或实现原子替换
- [ ] **TYPE-01**: `useInlineEdit` 的 `emit` 参数改为泛型，保留 TypeScript 类型安全
- [ ] **ER-01**: 修复 ER 图面板重新打开后节点坐标归零 `{x: 0, y: 0}` 的问题
- [ ] **EDIT-01**: `enforceTypeConstraints` 截断 VARCHAR 值时提示用户，而非静默截断
- [ ] **GHOST-01**: 插入失败时保留幽灵行输入状态，不清空输入框
- [ ] **SEC-01**: 禁用 `ATTACH DATABASE` 和危险 PRAGMA，防止服务器文件系统读写
- [ ] **SEC-02**: 脱敏 AI provider 错误日志中的 `Authorization` header

### Out of Scope

- CORS 端口收窄 — 当前 localhost 场景下影响低，待部署模式明确后再处理
- 前端 SQL 解析器支持 dollar-quoted string — SQLite 不支持此语法，非必要
- 性能优化（增量 UPDATE、MetadataExtractor 缓存） — 当前规模未触及瓶颈
- 测试覆盖率提升 — 不在本里程碑范围内

## Context

- **现有代码量**：前端 Vue 3 + Vite 8.x + Tailwind CSS 4；后端 Spring Boot 4.0.6 + JDBC Template + SQLite
- **代码库已映射**：`.planning/codebase/` 下有完整的架构、技术栈、关注点、测试等分析文档
- **已知脆弱区域**：`useBidirectionalSync`（字符串匹配敏感）、`SqlParser.parseStatementsPrecise()`（手写状态机）、AI protocol 实现（错误处理的健壮性）
- **测试现状**：后端 JaCoCo 50% 阈值，前端 41 处 `vi.fn()` mock，部分关键路径缺乏直接单元测试

## Constraints

- **技术栈锁定**: JDK 21 (Zulu), Spring Boot 4.0.6, Vue 3 `<script setup>`, Vite 8.x, SQLite JDBC
- **不引入新依赖**: 技术债修复优先使用现有库，避免为修改引入新框架
- **最小变更原则**: 每个修复只触及必要的文件和行，不顺便重构

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 安全加固只做 ATTACH 禁用和日志脱敏，不做 CORS 收窄 | CORS 收窄需要确定部署端口，当前仅本地开发 | — Pending |
| 性能优化移出本次范围 | 当前规模未触及瓶颈，优先修正确性问题 | — Pending |
| 前端解析器统一方案采用后端暴露 canonical 边界 | 避免维护两份解析器，从根源消除不一致 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-29 after initialization*
