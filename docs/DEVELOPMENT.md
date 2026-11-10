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

- 前端：`pnpm run build` 先检查类型再生成 `dist/`；`pnpm run typecheck` 单独检查类型；`pnpm run preview` 预览构建。
- 后端：`./gradlew build` 编译、测试并打包。
- 测试命令、CI 范围和覆盖率见 [TESTING.md](TESTING.md)。
- 部署与排错见 [RUNBOOK.md](RUNBOOK.md)。

前端类型检查统一使用 TypeScript 7.0.2 的 Go 引擎：`@typescript/native` 是官方 `typescript@7.0.2` 的 npm 别名，直接检查 Vite 配置和 E2E 测试；`typescript` 是 [`typescript-native-bridge`](https://github.com/johnsoncodehk/typescript-native-bridge) 的别名，固定版本 `6.0.3-bridge.19.tsgo.7.0.2`。桥接包保留 `vue-tsc` 3.3.14 所需的 JavaScript 编译器 API，将应用代码和 Vue 模板的类型检查交给进程内 Go 引擎，不再安装 `@typescript/typescript6` 或 `@typescript/old`。Vue Language Tools 本身已[采用同一方案构建和测试](https://github.com/vuejs/language-tools/pull/6129)。

`pnpm-workspace.yaml` 的 override 使传递依赖也使用桥接包；`peerDependencyRules.allowedVersions` 仅放行固定的桥接预发布版本，避免版本号导致的 peer 误报。`pnpm run typecheck`、生产构建和 CI 使用同一检查链。强制完整复查时运行 `pnpm exec vue-tsc -b tsconfig.app.json --force`，应看到 `TNB ACTIVE`；工具配置可用 `node node_modules/@typescript/native/bin/tsc --version` 核对版本。Vite 8 的 Oxc/Rolldown 转换打包、Vitest 和浏览器运行方式保持各工具的原生实现；Go 引擎负责类型检查。

编辑器需选择工作区的 `sqlive-frontend/node_modules/typescript`，才能让语言服务使用 Go 桥接引擎。在仓库根目录打开 VS Code/Cursor 时，本机设置 `js/ts.tsdk.path` 为 `sqlive-frontend/node_modules/typescript/lib` 并选择 **Use Workspace Version**；在前端目录打开时路径为 `node_modules/typescript/lib`。JetBrains 的 TypeScript package 指向同一包。IDE 设置目录按仓库规则忽略，不随代码提交。

桥接包带 Windows/macOS/Linux 的预编译二进制，本地无需安装 Go。Linux 需要 glibc >= 2.35，Alpine/musl 不支持；CI 使用 Ubuntu，若增加容器内前端检查，应选择 glibc 基础镜像（如 `node:24-bookworm-slim`）。平台二进制缺失会直接报错，不会回退到旧 JavaScript 类型检查器。

## 修改约定

前端在 `sqlive-frontend` 执行 `pnpm run lint`（Oxlint + Stylelint）和 `pnpm run format:check`（Oxfmt）；两项检查均在 CI 阻断失败。运行 `pnpm run lint:fix` 修复可自动处理的问题，`pnpm run format` 写入格式；修复后仍须检查 diff 和运行相关测试。

Oxfmt 没有名为 strict 的开关。项目通过统一配置、全量规范化和 CI 格式检查落实严格要求：4 空格、单引号、无分号、LF、自动排序导入与 package.json，副作用导入保持原顺序。前端目录中的 TS/JS、Vue/HTML、CSS/SCSS/Less、JSON/JSONC/JSON5、YAML、Markdown/MDX、TOML 和 GraphQL 使用同一入口；支持的嵌入代码自动格式化，生成目录排除。

Tailwind CSS v4 的类名排序读取 `src/input.css` 的主题，覆盖静态 `class`、Vue `:class`/`v-bind:class` 与 `cn`、`clsx`、`cva`、`twMerge`，去除重复类和多余空白。CSS import 使用字符串形式，确保 Tailwind 及排序器正确读取依赖。Stylelint 检查独立 CSS 和 Vue `<style>`，接受 v4 的 `@theme`、`@utility`、`@apply` 等指令以及 Vue `:deep()`/`v-bind()`，其余未知属性、指令和函数仍报错。

Oxlint 开启 correctness、suspicious、pedantic、perf 错误级别与 `oxlint-tsgolint` 原生 Go 类型分析，禁止浮动 Promise、错误 await 和未使用的禁用注释，warning 也阻断。为 Vue 可变引用、SQL 数字解析和空字符串回退保留有意例外；测试允许动态 mock 和夹具分支，但要求实际断言。局部禁用须附理由。Oxlint 的 Vue 支持限于脚本，模板类型仍由 `vue-tsc` 的 Go 桥接链检查。测试命令和覆盖范围见 [TESTING.md](TESTING.md)。

提交前核对 diff，按变更运行相关检查并说明既有失败和未验证范围。CI 的分支触发条件以 workflow 为准，不从部署分支推断 PR 目标。
