# SQLive — 全栈 SQL 交互式学习平台

在线 SQL 演练环境：左侧编写 SQL，右侧实时渲染表结构与数据。支持可视化编辑数据后反向同步至 SQL 源码，集成多 AI 提供商智能辅助。


## 功能特性

### 核心体验

- **代码编辑**：Monaco Editor 提供语法高亮、自动补全、代码格式化
- **实时执行**：SQL 脚本编写后 1 秒防抖自动执行，表结构与数据即时渲染
- **多 Tab 管理**：独立标签页编辑不同 SQL 脚本，每个 Tab 拥有独立的 SQLite 内存数据库
- **文件导入导出**：支持 `.sql` 文件导入及单/多 Tab 导出

### 数据双向同步

- **可视化编辑**：在数据表格中直接编辑单元格、新增/删除行
- **反向工程**：编辑后自动定位并替换 SQL 编辑器中对应的代码
- **错误回滚**：SQL 执行失败时自动恢复至上一个合法代码状态

### AI 智能辅助

- **多提供商支持**：兼容 OpenAI、DeepSeek、Ollama、LM Studio 等多种 AI 后端
- **多模式交互**：聊天问答 / 错误分析 / 代码修复 / SQL 解释 / 性能优化
- **流式响应**：SSE 流式传输，实时显示 AI 回复与推理过程
- **学习建议**：基于知识图谱的 SQL 主题分类与学习路径推荐

### 数据可视化

- **数据表格**：排序、过滤、分页，列类型约束标注
- **ER 图**：自动生成实体关系图，外键基数检测（1:1 / 1:N），dagre 自动布局
- **图表视图**：查询结果支持柱状图、折线图、饼图等 Chart.js 可视化
- **元数据浏览**：索引、视图、触发器、外键关系一览

## 技术栈

| 层 | 技术 | 版本 |
|---|------|------|
| 前端框架 | Vue 3 (Composition API) | 3.5 |
| 构建工具 | Vite | 8.x |
| 样式 | Tailwind CSS | 4.x |
| 代码编辑器 | Monaco Editor | 0.55 |
| UI 组件 | Reka-ui (Radix Vue) | 2.x |
| ER 图 | Vue Flow + dagre | 1.48 / 0.8 |
| 图表 | Chart.js | 4.5 |
| AI 流式 | Vercel AI SDK | 6.x |
| 后端框架 | Spring Boot | 4.0.6 |
| JDK | Java 21 (Zulu) | 21 |
| 数据库 | SQLite (内存模式) | 3.51 |
| 连接池 | HikariCP | — |
| 响应式 | Spring WebFlux (Project Reactor) | — |
| 测试 | Vitest + Playwright / JUnit 5 | — |

## 快速开始

### 环境要求

- **JDK 21**（推荐 Zulu JDK 21）
- **Node.js** 18+
- **npm** 9+

### 1. 启动后端

```bash
cd sqlive-backend

# Windows（指定 JDK 路径）
set JAVA_HOME=C:\Program Files\Zulu\zulu-21
gradlew.bat bootRun

# Linux / macOS
./gradlew bootRun
```

后端运行在 `http://localhost:8080`。

### 2. 启动前端

```bash
cd sqlive-frontend

# 安装依赖（首次运行）
npm install

# 启动开发服务器
npm run dev
```

前端运行在 `http://localhost:5173`，API 请求自动代理至后端 8080 端口。

### 3. 配置 AI（可选）

编辑 `sqlive-backend/src/main/resources/application.yml` 中 `ai.provider` 字段切换 AI 提供商：

```yaml
ai:
  provider: deepseek        # 可选: deepseek | openai-compatible | ollama | lmstudio
  providers:
    deepseek:
      api-key: ${DEEPSEEK_API_KEY:}
      model: deepseek-v4-flash
```

默认使用 DeepSeek，需设置环境变量 `DEEPSEEK_API_KEY`。仅使用 SQL 执行功能则可跳过此步骤。

## 项目结构

```
sqlive/
├── sqlive-frontend/            # Vue 3 + TypeScript 前端
│   ├── src/
│   │   ├── App.vue             # 顶层布局（代码编辑器 | 数据可视化 | AI 聊天）
│   │   ├── components/
│   │   │   ├── CodeEditor.vue          # Monaco SQL 编辑器 + 多 Tab 工具栏
│   │   │   ├── DataVisualizer.vue      # 数据表格 / ER 图 / 元数据页签
│   │   │   ├── TableSection.vue        # 单表视图（排序/过滤/分页）
│   │   │   ├── ResultTable.vue         # 查询结果表 + 图表切换
│   │   │   ├── ChartView.vue           # Chart.js 可视化
│   │   │   ├── AiChatPanel.vue         # AI 对话面板
│   │   │   ├── AiInlineResult.vue      # AI 内联结果展示
│   │   │   ├── AiMessageFooter.vue     # AI 消息底部操作栏
│   │   │   ├── CreateTableModal.vue    # 可视化建表
│   │   │   ├── SortFilterToolbar.vue   # 排序/过滤工具栏
│   │   │   ├── HoverPreview.vue        # 悬停预览弹窗（索引/触发器详情）
│   │   │   ├── EmptyState.vue          # 空状态引导
│   │   │   ├── er/                     # ER 图子组件
│   │   │   │   ├── ErDiagram.vue       # VueFlow 容器
│   │   │   │   ├── ErTableNode.vue     # 自定义表节点
│   │   │   │   ├── ErToolbar.vue       # 布局/缩放工具栏
│   │   │   │   └── ErSearchBar.vue     # 搜索过滤
│   │   │   └── ui/                     # Reka-ui 组件封装（30+ 组件）
│   │   ├── viewmodel/
│   │   │   ├── useSqlEngine.ts         # 核心状态机（SQL 执行 / 双向同步）
│   │   │   ├── useAiChat.ts            # AI 聊天状态管理
│   │   │   ├── useErDiagram.ts         # ER 图数据转换 + dagre 布局
│   │   │   ├── useInlineActions.ts     # 内联 AI 操作处理
│   │   │   └── injectionKeys.ts        # provide/inject 依赖注入键
│   │   ├── composables/
│   │   │   ├── useMultiTabs.ts         # 多 Tab 状态管理
│   │   │   ├── useBidirectionalSync.ts # 双向同步引擎
│   │   │   ├── useDatabaseLifecycle.ts # 数据库生命周期
│   │   │   ├── useHighlight.ts         # 代码高亮与动画
│   │   │   ├── useSortFilter.ts        # 列级排序/过滤状态
│   │   │   ├── useTablePipeline.ts     # 表格数据管道
│   │   │   └── useAiStreaming.ts       # AI 流式传输封装
│   │   ├── model/
│   │   │   └── DatabaseTypes.ts        # TypeScript 类型定义
│   │   └── utils/
│   │       ├── sse.ts                  # SSE 流解析器
│   │       ├── sqlStatements.ts        # SQL 语句解析工具
│   │       ├── tupleParser.ts          # VALUES 元组提取器
│   │       ├── aiQuickFix.ts           # AI 快速修复工具
│   │       ├── aiFormatter.ts          # AI 响应格式化
│   │       ├── sql.ts                  # SQL 字面量生成
│   │       ├── sqlTopics.ts            # SQL 主题常量
│   │       ├── file.ts                 # 文件下载工具
│   │       └── html.ts                 # HTML 处理工具
│   ├── tests/e2e/                      # Playwright E2E 测试（8 个 spec）
│   └── src/__tests__/                  # Vitest 单元测试（27 个文件，476 用例）
│
└── sqlive-backend/             # Spring Boot 4 后端
    └── src/main/java/com/douzi/sqlive/
        ├── SqliveApplication.java      # 启动入口
        ├── controller/
        │   ├── SqlController.java      # POST /api/execute
        │   └── ai/AiController.java    # POST /api/ai/chat, /api/ai/suggest
        ├── service/
        │   ├── SqlExecutionService.java     # SQL 执行核心逻辑
        │   ├── database/DatabasePoolManager.java  # 多数据库隔离管理
        │   ├── sql/SqlParser.java            # 手写 SQL 词法解析器
        │   ├── metadata/MetadataExtractor.java    # 7 类元数据提取
        │   ├── ai/
        │   │   ├── AiService.java            # AI 编排服务
        │   │   ├── AiProvider.java           # Provider 接口
        │   │   ├── Protocol.java             # 协议抽象
        │   │   ├── OpenAiProtocol.java       # OpenAI 兼容协议
        │   │   ├── DeepSeekProtocol.java     # DeepSeek 协议
        │   │   ├── OllamaProtocol.java       # Ollama 协议
        │   │   ├── LmStudioProtocol.java     # LM Studio 协议
        │   │   ├── OpenAiCompatibleProvider.java  # Provider 工厂
        │   │   ├── PromptBuilder.java        # Prompt 模板引擎
        │   │   └── RequestContext.java       # 请求上下文封装
        │   └── knowledge/
        │       ├── KnowledgeGraphService.java # 知识图谱服务
        │       └── SqlTopicClassifier.java   # SQL 主题分类器
        ├── dto/
        │   ├── SqlRequest.java          # SQL 执行请求
        │   ├── SqlResponse.java         # SQL 执行响应
        │   ├── TableSchema.java         # 表结构 DTO
        │   └── ai/                      # AI 相关 DTO
        ├── exception/
        │   ├── GlobalExceptionHandler.java   # 全局异常处理
        │   └── SqlExecutionException.java    # SQL 执行异常
        └── config/
            └── RateLimitFilter.java     # 滑动窗口限流

## 测试

```bash
# 前端单元测试
cd sqlive-frontend
npm test                 # 运行全部 476 个 Vitest 用例
npm run test:e2e         # Playwright E2E 测试

# 后端测试
cd sqlive-backend
./gradlew test            # 运行全部 JUnit 5 用例
```

## 许可证

Copyright (c) 2026 douzi. All Rights Reserved.
