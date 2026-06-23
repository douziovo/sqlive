# SQLive — 全栈 SQL 交互式学习平台

左侧 Monaco 编辑器编写 SQL → 右侧表格即时展示结果。在表格中编辑数据，自动反向修改 SQL 源码，两侧始终保持一致。支持 AI 辅助编写、多 Tab 隔离运行、ER 图与知识图谱导航。专为 SQL 教学场景研发。学生开浏览器即用，无需搭建本地环境；AI 对话解释 SQL 语义，充当即时辅导；知识图谱引导学习路径，避免盲目刷题。

![主界面](docs/screenshots/01-editor-tables.png)

## 功能特性

### 编辑器 ↔ 视图双向同步

- 在右侧表格中编辑任意单元格，系统自动定位并修改左侧 SQL 对应位置，始终保持两端一致。
- 修改出错时自动回滚到上一条正确 SQL，不影响当前工作。

### AI 即时辅导

- 切换 AI 后端（DeepSeek、OpenAI 兼容、Ollama、LM Studio），对话解释 SQL 语义、分析错误原因，充当即时辅导，流式输出逐字显示。
- 新增提供商只需实现一个接口，不影响已有代码。

![AI 对话](docs/screenshots/07-ai-chat.png)

### 多 Tab 隔离 + ER 图导航

- 每个浏览器 Tab 拥有独立的 SQLite 内存数据库，空闲自动回收。
- 根据建表语句自动生成 ER 图，展示表间外键关系，点击节点即可跳转浏览对应表数据。

![ER 图](docs/screenshots/02-er-diagram.png)

### 数据可视化

- 表格支持排序、过滤、分页，查询结果可用柱状图、折线图、饼图展示。
- 浏览索引、视图、触发器、外键关系等数据库元数据。

![图表视图](docs/screenshots/03-chart-view.png)
![索引](docs/screenshots/04-indexes.png)
![视图](docs/screenshots/05-views.png)
![触发器](docs/screenshots/06-triggers.png)

### 结构化学习路径

- 24 个 SQL 知识点按前置关系排列，学生知道从哪开始、下一步学什么，追踪每个知识点的学习进度。

![知识图谱细节](docs/screenshots/08-knowledge-graph.png)
![知识图谱](docs/screenshots/09-knowledge-graph-detail.png)

## 技术栈

| 层 | 技术 | 版本 |
|---|------|------|
| 前端框架 | Vue 3 (Composition API) | 3.5 |
| 构建工具 | Vite | 8.x |
| 样式 | Tailwind CSS | 4.x |
| 代码编辑器 | Monaco Editor | 0.55 |
| UI 组件 | Reka-ui (Radix Vue) | 2.x |
| ER 图 | Vue Flow + dagre | 1.48 / 0.8 |
| 图表 | ECharts | 5.x |
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

前端运行在 `http://localhost:5173`，API 请求通过 `VITE_API_URL` 环境变量直接连接后端 8080 端口。

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


## 测试

```bash
# 前端单元测试
cd sqlive-frontend
npm test                 # 运行全部 476 个 Vitest 用例
npm run test:e2e         # Playwright E2E 测试

# 后端测试
cd sqlive-backend
./gradlew test         # 运行全部 JUnit 5 用例
```

## 安装步骤

```bash
# 前端依赖
cd sqlive-frontend && npm install

# 后端依赖（首次运行或构建 jar）
cd ../sqlive-backend
./gradlew build      # Linux / macOS
gradlew.bat build    # Windows
```

## 使用示例

### 示例 1：通过 API 执行 SQL

后端运行后，可直接通过 HTTP API 执行任意 SQL 脚本：

```bash
curl -X POST http://localhost:8080/api/execute \
  -H "Content-Type: application/json" \
  -d '{
    "sql": "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);\nINSERT INTO users VALUES (1, '\''Alice'\'');\nSELECT * FROM users;",
    "dbName": "demo",
    "reset": true
  }'
```

成功时返回表结构、列类型和数据行：

```json
{
  "success": true,
  "data": {
    "tables": [
      {
        "name": "users",
        "columns": ["id", "name"],
        "columnTypes": { "id": "INTEGER", "name": "TEXT" },
        "data": [{ "id": 1, "name": "Alice" }]
      }
    ]
  }
}
```

### 示例 2：多表 JOIN 查询（Web 界面）

在 Web 编辑器中编写以下 SQL，左侧输入、右侧实时渲染：

```sql
CREATE TABLE departments (id INTEGER PRIMARY KEY, name TEXT);
CREATE TABLE employees (id INTEGER PRIMARY KEY, name TEXT, dept_id INTEGER, salary REAL);

INSERT INTO departments VALUES (1, '技术部'), (2, '市场部');
INSERT INTO employees VALUES (1, '张三', 1, 15000), (2, '李四', 2, 12000), (3, '王五', 1, 18000);

-- 联合查询：员工姓名 + 部门名称
SELECT e.name AS 员工, d.name AS 部门, e.salary AS 薪资
FROM employees e
JOIN departments d ON e.dept_id = d.id
ORDER BY e.salary DESC;
```

执行后在右侧"表格"标签页看到查询结果，在"ER 图"标签页看到自动生成的实体关系图（employees -- departments，1:N 关系）。

### 示例 3：批量导入 SQL 文件

项目根目录提供了 `test-multi-table.sql` 示例文件，包含 14 张表、10 个索引、4 个视图、7 个触发器、8 条 INSERT 数据以及 20+ 种查询类型（窗口函数、递归 CTE、子查询、UNION 等）。可通过 Web 界面的"导入"按钮加载，一键体验全部功能。

## 许可证

[Apache 2.0](LICENSE)
