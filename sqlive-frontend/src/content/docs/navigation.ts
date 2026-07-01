/**
 * Sidebar navigation data source (D-01, D-05).
 *
 * Adding an article = drop a .md file under src/content/docs/ + add one entry here.
 * Zero component changes needed.
 */

export type NavCategory = 'intro' | 'usage' | 'api' | 'changelog'

export interface NavItem {
  /** Slug without leading slash, e.g. 'intro', 'usage/editor' */
  slug: string
  /** Display title (Chinese) */
  title: string
  /** Category bucket for sidebar grouping */
  category: NavCategory
  /** Router path, e.g. '/docs/intro' */
  path: string
}

export const navigation: NavItem[] = [
  { slug: 'intro',            title: '项目介绍',   category: 'intro',     path: '/docs/intro' },
  { slug: 'usage/editor',     title: '编辑器',     category: 'usage',     path: '/docs/usage/editor' },
  { slug: 'usage/visualizer', title: '数据可视化', category: 'usage',     path: '/docs/usage/visualizer' },
  { slug: 'usage/ai',         title: 'AI 助手',    category: 'usage',     path: '/docs/usage/ai' },
  { slug: 'usage/knowledge',  title: '知识图谱',   category: 'usage',     path: '/docs/usage/knowledge' },
  { slug: 'changelog',        title: '变更日志',   category: 'changelog', path: '/docs/changelog' },
]
