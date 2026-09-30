# AI 助手

## 功能

编辑器右侧面板提供 AI 对话功能，可对当前 SQL 代码进行分析、优化、解释和错误排查。支持流式输出 reasoning 和最终回答。

## 多提供商架构

AI 后端基于策略模式设计，核心抽象两层：

- AiProvider 接口：定义了 complete（非流式）和 completeStream（SSE 流式）两个方法
- Protocol 接口：定义了 buildRequest（构造请求体）、extractContent（提取响应文本）、processStream（处理 SSE 流）三个方法

4 种 AI 提供商各有一个 Protocol 实现，处理各自协议格式差异：

| 提供商      | 协议类           | 格式差异                         |
| ----------- | ---------------- | -------------------------------- |
| DeepSeek    | DeepSeekProtocol | 自有 chat API 格式               |
| Ollama      | OllamaProtocol   | 无 data: 前缀、JSON 流式响应     |
| LMStudio    | LmStudioProtocol | 兼容 OpenAI 格式但端口和路径不同 |
| OpenAI 兼容 | OpenAiProtocol   | 标准 openai chat completions API |

新增提供商只需实现 Protocol 接口，AiService 和 OpenAiCompatibleProvider 零修改。

## SSE 流式传输

AI 回答通过 SSE（Server-Sent Events）流式传输到前端：

- 后端使用 Spring WebFlux Flux<StreamChunk> 返回流
- 不同协议的 SSE 格式差异在 Protocol.processStream 中归一化
- 前端使用 Vercel AI SDK + 手写 ReadableStream 解析器处理多字节字符跨 chunk 边界的问题
- 响应中嵌入 reasoning（推理过程）和 content（最终回答），前端分开展示

## 预设动作

编辑器底部工具栏和 AI 面板提供 6 种预设操作：

- **分析错误**：将编辑器当前错误信息和 SQL 发送给 AI，请求定位问题
- **修复代码**：AI 返回修正后的 SQL，可一键替换编辑器内容
- **解释 SQL**：AI 逐条解释当前脚本中各语句的作用
- **优化 SQL**：AI 返回优化版本，可一键替换
- **生成 SQL**：输入自然语言描述，AI 生成对应的 SQL 语句
- **自由对话**：在面板中自由提问

前 5 种操作会注入当前编辑器的代码上下文和 schema 信息，AI 可以基于实际表结构给出精确回答。

## API 密钥配置

AI 功能需要配置 API 密钥。优先级：环境变量 AI_API_KEY > 浏览器 localStorage。首次使用时可在 AI 面板中弹出配置对话框。密钥通过 X-API-Key 请求头发送到后端，后端在 OpenAiCompatibleProvider 中读取。
