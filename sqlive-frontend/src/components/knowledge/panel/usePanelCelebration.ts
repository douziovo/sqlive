import { ref } from 'vue'
import type { Ref } from 'vue'

/**
 * usePanelCelebration — gamification toast / confetti / level-up state
 * (-03 + 09-03), extracted from KnowledgePanel.vue.
 *
 * Owns:
 *   - mastery achievement toast (streak/xp/label/high-difficulty, 2.5s TTL)
 *   - task completion toast (label/xp, 2.5s TTL)
 *   - confetti overlay + level-up banner celebration (5s TTL)
 */
export function usePanelCelebration(): {
    showToast: Ref<boolean>
    toastStreak: Ref<number>
    toastXp: Ref<number>
    toastLabel: Ref<string>
    toastHighDiff: Ref<boolean>
    showTaskToast: Ref<boolean>
    taskToastLabel: Ref<string>
    taskToastXp: Ref<number>
    showConfetti: Ref<boolean>
    confettiKey: Ref<number>
    showLevelUpToast: Ref<boolean>
    showAchievementToast: (
        result: { xpGained: number; leveledUp: boolean; streak: number },
        topicLabel: string,
        isHighDiff: boolean
    ) => void
    showTaskToastFor: (topicLabel: string, xpGained: number) => void
    celebrateLevelUp: () => void
} {
    // ── Gamification state (-03) ───────────────────────────
    const showToast = ref(false)
    const toastStreak = ref(0)
    const toastXp = ref(0)
    const toastLabel = ref('')
    const toastHighDiff = ref(false)
    const showConfetti = ref(false)
    const confettiKey = ref(0)
    const showLevelUpToast = ref(false)

    // ── Task gamification state (-03) ──────────────────────
    const showTaskToast = ref(false)
    const taskToastLabel = ref('')
    const taskToastXp = ref(0)

    function showAchievementToast(
        result: { xpGained: number; leveledUp: boolean; streak: number },
        topicLabel: string,
        isHighDiff: boolean
    ): void {
        toastStreak.value = result.streak
        toastXp.value = result.xpGained
        toastLabel.value = topicLabel
        toastHighDiff.value = isHighDiff
        showToast.value = true
        setTimeout(() => {
            showToast.value = false
        }, 2500)
    }

    function showTaskToastFor(topicLabel: string, xpGained: number): void {
        taskToastLabel.value = topicLabel
        taskToastXp.value = xpGained
        showTaskToast.value = true
        setTimeout(() => {
            showTaskToast.value = false
        }, 2500)
    }

    function celebrateLevelUp(): void {
        showConfetti.value = true
        confettiKey.value++
        showLevelUpToast.value = true
        setTimeout(() => {
            showConfetti.value = false
            showLevelUpToast.value = false
        }, 5000)
    }

    return {
        showToast,
        toastStreak,
        toastXp,
        toastLabel,
        toastHighDiff,
        showTaskToast,
        taskToastLabel,
        taskToastXp,
        showConfetti,
        confettiKey,
        showLevelUpToast,
        showAchievementToast,
        showTaskToastFor,
        celebrateLevelUp
    }
}
