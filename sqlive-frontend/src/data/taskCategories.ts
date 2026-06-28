// D-04: Shared task category color tokens and labels.
// Colors are CSS var() references to --task-* variables defined in input.css :root.
// This file is the single source of truth — TaskItem.vue and TaskJournalPanel.vue
// both import from here to avoid duplicate definitions.

export const TASK_CATEGORY_COLORS: Record<string, string> = {
    core: 'var(--task-core)',
    'deep-dive': 'var(--task-deep)',
    daily: 'var(--task-daily)',
}

export const TASK_CATEGORY_LABELS: Record<string, string> = {
    core: '核心路径',
    'deep-dive': '深度学习',
    daily: '每日练习',
}
