# Phase 3: Frontend Reliability - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-30
**Phase:** 03-Frontend Reliability
**Areas discussed:** Emit 类型安全, VARCHAR 截断警告, 幽灵行状态保持, ER 图节点坐标持久

---

## Emit 类型安全 (FRONT-01)

| Option | Description | Selected |
|--------|-------------|----------|
| 最小修复 | 将 emit 参数改为泛型：`useInlineEdit<T>(..., emit: T)`，调用方传入时自然推断类型 | ✓ |
| 完全明确类型 | 定义专用回调接口 `{ onUpdateCell: (args) => void }`，不再传裸 emit | |

**User's choice:** 最小修复（推荐）
**Notes:** 只修 `useInlineEdit.ts` 一个文件，不做全链路 emit 排查。Vue 的 `defineEmits` 类型会通过泛型自动推断。

### 范围确认

| Option | Description | Selected |
|--------|-------------|----------|
| 只修 useInlineEdit | 只改 useInlineEdit.ts 的 emit 签名 | ✓ |
| 全链路检查 | 也检查 TableSection.vue 中其他 emit 使用 | |

**User's choice:** 只修 useInlineEdit（推荐）

---

## VARCHAR 截断警告 (FRONT-02)

| Option | Description | Selected |
|--------|-------------|----------|
| 内联提示 | `enforceTypeConstraints` 返回值附带截断信息，单元格旁显示短暂 tooltip/inline warning | ✓ |
| 轻量 toast 通知 | App.vue 层加 toast 容器，截断几秒后自动消失 | |
| 控制台警告 | 只在 DEV 模式 console.warn | |

**User's choice:** 内联提示（推荐）
**Notes:** 不需要新依赖，复用现有 CSS/UI 模式。

### 返回值方案

| Option | Description | Selected |
|--------|-------------|----------|
| 改 enforceTypeConstraints 返回值 | 从裸值改为 `{ value, truncated?: { originalLength, maxLength } }` | ✓ |
| 在 handleBlur 中单独检查 | enforceTypeConstraints 不动，额外加长度检查函数 | |

**User's choice:** 改 enforceTypeConstraints 返回值（推荐）

---

## 幽灵行状态保持 (FRONT-03)

| Option | Description | Selected |
|--------|-------------|----------|
| 成功回调/watch 清除 | watch `db.tables` 行数变化判断插入成功后才清除 | ✓ |
| 延迟清除 | 发出 insert-row 后通过 watch code 变化推断执行完成 | |

**User's choice:** 成功回调/watch 清除（推荐）

### 成功检测方式

| Option | Description | Selected |
|--------|-------------|----------|
| watch db.tables 行数变化 | TableSection 中 watch 对应表的 `rows.length` 增加 → 成功 | ✓ |
| insertRowUI 返回 Promise | 改变 useSqlEngine 执行流程，改动较大 | |

**User's choice:** watch db.tables 行数变化（推荐）
**Notes:** 执行失败时 `executionError` 非 null，ghostRow 自然保留。

---

## ER 图节点坐标持久 (FRONT-04)

| Option | Description | Selected |
|--------|-------------|----------|
| v-show 替代 v-else-if | 组件常驻内存不销毁，节点坐标自然保留，一行改动 | ✓ |
| 坐标缓存到 useErDiagram | 保持 v-else-if，缓存 dagre 布局坐标并在重建时恢复 | |

**User's choice:** v-show 替代 v-else-if（推荐）
**Notes:** 4 个 tab 同时渲染对当前数据规模无实质影响。v-show 脱离 v-if 链后 v-else-if 链继续正常工作。

---

## Claude's Discretion

以下实现细节由开发者自行决定：
- `EmitFn` 泛型的具体约束写法
- 内联截断警告的具体 UI 实现（CSS tooltip vs 简短文本 vs hover-card）
- 截断信息从 `useInlineEdit` 到 `TableSection` 的传递方式
- 幽灵行清除的 watch 具体写法
- 首次渲染时 `onPaneReady` 初始布局逻辑保留

## Deferred Ideas

None — no scope creep during discussion.
