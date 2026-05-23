# SQLive UI 设计指南

自用参考——保持新代码视觉一致。

## 1. 色彩系统

### 语义色令牌（`:root`，`input.css`）

| Token | OKLCH 值 | Tailwind 类 | 语义 |
|-------|---------|-------------|------|
| `--background` | `oklch(1 0 0)` | `bg-background` | 页面/卡片白底 |
| `--foreground` | `oklch(0.145 0 0)` | `text-foreground` | 主文字色（近黑） |
| `--primary` | `oklch(0.488 0.243 264.376)` | `bg-primary` `text-primary` `border-primary` | 蓝色强调色 |
| `--primary-foreground` | `oklch(0.97 0.014 254.604)` | `text-primary-foreground` | 蓝色底上的文字（白） |
| `--secondary` | `oklch(0.967 0.001 286.375)` | `bg-secondary` | 次级背景 |
| `--secondary-foreground` | `oklch(0.205 0 0)` | `text-secondary-foreground` | 次级背景上的深色文字 |
| `--muted` | `oklch(0.967 0.001 286.375)` | `bg-muted` | 面板底色 |
| `--muted-foreground` | `oklch(0.556 0 0)` | `text-muted-foreground` | 次要/辅助文字色 |
| `--border` | `oklch(0.922 0 0)` | `border-border` | 默认边框色 |
| `--input` | `oklch(0.922 0 0)` | `border-input` | 输入框边框色 |
| `--ring` | `oklch(0.705 0.015 286.067)` | `ring-ring` | 聚焦环颜色 |
| `--destructive` | `oklch(0.577 0.245 27.325)` | `bg-destructive` `text-destructive` | 删除/危险操作红色 |

### 硬编码颜色 → 语义类速查

#### 灰色

| 不要 | 要 |
|------|-----|
| `text-gray-900` / `text-gray-600` | `text-foreground` / `text-muted-foreground` |
| `text-gray-300` | `text-muted-foreground/50` |
| `border-gray-300` | `border-border` |
| `bg-gray-300` | `bg-muted` |
| `placeholder-gray-300` | `placeholder-muted-foreground/50` |
| `focus:ring-gray-100` | `focus:ring-border` |

#### 蓝色

| 不要 | 要 |
|------|-----|
| `bg-blue-100` / `bg-blue-50` | `bg-primary/10` |
| `text-blue-700` / `text-blue-400` | `text-primary` |
| `border-blue-300` / `border-blue-200` | `border-primary/30` / `border-primary/20` |
| `hover:bg-blue-100` | `hover:bg-primary/20` |
| `hover:border-blue-400` | `hover:border-primary` |
| `focus:border-blue-500` | `focus:border-primary` |
| `placeholder-blue-300` | `placeholder-primary/30` |
| `ring-blue-200` | `ring-primary/20` |

#### 白色

| 不要 | 要 |
|------|-----|
| `bg-white`（卡片/面板） | `bg-background` 或 `bg-card` |
| `text-white`（主按钮上） | `text-primary-foreground` |
| `bg-white`（标签页激活态） | `bg-card` |

#### 红色

| 不要 | 要 |
|------|-----|
| `text-red-600` / `text-red-500` | `text-destructive` |
| `bg-red-50` / `border-red-200` | `bg-destructive/10` / `border-destructive/30` |
| `hover:text-red-500` `hover:bg-red-50` | `hover:text-destructive` `hover:bg-destructive/10` |

#### 按钮悬停

| 不要 | 要 |
|------|-----|
| `hover:bg-primary`（send/update） | `hover:bg-primary/90` |
| 次级按钮 `bg-secondary text-muted-foreground` | `bg-secondary text-secondary-foreground` |

### 语义徽章色（保留硬编码）

这些颜色有固定语义含义，不通过 CSS 变量统一：

| 徽章 | 颜色 | 含义 |
|------|------|------|
| PK | `bg-[#fef3c7] text-[#b45309]` | 主键（琥珀） |
| FK | `bg-[#dbeafe] text-[#1d4ed8]` | 外键（蓝） |
| UQ | `bg-[#ede9fe] text-[#6d28d9]` | 唯一约束（紫） |
| ER 匹配 | `border-[#eab308]` | 搜索匹配（黄） |
| ER 激活匹配 | `border-[#f97316]` | 当前匹配项（橙） |

---

## 2. 字体与排版

### 字体配置

| 用途 | 字体栈 | 来源 |
|------|--------|------|
| 正文/UI（`--font-sans`） | `'Geist', ui-sans-serif, system-ui, -apple-system, sans-serif` | Google Fonts |
| 代码（`--font-mono`） | `'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace` | Google Fonts |

Google Fonts 导入（`input.css` 第 1 行）：
```css
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap');
```

### 排版层级

| 层级 | Tailwind 类 | 用在哪里 |
|------|------------|---------|
| 面板标题 | `text-xl font-bold` | 左右面板标题 |
| 表格名 | `text-lg font-bold` | 数据表名称标签 |
| 正文/表格内容 | `text-sm` | 表格单元格、正文段落 |
| 辅助文字 | `text-xs` | 元数据、标签、过滤器 |
| 代码（Monaco） | `fontSize: 14` | Monaco 编辑器 |
| 代码（内联） | `font-mono text-xs` | 索引/视图/触发器 SQL 预览 |

### 字体注意事项

- 正文用 `font-sans`（Geist），**不要**在业务组件中混用其他字体
- 等宽场景统一用 `font-mono`（Geist Mono），不要手写 `font-family` 字符串
- 标题默认与正文字体相同（`--font-heading: var(--font-sans)`）

---

## 3. 布局与间距

### 主布局

`Splitpanes` 左右两栏，左侧 28%、右侧自适应：

```html
<Splitpanes class="default-theme h-screen">
  <Pane :size="28" :min-size="20">  <!-- 左侧：编辑器 --> </Pane>
  <Pane :min-size="20">             <!-- 右侧：数据展示 --> </Pane>
</Splitpanes>
```

- 不要手写 `mousedown`/`mousemove` 分割逻辑——所有面板拖拽由 splitpanes 处理
- 分割线样式在 `input.css` 的 `.splitpanes__splitter` 中定义
- AI 面板：`fixed z-50` 浮动，独立于主布局，可自由拖拽/缩放

### 面板内部结构

**左侧**（`CodeEditor.vue`）：工具栏行 → 标签栏 → Monaco 编辑器
**右侧**（`DataVisualizer.vue`）：标题 → 子标签栏 → 元数据栏 → 内容区

### 间距尺度

使用标准 Tailwind 间距值，不在 px-2.5 等非标准值上徘徊：

| Token | 值 | 用在哪里 |
|-------|-----|---------|
| `px-1` / `py-1` | 4px | 徽章、紧凑按钮 |
| `px-2` / `py-2` | 8px | 表格单元格、下拉项 |
| `px-3` / `py-3` | 12px | 面板外边距、卡片内边距 |
| `px-4` / `py-4` | 16px | 模态内容、消息气泡 |
| `py-6` | 24px | 面板顶部内边距 |
| `mb-10` | 40px | 数据表之间 |

### 半值间距舍入规则

非整数间距统一向上舍入：

| 当前值 | 替换为 | 适用场景 |
|--------|--------|---------|
| `0.5` (2px) | `1` (4px) | 紧凑标签、内联标记、小间距 |
| `1.5` (6px) | `2` (8px) | 徽章内边距、下拉项、工具栏按钮 |
| `2.5` (10px) | `2` (8px) 或 `3` (12px) | 按钮用 `3`，紧凑面板用 `2` |

### 圆角

| Token | 值 | 用在哪里 |
|-------|-----|---------|
| `rounded-md` | 6px | 表格名标签、下拉面板 |
| `rounded-lg` | 10px | 表格卡片、模态、输入框 |
| `rounded-xl` | 14px | AI 面板、空状态图标 |
| `rounded-2xl` | — | AI 面板外层 |
| `rounded-full` | 9999px | 加载徽章、图标圆形底 |

---

## 4. 组件模式

### 按钮

| 角色 | 类 |
|------|-----|
| 主操作 | `bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm` |
| 次级操作 | `bg-secondary text-secondary-foreground hover:bg-secondary/80` |
| AI 入口 | `bg-gradient-to-r from-purple-50 to-indigo-50 text-primary border border-purple-200` |
| 危险操作 | `text-destructive hover:text-destructive hover:bg-destructive/10` |
| 图标按钮 | `text-muted-foreground/70 hover:text-primary hover:bg-secondary` |

### 标签栏

| 状态 | 类 |
|------|-----|
| 激活 | `bg-card text-primary border-primary font-medium` |
| 非激活 | `text-muted-foreground border-transparent hover:bg-secondary hover:text-secondary-foreground` |
| 指示线 | `border-b-[3px]`（统一 3px） |

### 表格/数据卡片

```html
<div class="overflow-x-auto shadow-lg border border-border rounded-lg bg-card relative">
```

表名标签：`text-lg font-bold px-3 py-1.5 rounded-md shadow-sm border`，DDL 操作时紫底、DML 时蓝底、非激活白底灰字。

### 输入框

```html
<input class="... border border-border rounded-lg outline-none
              focus:border-primary/60 focus:ring-2 focus:ring-primary/20" />
```

### 空状态

图标区域带渐变色背景：`bg-gradient-to-br from-blue-50 to-indigo-50 shadow-sm`。

---

## 5. 交互动效

### 过渡时长

| 场景 | 类 |
|------|-----|
| 颜色/背景/边框变化 | `transition-colors` |
| 透明度变化 | `transition-opacity` |
| 阴影变化 | `transition-shadow` |
| 颜色+阴影同时变化 | `transition-colors transition-shadow` |
| 颜色+缩放+透明度 | `transition-colors transition-transform transition-opacity` |

- 默认时长使用 Tailwind 内置（≈150ms），不用 `duration-300` 等更长值
- **不用 `transition-all`**——性能差且容易产生非预期动画

### 常用交互

**悬停：**
- 主按钮：`hover:bg-primary/90`
- 次级按钮：`hover:bg-secondary`
- 表格行：`hover:bg-muted`
- 图标按钮：`hover:text-primary hover:bg-secondary`
- 卡片：`hover:border-primary hover:shadow-md`
- 删除按钮：`hover:text-destructive hover:bg-destructive/10`

**聚焦：**
- 输入框：`focus:border-primary/60 focus:ring-2 focus:ring-primary/20`

**加载：**
- 执行中徽章：`animate-pulse`
- 不使用骨架屏

### 不用的动效

- 无页面级入场动画
- 无滚动触发动画
- 无模态弹窗缩放动画
- 标签页切换即时（无过渡）

---

## 6. 组件分类与设计标准边界

### 组件分类

- **UI 原语**（`components/ui/`）—— Reka-ui v2 封装，语义化类 + `cn()` 合并类名。只封装行为，不改样式。
- **业务组件**（`components/` 根目录）—— 用语义化类写样式，不手写硬编码颜色。

新组件先放到业务组件目录，等到有复用需求再抽象到 `ui/`。

### 设计标准边界

本项目混用三种设计来源：

| 组件类别 | 位置 | 颜色/间距/字体遵循 | transition 遵循 |
|---------|------|-------------------|-----------------|
| UI 原语 | `components/ui/` | **本指南** | shadcn-vue 约定（`transition-all`） |
| AI 元素 | `components/ai-elements/` | **本指南** | Vercel AI SDK 自有样式 |
| 业务组件 | `components/*.vue`（根目录） | **本指南** | **本指南** |

- **颜色令牌、间距、字体**：三类组件统一遵循本指南，不允许例外
- **transition**：UI 原语和 AI 元素保留各自上游库的过渡约定，业务组件使用 `transition-colors` / `transition-opacity` / `transition-shadow`
