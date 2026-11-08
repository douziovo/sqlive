/**
 * localStorage key constants — single source of truth.
 * Values MUST NOT change: users already have persisted data under these keys.
 */
export const STORAGE_KEYS = {
    knowledgeTasks: 'ai-knowledge-tasks',
    knowledgeTasksSeeded: 'ai-knowledge-tasks-seeded',
    graphViewport: 'kg-viewport',
    masteredTopics: 'ai-mastered-topics',
    aiApiKey: 'ai_api_key'
} as const
