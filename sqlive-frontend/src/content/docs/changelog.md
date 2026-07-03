# 变更日志

## v0.14 — 文档站（2026-07-01）

- 新增文档站页面（/docs/* 路由子树），含项目介绍 / 使用手册 / API 文档 / 变更日志
- 顶部 AppHeader 导航栏：Docs 入口按钮 + GitHub 链接（从 CodeEditor 迁出）
- Markdown 文档渲染（marked + DOMPurify 共享 sanitize 配置）
- API 文档：后端 springdoc 3.x 自动生成 OpenAPI JSON，前端 @scalar/api-reference 渲染
- 文档搜索：MiniSearch 懒建索引，Ctrl+K 全局快捷键、/ docs 页面快捷键
- 桌面端固定侧边栏 240px，移动端 drawer（Reka-ui Dialog）+ 自动关闭导航
- document.title 随路由切换自动更新
- SPA fallback：后端 NoResourceFoundException handler forward /index.html
- AiChatPanel 内联 DOMPurify 配置迁移到共享 sanitize.ts

## v0.13 — 维护者审查修复（2026-06-30）

- CR-01：OpenAiCompatibleProvider.complete catch 块空指针保护
- CR-02：前端 AI composable 从 env/localStorage 读取 X-API-Key
- WR-01：DatabasePoolManager.createNewPool 修复 refCount 递增与 pools.put 的竞态窗口
- WR-02：ApiKeyFilter 路径匹配模式对齐 Spring Security /api/ai/**
- WR-03：SecurityConfig 集成 http.cors() + OPTIONS permitAll
- WR-04：非 dev 环境缺少 AI_API_KEY 时启动打印警告
- WR-05：WebConfig CORS allowedHeaders 添加 X-API-Key
- WR-06：RUNBOOK / CLAUDE.md 中 SQLite URL 文档对齐实际代码
- WR-07：重写 TOCTOU 并发测试为 acquire-release 循环 + evict

## v0.12 — Token 管理 + 构建优化（2026-06-25）

- 新增 AI token 用量追踪和上下文窗口管理
- Token 计数与多轮对话上下文裁剪
- 构建工具升级：Vite 8 + rolldown 适配

## v0.11 — 代码审查修复（2026-06-24）

- 批量修复 Phase 10 知识图谱重构引入的代码质量问题
- 前端目录结构规范化

## v0.10 — 知识图谱重构（2026-06-24）

- useErDiagram 解耦为纯数据转换函数 + 布局分离
- 边类型统一为 vue-flow built-in smoothstep，移除自定义边组件
- onPaneReady 布局触发机制

## v0.9 — 知识图谱任务追踪（2026-06-23）

- 知识图谱面板增加节点搜索和过滤
- 表间关系可视化增强

## v0.8 — 覆盖率提升（2026-06-22）

- 前端测试从 180 提升到 264 个测试文件
- 后端测试从 12 提升到 19 个测试文件
- DatabasePoolManager TOCTOU 并发测试

## v0.7 — 用户流测试（2026-06-22）

- Playwright E2E 测试覆盖主用户流程
- 测试配置优化：仅 chrome 项目、webServer 自动启停

## v0.6 — 测试债务修复（2026-06-22）

- 修复 useSqlEngine flaky 测试：异步竞态条件
- 补齐边界用例：空表、截断、列类型推导

## v0.5 — 知识图谱 UX（2026-06-10）

- 知识图谱面板初版
- ER 图节点/边可视化

## v0.4 — 安全加固（2026-06-05）

- SecurityConfig Spring Security 集成
- ApiKeyFilter AI API 端点保护
- CORS 配置
- XSS 防护：DOMPurify 集成到 AI 渲染

## v0.3 — 前端可靠性（2026-06-01）

- Monaco Editor 集成
- 编辑器-数据表格双向同步引擎
- 防抖执行 + 错误回滚

## v0.2 — 解析器统一 + 数据层（2026-05-28）

- 前后端统一语句边界：后端 SqlParser 输出偏移，前端 CanonicalStatement 消费
- 内联编辑：useBidirectionalSync 元组替换
- DatabasePoolManager LRU 池管理

## v0.1 — 后端基础设施（2026-05-20）

- Spring Boot 4 + Gradle 项目搭建
- SQLite JDBC + HikariCP 连接池
- SqlController + SqlExecutionService REST API
- GlobalExceptionHandler
- @Valid request validation
- ResultSetExtractor 多表结果收集
