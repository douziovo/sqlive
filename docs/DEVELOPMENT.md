# 本地开发

环境：Node.js LTS（>= 22）、pnpm 12.6.0、JDK 21。版本细节以各模块 manifest 为准。

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

Windows 使用 `pwsh` 和 `.\gradlew.bat bootRun`，`JAVA_HOME` 指向 JDK。前端默认 5173，后端 8080；Vite 代理配置见 `sqlive-frontend/vite.config.ts`。

## 构建与检查

- 前端：`pnpm run build` 生成 `dist/`；`pnpm run typecheck` 单独检查类型；`pnpm run preview` 预览构建。
- 后端：`./gradlew build` 编译、测试并打包。
- 测试命令、CI 范围和覆盖率见 [TESTING.md](TESTING.md)。
- 部署与排错见 [RUNBOOK.md](RUNBOOK.md)。

## 修改约定

共享项目规则见 [agents/README.md](agents/README.md)。保持相邻代码风格；`biome.json` 只是现存配置，项目未安装 Biome，也未接入 lint 命令，不宣称自动执行格式检查。

提交前核对 diff，按变更运行相关检查并说明既有失败和未验证范围。CI 的分支触发条件以 workflow 为准，不从部署分支推断 PR 目标。
