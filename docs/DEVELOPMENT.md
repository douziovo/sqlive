# 本地开发

环境：Node.js LTS（>= 22）、pnpm 12.6.0、JDK 25。版本细节以各模块 manifest 为准。

## 当前焦点

当前阶段、计划和阻塞项以本机 `.planning/STATE.md` 为准；阶段拆分见 `.planning/ROADMAP.md`，实施细节与完成记录见 `.planning/phases/` 下对应的 PLAN 和 SUMMARY。

已有本机规划时，在仓库根目录的 pwsh 中查看：

```pwsh
Get-Content -LiteralPath '.planning/STATE.md'
Get-Content -LiteralPath '.planning/ROADMAP.md'
```

先读 STATE 的 Current Position、Blockers/Concerns 和 Session Continuity，再查看对应阶段。完成摘要记录交付历史，当前验收状态以阶段 VERIFICATION 和后续检查结果为准。

`.planning/` 被 `.gitignore` 排除；新克隆通常没有这些本机文件。使用 GSD 的 `gsd-onboard` 技能接入项目，再通过 `gsd-manager` 选择后续工作。此入口随本机状态变化，无需在开发文档中维护固定阶段编号。

## 安装与启动

在 `sqlive-frontend` 执行：

```sh
pnpm install --frozen-lockfile
pnpm run dev
```

另一个终端在 `sqlive-backend` 执行：

```sh
./gradlew bootRun
```

Windows 使用 `pwsh` 和 `.\gradlew.bat bootRun`，`JAVA_HOME` 指向 JDK 25（例如 `$env:JAVA_HOME = 'C:\Program Files\Zulu\zulu-25'`）。通过 `java -version` 和 `.\gradlew.bat --version` 核对命令行和 Gradle 使用的 JVM。项目使用 Gradle wrapper 9.2.1；本地、CI 和 Docker 均通过 wrapper 构建。前端默认 5173，后端 8080；Vite 代理配置见 `sqlive-frontend/vite.config.ts`。

## 构建与检查

SQLite JDBC 需要加载本地库。`bootRun`、测试任务和 Docker 启动命令已配置 `--enable-native-access=ALL-UNNAMED`；直接运行 JAR 时也需传入此 JVM 参数。

- 前端：`pnpm run build` 生成 `dist/`；`pnpm run typecheck` 单独检查类型；`pnpm run preview` 预览构建。
- 后端：`./gradlew build` 编译、测试并打包。
- 测试命令、CI 范围和覆盖率见 [TESTING.md](TESTING.md)。
- 部署与排错见 [RUNBOOK.md](RUNBOOK.md)。

前端采用 [TypeScript 官方的 6/7 并行配置](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6-0)：`@typescript/native` 是 TypeScript 7.0.2 的 npm 别名，提供原生 `tsc`；`typescript` 是 `@typescript/typescript6` 6.0.2 的别名，为 `vue-tsc` 3.3.14 提供 Vue 单文件组件所需的编译器 API。`pnpm run typecheck` 先检查应用代码和 Vue 模板，再使用 TS7 检查 Vite 配置与 E2E 测试。CI 运行同一命令。

## 修改约定

保持相邻代码风格。前端在 `sqlive-frontend` 执行 `pnpm run lint`（oxlint）和 `pnpm run format:check`（oxfmt）；需要格式化时运行 `pnpm run format`。测试命令和覆盖范围见 [TESTING.md](TESTING.md)。

提交前核对 diff，按变更运行相关检查并说明既有失败和未验证范围。CI 的分支触发条件以 workflow 为准，不从部署分支推断 PR 目标。
