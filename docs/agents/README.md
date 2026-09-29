# 项目工作约定

所有 coding agent 共用本文件；经验见 [MEMORY.md](MEMORY.md)。根目录入口只引用共享上下文，不复制正文。

## 开始任务

- 核对目录、分支、HEAD 和 `git status --short`，保留用户已有改动。
- 用户当前要求优先；工程事实以源码和配置为准，历史总结不能证明当前状态。
- 先读实际调用链，修 bug 前查调用方，优先复用已有实现并在共同入口修复。
- 最小改动，不为未来需求添加依赖或抽象；规格明确后再计划和实现，计划中的路径、类型和调用须有代码依据。
- Windows 使用 `pwsh`。修改 `sqlive-backend/src/main/resources/application.yml` 前征求用户同意。

## 项目边界

SQL playground：Vue 前端编辑 SQL，Spring Boot 后端执行 SQLite 内存库，表格编辑反向修改 SQL 后重新执行。前端入口是 `useSqlEngine`、`useAiChat`、`useErDiagram`；后端主链路是 `SqlController` → `SqlExecutionService` → 数据库池。

- 内容问题查 prompt，传输问题查 SSE/JSON，展示问题查 renderer。
- 错误不能伪装成成功；凭据不得写入源码、日志或交接文档。
- 架构按需读 [ARCHITECTURE.md](../ARCHITECTURE.md)，部署与故障排查读 [RUNBOOK.md](../RUNBOOK.md)。版本和配置直接读 manifest，不在规则中维护副本。

## 执行与验证

命令与验证范围统一见 [TESTING.md](../TESTING.md)，环境安装见 [DEVELOPMENT.md](../DEVELOPMENT.md)。

- 按变更运行相关检查；UI 事件、布局时序和跨模块行为需要真实浏览器证据，单测通过不能替代。
- 区分本次引入的失败、既有失败、未执行和待人工验证；只报告实际执行结果。
- 不把脚本注释中的 hook 当作已启用自动化；公共检查以 [.github/workflows/ci.yml](../../.github/workflows/ci.yml) 为准。
- 提交前检查 diff；推送、发布、部署和对外消息按用户授权范围执行。

## 记忆与交接

- 跨任务经验写 MEMORY，注明来源和重新核对条件；不保存版本号、测试数量或当前阶段。
- 需要交接时写 `.planning/handoffs/<task>.md`：目标、时间、分支/HEAD、授权范围、已有改动、已完成、验证结果、剩余工作。该目录不入 git，跨机器须显式传递。
- 接手先核对现场，交接中的建议不等于授权；没有交接文件时不从历史阶段名猜任务。
- GSD 可用于已有任务流程，运行项目和检查不依赖它。长期规则不被生成的阶段进度覆盖。
