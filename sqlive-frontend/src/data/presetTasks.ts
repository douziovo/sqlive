import type { KnowledgeTask, TaskSubstep } from '@/composables/useKnowledgeTasks'
import { nanoid } from 'nanoid'

// ── Preset substep helper ─────────────────────────────────────────
// Seeds substeps so the first one is active, the rest are locked.

function makeSubsteps(labels: string[]): TaskSubstep[] {
  return labels.map((label, i) => ({
    id: `preset-step-${nanoid()}-${i}`,
    label,
    status: i === 0 ? 'active' : 'locked'
  }))
}

// ── Preset task seed ──────────────────────────────────────────────
// Built-in tasks covering all 24 knowledge topics across 6 chapters.
// Mix of core path (main quest per chapter), deep dives (advanced topics),
// and daily drills (spaced repetition). Seeded once on first run.

export interface PresetTaskSeed {
  topicId: string
  title: string
  notes: string
  priority: KnowledgeTask['priority']
  category: KnowledgeTask['category']
  substeps: string[]
  dueDate?: string
  isPinned?: boolean
}

function daysFromNow(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  // D-13: toLocaleDateString('en-CA') returns 'YYYY-MM-DD' in local time.
  // Previously used toISOString().slice(0, 10) which returns UTC date —
  // off by 1 day in UTC+ timezones near midnight (e.g., UTC+8 23:00 local
  // on June 25 + 1 day → June 26 23:00 local → toISOString returns June 27).
  return d.toLocaleDateString('en-CA')
}

export const PRESET_TASKS: PresetTaskSeed[] = [
  // ════════════════════════════════════════════════════════════════
  // CORE PATH — 主线任务，每章一个
  // ════════════════════════════════════════════════════════════════
  {
    topicId: 'sql-basics',
    title: 'SQL 启程：写出你的第一条 SELECT',
    notes: '从零开始掌握 SELECT / FROM / WHERE / LIMIT 核心语法',
    priority: 'high',
    category: 'core',
    isPinned: true,
    substeps: [
      '阅读 SELECT / FROM / WHERE 语法文档',
      '在编辑器写出第一条 SELECT 查询',
      '使用 WHERE 过滤结果行',
      '用 LIMIT 限制返回行数',
      '通过 AI 助手复盘查询逻辑'
    ]
  },
  {
    topicId: 'joins',
    title: '多表关联：INNER/LEFT JOIN 实战',
    notes: '理解 JOIN 的工作原理与不同 JOIN 类型的语义',
    priority: 'high',
    category: 'core',
    substeps: [
      '理解 INNER JOIN 与 LEFT JOIN 的差异',
      '编写一个两表 INNER JOIN 查询',
      '改写为 LEFT JOIN 观察结果差异',
      '处理 ON 子句的连接条件',
      '完成一道三表 JOIN 挑战'
    ]
  },
  {
    topicId: 'create-table',
    title: '建表入门：CREATE TABLE 与约束',
    notes: '掌握建表语法、数据类型、主键与常用约束',
    priority: 'high',
    category: 'core',
    substeps: [
      '学习 CREATE TABLE 基本语法',
      '为每列选择合适的数据类型',
      '定义 PRIMARY KEY 主键',
      '添加 NOT NULL 与 DEFAULT 约束',
      '测试违反约束时的错误反馈'
    ]
  },
  {
    topicId: 'insert',
    title: '数据写入：INSERT 语句全解',
    notes: '单行/多行插入、默认值、SELECT...INSERT',
    priority: 'medium',
    category: 'core',
    substeps: [
      '学习单行 INSERT 语法',
      '使用多行 VALUES 一次插入',
      '省略列名使用默认值',
      '用 INSERT...SELECT 从其他表导入',
      '验证数据是否正确写入'
    ]
  },
  {
    topicId: 'cte',
    title: 'CTE 与递归：WITH 子句的力量',
    notes: '通用表表达式、递归 CTE、组织树结构',
    priority: 'high',
    category: 'core',
    substeps: [
      '理解 WITH 语法和 CTE 的优势',
      '编写一个简单 CTE 查询',
      '用 CTE 简化复杂 JOIN',
      '实现递归 CTE（如员工层级树）',
      '对比 CTE 与子查询的可读性'
    ]
  },
  {
    topicId: 'optimization',
    title: '查询优化：从 EXPLAIN 开始',
    notes: '执行计划、索引利用、查询重写',
    priority: 'medium',
    category: 'core',
    substeps: [
      '学习 EXPLAIN QUERY PLAN 语法',
      '分析一个慢查询的执行计划',
      '识别全表扫描与索引利用',
      '重写查询以利用索引',
      '对比优化前后的执行计划'
    ]
  },

  // ════════════════════════════════════════════════════════════════
  // DEEP DIVE — 深度学习，进阶知识点
  // ════════════════════════════════════════════════════════════════
  {
    topicId: 'window-functions',
    title: '窗口函数：ROW_NUMBER 与排名计算',
    notes: 'OVER 子句、排名函数、累计聚合',
    priority: 'medium',
    category: 'deep-dive',
    substeps: [
      '理解 OVER() 子句的工作原理',
      '使用 ROW_NUMBER 编号行',
      '学习 RANK / DENSE_RANK 的差异',
      '用 SUM() OVER 计算累计值',
      '对比窗口函数与 GROUP BY 的差异'
    ]
  },
  {
    topicId: 'subqueries',
    title: '子查询：EXISTS 与相关子查询',
    notes: '标量子查询、IN 子查询、相关子查询',
    priority: 'medium',
    category: 'deep-dive',
    substeps: [
      '理解标量子查询的用法',
      '使用 IN 子查询过滤数据',
      '学习 EXISTS 与 NOT EXISTS',
      '编写相关子查询',
      '对比子查询与 JOIN 的可读性'
    ]
  },
  {
    topicId: 'triggers',
    title: '触发器：自动化数据响应',
    notes: 'BEFORE/AFTER 触发器、审计日志',
    priority: 'low',
    category: 'deep-dive',
    substeps: [
      '理解触发器的工作时机',
      '学习 BEFORE 与 AFTER 的差异',
      '编写一个 INSERT 后的审计触发器',
      '测试触发器在 UPDATE 时的行为',
      '识别触发器的性能影响'
    ]
  },
  {
    topicId: 'transactions',
    title: '事务：ACID 与 BEGIN/COMMIT',
    notes: '事务隔离、回滚、保存点',
    priority: 'medium',
    category: 'deep-dive',
    substeps: [
      '理解 ACID 四大特性',
      '使用 BEGIN 启动事务',
      'COMMIT 提交 vs ROLLBACK 回滚',
      '学习 SAVEPOINT 保存点',
      '测试事务中的错误回滚'
    ]
  },
  {
    topicId: 'views',
    title: '视图：虚拟表的封装',
    notes: 'CREATE VIEW、可更新视图、安全暴露',
    priority: 'low',
    category: 'deep-dive',
    substeps: [
      '理解视图的概念与用途',
      '创建一个简单视图',
      '通过视图查询复杂数据',
      '测试视图的更新限制',
      '用视图实现数据安全暴露'
    ]
  },
  {
    topicId: 'indexes',
    title: '索引：B-Tree 与查询加速',
    notes: 'CREATE INDEX、复合索引、索引选择',
    priority: 'medium',
    category: 'deep-dive',
    substeps: [
      '理解 B-Tree 索引结构',
      '为高频查询列创建索引',
      '学习复合索引的列顺序',
      '用 EXPLAIN 验证索引命中',
      '识别索引的写入开销'
    ]
  },
  {
    topicId: 'set-operations',
    title: '集合操作：UNION/INTERSECT/EXCEPT',
    notes: '合并、交集、差集',
    priority: 'low',
    category: 'deep-dive',
    substeps: [
      '学习 UNION 与 UNION ALL 的差异',
      '使用 INTERSECT 求交集',
      '使用 EXCEPT 求差集',
      '组合多个集合操作',
      '识别列数与类型匹配要求'
    ]
  },
  {
    topicId: 'aggregation',
    title: '聚合进阶：GROUP BY + HAVING',
    notes: '分组、聚合函数、HAVING 过滤',
    priority: 'medium',
    category: 'deep-dive',
    substeps: [
      '学习 GROUP BY 分组语法',
      '使用 COUNT/SUM/AVG/MIN/MAX',
      '理解 HAVING 与 WHERE 的差异',
      '编写多列分组查询',
      '完成一道分组统计实战'
    ]
  },
  {
    topicId: 'alter-table',
    title: '表结构修改：ALTER TABLE',
    notes: '加列、改列、重命名、删列',
    priority: 'low',
    category: 'deep-dive',
    substeps: [
      '学习 ALTER TABLE ADD COLUMN',
      '修改列的数据类型',
      '重命名表与列',
      '安全删除列（注意数据丢失）',
      '测试 ALTER 后的数据完整性'
    ]
  },
  {
    topicId: 'constraints',
    title: '约束深入：PK/FK/UNIQUE/CHECK',
    notes: '主键、外键、唯一、检查约束',
    priority: 'medium',
    category: 'deep-dive',
    substeps: [
      '理解 PRIMARY KEY 的作用',
      '学习 FOREIGN KEY 与 REFERENCES',
      '使用 UNIQUE 保证唯一性',
      '编写 CHECK 自定义约束',
      '测试违反约束时的错误'
    ]
  },
  {
    topicId: 'query-planning',
    title: '查询计划分析：读懂 SQLite 的执行策略',
    notes: 'SCAN vs SEARCH、临时表、排序',
    priority: 'low',
    category: 'deep-dive',
    substeps: [
      '学习 EXPLAIN QUERY PLAN 输出格式',
      '识别 SCAN 与 SEARCH 的差异',
      '理解临时 B-Tree 的产生',
      '分析 USE TEMP B-TREE 的含义',
      '对比有/无索引的查询计划'
    ]
  },

  // ════════════════════════════════════════════════════════════════
  // DAILY DRILLS — 每日练习，间隔复习
  // ════════════════════════════════════════════════════════════════
  {
    topicId: 'filtering',
    title: '每日 5 分钟：WHERE 运算符速记',
    notes: 'IN / BETWEEN / LIKE / IS NULL 巩固',
    priority: 'low',
    category: 'daily',
    dueDate: daysFromNow(1),
    substeps: [
      '复习 WHERE 运算符清单',
      '写 3 个不同运算符的过滤查询',
      '自我评估掌握程度'
    ]
  },
  {
    topicId: 'sorting',
    title: '每日速记：ORDER BY 与 DISTINCT',
    notes: '排序方向、多列排序、去重',
    priority: 'low',
    category: 'daily',
    dueDate: daysFromNow(2),
    substeps: [
      '复习 ORDER BY ASC/DESC',
      '编写多列排序查询',
      '使用 DISTINCT 去重',
      '对比 DISTINCT 与 GROUP BY'
    ]
  },
  {
    topicId: 'string-functions',
    title: '每日练习：字符串函数',
    notes: 'SUBSTR / INSTR / REPLACE / UPPER / LOWER',
    priority: 'low',
    category: 'daily',
    dueDate: daysFromNow(3),
    substeps: [
      '复习常用字符串函数',
      '编写字符串拼接查询',
      '使用 LIKE 模式匹配',
      '完成一道字符串处理实战'
    ]
  },
  {
    topicId: 'datetime',
    title: '每日练习：日期时间函数',
    notes: 'date / time / datetime / strftime',
    priority: 'low',
    category: 'daily',
    dueDate: daysFromNow(4),
    substeps: [
      '复习日期时间函数',
      '编写按日期过滤的查询',
      '使用 strftime 格式化',
      '计算两个日期的差值'
    ]
  },
  {
    topicId: 'data-types',
    title: '每日回顾：SQLite 数据类型',
    notes: 'INTEGER / TEXT / REAL / BLOB 与类型亲和',
    priority: 'low',
    category: 'daily',
    dueDate: daysFromNow(5),
    substeps: [
      '复习 4 种基本存储类型',
      '理解类型亲和性（Type Affinity）',
      '测试隐式类型转换',
      '识别布尔值在 SQLite 中的表示'
    ]
  },

  // ════════════════════════════════════════════════════════════════
  // BONUS CHALLENGE — 实战挑战
  // ════════════════════════════════════════════════════════════════
  {
    topicId: 'update',
    title: '实战：批量更新与条件修改',
    notes: 'UPDATE...WHERE、CASE 表达式、安全更新',
    priority: 'medium',
    category: 'deep-dive',
    substeps: [
      '学习 UPDATE 基本语法',
      '使用 WHERE 限制更新范围',
      '用 CASE 表达式条件赋值',
      '在事务中执行批量更新',
      '验证更新后的数据正确性'
    ]
  },
  {
    topicId: 'delete',
    title: '实战：安全删除与事务保护',
    notes: 'DELETE vs TRUNCATE、外键级联、软删除',
    priority: 'medium',
    category: 'deep-dive',
    substeps: [
      '学习 DELETE 基本语法',
      '理解 DELETE 与 DROP 的差异',
      '在事务中执行删除以保安全',
      '测试外键 ON DELETE 行为',
      '实现软删除（is_deleted 列）'
    ]
  }
]

// ── Convert seed → full KnowledgeTask (with generated IDs) ────────

export function buildPresetTasks(): KnowledgeTask[] {
  const now = new Date().toISOString()
  return PRESET_TASKS.map((seed) => ({
    id: `preset-${nanoid()}`,
    topicId: seed.topicId,
    title: seed.title,
    notes: seed.notes,
    priority: seed.priority,
    category: seed.category,
    substeps: makeSubsteps(seed.substeps),
    isPinned: seed.isPinned ?? false,
    dueDate: seed.dueDate,
    status: 'todo' as const,
    createdAt: now,
    completedAt: undefined
  }))
}

