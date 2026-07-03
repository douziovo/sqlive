# 项目介绍

## 定位

在线 SQL 游乐场——打开浏览器就能写 SQL，每个标签页一个独立的内存数据库实例，多 Tab 互不干扰。核心使用场景：SQL 教学、面试准备、本地数据实验。

## 数据流程

编辑器输入 SQL → 100ms 防抖 → POST /api/execute → 后端清空内存库、按语句边界拆分、逐条执行 → 返回 db.tables（表结构 + 行数据）和 canonicalStatements（每条 SQL 的字符偏移） → 前端渲染数据表格和 ER 图。

执行出错时不覆盖上次成功状态，lastValidCode 保留有效代码，编辑器可一键回滚。

## 关键设计

| 特性 | 做法 |
|------|------|
| 数据库隔离 | 每个 HTTP 会话一个 SQLite 内存文件，HikariCP 单连接池管理 |
| SQL 解析 | 字符级扫描器（~280 行），零第三方解析库，追踪 BEGIN/END 和 CASE/END 深度来正确拆分语句 |
| 双向同步 | 表格内双击改值 → 定位对应 INSERT 的 VALUES 元组 → 替换 → 重执行 |
| AI 集成 | 策略模式 + Protocol 抽象层，同一接口对接 4 种 AI 协议差异 |
| 测试策略 | 不 mock 数据库，真实 SQLite 内存实例执行完整 SQL |

## 技术栈

- 前端：Vue 3、TypeScript、Monaco Editor、Tailwind CSS 4、vue-flow、ECharts
- 后端：Spring Boot 4.0.6、JdbcTemplate、SQLite JDBC、HikariCP
- AI：Vercel AI SDK、SSE 流式传输
- 构建：Vite 8、Gradle
