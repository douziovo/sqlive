export interface LearningChapter {
  id: string
  title: string
  description: string
  rankRequired: number
  rewardXp: number
  categoryKey: string
  topicCount: number
}

export const CHAPTERS: LearningChapter[] = [
  { id: 'basics', title: '基础篇', description: '掌握 SQL 最核心的查询语法', rankRequired: 0, rewardXp: 100, categoryKey: 'basics', topicCount: 6 },
  { id: 'query', title: '查询篇', description: '深入学习多表查询与聚合', rankRequired: 0, rewardXp: 150, categoryKey: 'query', topicCount: 4 },
  { id: 'ddl', title: 'DDL篇', description: '掌握表结构定义与约束', rankRequired: 1, rewardXp: 150, categoryKey: 'ddl', topicCount: 4 },
  { id: 'dml', title: 'DML篇', description: '数据的增删改操作', rankRequired: 1, rewardXp: 150, categoryKey: 'dml', topicCount: 3 },
  { id: 'advanced', title: '进阶篇', description: '高级查询技术与窗口函数', rankRequired: 2, rewardXp: 200, categoryKey: 'advanced', topicCount: 5 },
  { id: 'performance', title: '性能篇', description: '查询优化与执行计划分析', rankRequired: 3, rewardXp: 250, categoryKey: 'performance', topicCount: 2 },
]

export function getChapterById(id: string): LearningChapter | undefined {
  return CHAPTERS.find(c => c.id === id)
}
