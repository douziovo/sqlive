# 测试与验证

运行环境：Node.js LTS、pnpm 12.6.0、JDK 21。先在 `sqlive-frontend` 执行 `pnpm install --frozen-lockfile`。后端使用 Gradle wrapper；Windows 将 `./gradlew` 换为 `.\gradlew.bat`，确保 `JAVA_HOME` 指向 JDK。

## 入口

| 目录 | 命令 | 范围 |
| --- | --- | --- |
| `sqlive-frontend` | `pnpm test` | Vitest 单元/组件测试 |
| `sqlive-frontend` | `pnpm run typecheck` | 独立类型检查 |
| `sqlive-frontend` | `pnpm run build` | Vite 生产构建，不含类型检查 |
| `sqlive-frontend` | `pnpm run test:e2e` | 本机 Chrome + Edge E2E，自动启停前后端 |
| `sqlive-frontend` | `pnpm run test:e2e -- --grep '@smoke'` | SQL 执行、建表、多标签冒烟测试 |
| `sqlive-backend` | `./gradlew test` | JUnit 测试 |

本地使用已安装的 Chrome 和 Edge（`chrome` / `msedge` channel），无需下载 Playwright Chromium。`test:e2e:ui` 和冒烟命令也运行这两个浏览器；只跑一个时使用：

```sh
pnpm exec playwright test --config tests/e2e/playwright.config.ts --project=edge
```

CI 安装 Chromium 和 Edge，运行 `--project=chromium --project=edge`。浏览器 channel 说明见 [Playwright 文档](https://playwright.dev/docs/browsers#google-chrome--microsoft-edge)。

已有 Bash 环境可从根目录运行 `bash scripts/verify.sh`，顺序执行后端测试、前端测试、前端构建，失败即停止；`--smoke` 只跑冒烟测试。Windows 可直接用上表命令，无需为验证安装 Bash。

## 测试位置

- 前端：`sqlive-frontend/src/__tests__`；Vitest 配置在 `vite.config.ts`，初始化在 `src/__tests__/setup.ts`。
- E2E：`sqlive-frontend/tests/e2e/specs`；共享编辑器 fixture 在同级 `fixtures`。服务地址、启动和等待统一由 `playwright.config.ts` 管理，本地可复用已运行服务，CI 启动独立进程。
- 后端：`sqlive-backend/src/test/java`；JUnit 配置在 `build.gradle`。
- AI mock 测试验证交互和协议，不证明真实模型回答质量。

## CI 与覆盖率

[CI 配置](../.github/workflows/ci.yml) 在 push 到 `main`/`future`、PR 目标为 `main` 时运行前后端单测和 Chromium + Edge E2E。部署分支另见 `render.yaml`。

- CI 当前不执行前端构建、类型检查或覆盖率门禁；不能把单测通过称为这些检查通过。
- 前端覆盖率阈值在 `vite.config.ts`，默认 `pnpm test` 不启用 coverage。手动运行 `pnpm exec vitest run --coverage` 前需要匹配 Vitest 版本的 `@vitest/coverage-v8`，当前 manifest 未安装该包。
- 后端 `test` 在 `CI=true` 或 `-Djacoco=true` 时生成报告。要执行配置中的覆盖率门禁，运行 `./gradlew test jacocoTestCoverageVerification -Djacoco=true`；CI 的 `test` 不执行门禁。

验证记录只写实际命令、结果和未覆盖范围；UI 操作与布局时序按需做真实浏览器验证，不以 mock 单测替代。
