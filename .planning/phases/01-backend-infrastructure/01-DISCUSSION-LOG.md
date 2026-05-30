# Phase 1: Backend Infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-29
**Phase:** 1-backend-infrastructure
**Areas discussed:** LRU 淘汰策略, AI 超时配置, 日志脱敏, 限流清理 + volatile

---

## LRU 淘汰策略 (INFRA-01)

| Option | Description | Selected |
|--------|-------------|----------|
| LinkedHashMap + synchronized | 用 access-order LinkedHashMap 包装，JDK 内置，最简单 | ✓ |
| 时间戳追踪 + 扫描淘汰 | ConcurrentHashMap value 附加 lastAccessTime，淘汰时 O(n) 扫描 | |
| FIFO 淘汰 | 不追踪访问时间，淘汰最早创建的 | |

**User's choice:** 什么样的数据库会被淘汰 → 20 分钟无请求可淘汰，命名库也可淘汰但淘汰后需前端重建

**Notes:**
- 淘汰策略：活跃库不淘汰，闲置 20 分钟淘汰（含命名库）
- Pool 满时阻塞等待淘汰完成
- 清理：定时扫描 + pool-满驱逐，两者结合
- 淘汰后：返回特定错误信号 → 前端提示 + re-request 重建
- 1000 以内用 LinkedHashMap + synchronized

---

## AI 超时配置 (AI-01)

| Option | Description | Selected |
|--------|-------------|----------|
| 统一默认值 | 所有 provider 同一组超时值 | ✓ |
| 按 provider 区分 | DeepSeek 60s / Ollama 120s / LM Studio 120s | |
| 按流式/非流式区分 | SSE 120s / JSON 30s | |

**User's choice:** 统一默认值 connect=5s, read=60s, write=30s，配置在 application.yml

**Notes:** 后续如有需要可扩展为 per-provider 覆盖

---

## 日志脱敏 (SEC-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Provider 层 catch 块 | 构造日志消息时过滤 header，精准定点 | ✓ |
| Logback 过滤器 | 全局覆盖，正则匹配 | |
| 异常处理器层 | GlobalExceptionHandler 统一处理 | |

**User's choice:** Provider 层 catch 块，仅脱敏 Authorization header → `[REDACTED]`

**Notes:** 用户要求解释每个方案的优劣后再选择

---

## 限流清理 (INFRA-02)

| Option | Description | Selected |
|--------|-------------|----------|
| 定时清理 | ScheduledExecutorService 定期扫描 | |
| 惰性清理 | 访问时淘汰过期窗口 | |
| 两者结合 | 惰性清理 + 定时兜底 | ✓ |

**User's choice:** 两者结合

---

## volatile 修复 (AI-02)

| Option | Description | Selected |
|--------|-------------|----------|
| 移除 volatile | providers 在 init() 后不可变 | |
| 保留 + 实现原子替换 | 保留 volatile + refreshProviders() | ✓ |

**User's choice:** 保留 volatile + 实现原子替换 refreshProviders()

---

## Claude's Discretion

- @SuppressWarnings 收缩 (CORE-03): 移动注解到具体 stmt.execute() 行
- LRU 数据结构具体选型：LinkedHashMap access-order
- 定时清理线程池大小：单线程守护线程
- refreshProviders() 触发方式
- 淘汰错误信号格式

## Deferred Ideas

None.
