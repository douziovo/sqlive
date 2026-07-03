# 知识图谱

## 功能

左侧面板展示当前数据库中表之间的关系图谱，将 schema 信息可视化为节点-边图。表名显示在节点头部、字段列表在节点内部、外键关系以连线表示。

## 图谱生成流程

1. POST /api/execute 返回的 tables 数组和从其中提取的外键信息
2. useErDiagram composable 将 TableSchema[] 转换为 vue-flow 的 Node[] 和 Edge[]
3. tablesToNodes 为每个表生成一个节点，字段信息（列名、类型、主键/外键标记）编码到 ErTableNodeData 中
4. tablesToEdges 遍历外键信息生成带箭头标记的边
5. layoutNodes 调用 dagre 计算布局坐标
6. vue-flow 渲染图谱

## 节点与边

**节点类型**：所有表节点使用统一的自定义 table 类型组件，显示：

- 表名（顶部，粗体）
- 字段列表（每行：字段名 + 类型标签）
- 主键字段高亮显示
- 外键字段标注被引用表名

**边的样式**：使用 vue-flow 内置 smoothstep 类型（不引入自定义边组件），MarkerType.ArrowClosed 箭头从外键表指向被引用表。

## 布局

dagre 自动布局在 onPaneReady 事件中触发一次——面板打开后所有节点的 position 从 {x:0, y:0} 重新计算为 dagre 分配的位置。这是关键时机：如果在组件 mounted 阶段布局，面板收起再打开后节点会全部堆叠在左上角。

图谱支持拖拽、缩放，点击节点高亮相关联的边。

## 文档搜索

在 docs 页面中可按 Ctrl+K 或 / 调出搜索框，搜索当前文档库内容（见文档站 - 搜索）。
