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
    if (task.substeps.length === 0) return false
    return task.substeps.every((s) => s.status === 'done')
}

export function getTaskXp(task: KnowledgeTask): number {
    const baseXp = { low: 20, medium: 30, high: 50 }[task.priority] ?? 30
    const substepBonus = task.substeps.filter((s) => s.status === 'done').length * 5
    return baseXp + substepBonus
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
