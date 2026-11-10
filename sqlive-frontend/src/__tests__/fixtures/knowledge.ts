import type { KnowledgeTopic } from '@/composables/useKnowledgeGraph'

export function makeKnowledgeTopic(overrides: Partial<KnowledgeTopic> = {}): KnowledgeTopic {
    return {
        id: 'basics',
        label: '基础',
        description: '',
        keywords: [],
        patterns: [],
        difficulty: 1,
        prerequisites: [],
        nextTopics: [],
        category: 'basics',
        ...overrides
    }
}
