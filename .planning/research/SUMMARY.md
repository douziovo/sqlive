# Research Summary: sqlive Tech Debt Cleanup

**Date:** 2026-05-29
**Confidence:** HIGH

## Executive Summary

sqlive 是一个全栈 SQL playground，有 15 项跨 6 个维度的技术债待修复。每个调研维度——解析器正确性、会话淘汰、安全防护、内联编辑、AI 健壮性、限流——目前都低于生产级基线。推荐四阶段构建：(1) 后端基础设施 (6 个独立低风险修复)，(2) 解析器统一和数据层 (建立 canonical 语句边界)，(3) 前端可靠性 (依赖新的解析器位置)，(4) 安全加固 (纵深防御)。

最高风险项：统一前后端 SQL 解析器 (SQL-01)——前后端有独立解析器，在 `BEGIN...END` 块和 `CASE` 表达式上已知存在分歧，导致内联编辑在过程式 SQL 上静默失败。

## Key Findings

### Stack
- 所有 10 项修复仅使用现有栈组件，零新依赖
- 解析器位置内联于 execute 响应中暴露（零额外延迟）
- SQLite 安全：`PRAGMA trusted_schema=OFF` + ATTACH 字符串阻断
- AI WebClient：HttpClient 级别超时配置
- FK 安全清理：拓扑排序 DROP 替代 PRAGMA 切换

### Features
- 8 个 P1 必须修复项（canonical 边界、LRU 淘汰、AI 超时、ATTACH 禁用、日志脱敏、限流清理、截断告警、幽灵行保留）
- 3 个 P2 应该修复项（FK 安全、内联错误反馈、authorizer 回调）
- 明确区分了 hobby 项目和可靠工具的阈值

### Architecture
- 15 个修复映射到三层：后端基础设施 (6)、后端数据/安全 (4)、前端 (4)
- SQL-01 是最有架构影响力的变更——两个前端修复 (EDIT-01, GHOST-01) 依赖其新的解析器边界
- 修复交互风险：SQL-01 + EDIT-01 都修改 sqlStatements.ts（先做 SQL-01），FK-01 + SEC-01 都修改 SqlExecutionService（顺序安全）

### Pitfalls
- 6 个关键陷阱已识别，每个都有代码引用、预警信号和恢复策略
- "看起来修好了但其实没修好"检查清单覆盖 9 项验证点

## Suggested Phases

1. **Phase 1: Backend Infrastructure** — 6 个独立修复 (EVICT-01, RATE-01, WARN-01, AI-01, AI-02, SEC-02)
2. **Phase 2: Parser Unification & Data Layer** — 3 个顺序修复 (VALID-01 → SQL-01 → FK-01)
3. **Phase 3: Frontend Reliability** — 4 个可并行修复 (TYPE-01, EDIT-01, GHOST-01, ER-01)
4. **Phase 4: Security Hardening** — 1 个修复 (SEC-01)

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | 所有选择已针对代码库验证 |
| Features | HIGH | 已与 CONCERNS.md 和行业研究交叉验证 |
| Architecture | HIGH | 基于所有受影响文件的源码阅读 |
| Pitfalls | HIGH | 所有 6 个陷阱有代码引用、预警信号和恢复策略 |

## Open Questions

1. EVICT-01: 引用计数 vs 宽限期 vs 读写锁——需在 plan 阶段确定
2. AI-01: DeepSeek/Ollama/LMStudio 的超时默认值需确定
3. GHOST-01: 状态机验证需要所有失败模式的测试场景

---
*Research complete: 2026-05-29*
