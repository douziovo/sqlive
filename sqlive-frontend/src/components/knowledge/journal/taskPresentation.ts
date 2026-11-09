import type { KnowledgeTask } from '@/composables/useKnowledgeTasks'

/**
 * taskPresentation — pure helpers + shared types for the task journal
 * (extracted from TaskJournalPanel.vue). No reactive state.
 */

export type JournalCategory = 'core' | 'deep-dive' | 'daily'

export const DIFFICULTY_LABELS: Record<number, string> = {
    1: '入门',
    2: '进阶',
    3: '高级'
}

// Payload shape emitted by TaskCreateForm's 'create' event.
export interface TaskCreatePayload {
    title: string
    dueDate?: string
    notes: string
    priority: KnowledgeTask['priority']
    topicId: string
    category?: KnowledgeTask['category']
    substeps?: string[]
}

export function allSubstepsDone(task: KnowledgeTask): boolean {
    return task.substeps.every((s) => s.status === 'done')
}

export function getTaskXp(difficulty = 1): number {
    return ({ 1: 30, 2: 50, 3: 80 }[difficulty] ?? 30) + 10
}

export function priorityDotClass(priority: string): string {
    return (
        {
            low: 'journal__dot--low',
            medium: 'journal__dot--medium',
            high: 'journal__dot--high'
        }[priority] ?? 'journal__dot--low'
    )
}
