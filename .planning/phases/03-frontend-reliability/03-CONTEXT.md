# Phase 3: Frontend Reliability - Context

**Gathered:** 2026-05-30
**Status:** Ready for planning

<domain>
## Phase Boundary

前端交互可靠性修复：4 项独立的前端 bug 修复，全部在 TypeScript/Vue 层。让内联编辑不再静默截断数据、插入失败不再丢失输入、ER 图切 tab 后节点不归零、useInlineEdit 的 emit 签名去掉 `any`。

纯前端改动，不涉及后端，不引入新依赖，每个修复最小变更。
</domain>

<decisions>
## Implementation Decisions

### Emit 类型安全 (FRONT-01)
- **D-01:** `useInlineEdit` 的 `emit` 参数改为泛型：`emit: EmitFn`，其中 `EmitFn extends (e: string, ...args: any[]) => void`
- **D-02:** 只修 `useInlineEdit.ts` 一个文件，不做全链路 emit 排查

### VARCHAR 截断警告 (FRONT-02)
- **D-03:** `enforceTypeConstraints` 返回值从裸 `val` 改为 `{ value: any, truncated?: { originalLength: number, maxLength: number } }`
- **D-04:** 截断警告 UI 使用内联提示：在编辑的单元格旁显示短暂 tooltip/inline warning，告知用户原始长度和截断后长度
- **D-05:** 调用方（`useInlineEdit.handleBlur`）检测 `truncated` 字段，通过返回值和/或新回调向 `TableSection` 传递截断信息，由 `TableSection` 渲染内联警告

### 幽灵行状态保持 (FRONT-03)
- **D-06:** `onGhostSubmit` 不再立即清除 `ghostRow`，仅在插入成功确认后清除
- **D-07:** 插入成功检测方式：`TableSection` watch `db.tables` 中对应表的 `rows.length` 变化——行数增加判定为 INSERT 成功
- **D-08:** 执行失败（`executionError` 非 null 时）`ghostRow` 保持不动，用户可修正后重试

### ER 图节点坐标持久 (FRONT-04)
- **D-09:** `DataVisualizer.vue` 中 ER 图 tab 从 `v-else-if="activeTab === 'er'"` 改为 `v-show="activeTab === 'er'"`
- **D-10:** 组件常驻不销毁，vue-flow 内部节点坐标自然保留。其他 tab 切换逻辑不受影响（v-show 脱离 v-if 链后 v-else-if 链继续正常工作）

### Claude's Discretion

- `EmitFn` 泛型的具体约束写法（使用 `extends` 还是直接泛型参数）
- 内联截断警告的具体 UI 实现（CSS tooltip vs 简短文本提示 vs hover-card，几种方案均可）
- 截断信息从 `useInlineEdit` 到 `TableSection` 的传递方式（composable 返回新 ref 或回调参数，实现细节由开发决定）
- 幽灵行清除的 watch 具体写法（deep watch `db.tables` vs 显式 watch 目标表行数）
- v-show 改动后是否需要移除 `onPaneReady` 中的初始布局逻辑（首次渲染仍需要，保留）
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning artifacts
- `.planning/ROADMAP.md` — Phase 3 需求映射与成功标准
- `.planning/REQUIREMENTS.md` — 需求追溯（FRONT-01, FRONT-02, FRONT-03, FRONT-04）
- `.planning/PROJECT.md` — 项目约束（不引入新依赖、最小变更原则、技术栈锁定）
- `.planning/phases/02-parser-unification-data-layer/02-CONTEXT.md` — Phase 2 上下文（canonicalStatements 已交付，FRONT-02/FRONT-03 依赖此基础设施）

### Source files to modify
- `sqlive-frontend/src/composables/useInlineEdit.ts` — emit 泛型 + 截断检测（FRONT-01, FRONT-02）
- `sqlive-frontend/src/utils/sqlStatements.ts` — `enforceTypeConstraints` 返回值修改（FRONT-02）
- `sqlive-frontend/src/components/TableSection.vue` — 幽灵行不清除 + 内联截断警告显示（FRONT-02, FRONT-03）
- `sqlive-frontend/src/components/DataVisualizer.vue` — v-else-if → v-show（FRONT-04）
- `sqlive-frontend/src/components/er/ErDiagram.vue` — 只读参考（FRONT-04）

### Frontend types
- `sqlive-frontend/src/model/DatabaseTypes.ts` — Row 类型、TableSchema 类型定义

### Codebase maps
- `.planning/codebase/CONVENTIONS.md` — Vue 3 代码规范、emit 类型写法
- `.planning/codebase/STRUCTURE.md` — 组件和 composable 目录结构
- `.planning/codebase/STACK.md` — 技术栈（Vue 3.5, TypeScript strict, Biome）
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useInlineEdit` 已有 `autoResizeGhost` 和 `handleBlur` —— 截断检测在 `handleBlur` 中与 `enforceTypeConstraints` 调用点衔接
- `TableSection.vue` 已有 `ghostRow` reactive 对象和 `onGhostSubmit` / `updateGhostState` —— 幽灵行修复在此框架内最小改动
- `useErDiagram` 已有 `rebuild()` + `autoLayout()` + `filteredNodes` —— ER 图目前已在 `rebuild` 中正确构建，只需保持组件不销毁

### Established Patterns
- Vue 3 `<script setup>` + typed `defineEmits`
- Composables 返回 `{ refs, functions }` 对象
- `provide`/`inject` 通过 `injectionKeys.ts` 共享上下文
- `watch` 用于响应数据变化

### Integration Points
- `TableSection → emit('insert-row') → DataVisualizer → App.vue → engine.insertRowUI` —— 幽灵行插入事件链
- `TableSection → emit('update-cell') → DataVisualizer → App.vue → engine.updateRow` —— 单元格编辑事件链
- `enforceTypeConstraints` 在 `useBidirectionalSync.ts` 中被调用（通过 `sqlStatements` 导入）
- `DataVisualizer.vue` 模板中 v-if/v-else-if tab 切换链
</code_context>

<specifics>
## Specific Ideas

无特殊偏好——所有决策均通过讨论锁定，Claude's Discretion 范围内由开发者自行选择实现细节。
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.
</deferred>

---

*Phase: 3-Frontend Reliability*
*Context gathered: 2026-05-30*
