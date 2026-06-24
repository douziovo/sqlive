<template>
  <div class="learning-companion__wrapper">
    <ActiveTaskTracker
      v-if="pinnedTask"
      :pinned-task="pinnedTask"
      :topic-label="topicLabel"
      :current-step-label="currentStepLabel"
      @unpin="handleTrackerUnpin"
      @navigate="handleTrackerNavigate"
    />
    <button class="learning-companion" @click="handleOpen">
      <span v-if="pendingCount > 0" class="companion-badge">
        {{ pendingCount > 99 ? '99+' : pendingCount }}
      </span>
      <div class="companion-ring-bg">📚</div>
      <div class="companion-info">
        <span class="companion-count">{{ kgProgress.count }}/{{ kgProgress.total }}</span>
        <span class="companion-level">{{ kgProgress.levelName }}</span>
      </div>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useKnowledgeTasks } from '@/composables/useKnowledgeTasks'
import { useKnowledgeGraph } from '@/composables/useKnowledgeGraph'
import ActiveTaskTracker from './ActiveTaskTracker.vue'

const props = withDefaults(defineProps<{
  topicLabel?: string
}>(), {
  topicLabel: ''
})

const emit = defineEmits<{
  (e: 'open'): void
  (e: 'navigate', topicId: string): void
}>()

const { pendingCount, getPinnedTask, unpinTask } = useKnowledgeTasks()
const kg = useKnowledgeGraph()

const pinnedTask = computed(() => getPinnedTask.value)

const currentStepLabel = computed(() => {
  if (!pinnedTask.value) return ''
  const activeStep = pinnedTask.value.substeps.find((s) => s.status === 'active')
  return activeStep?.label ?? ''
})

// D-02: count/total/levelName all come from kg.progress (single source of truth).
// Removed local masteredTopics useLocalStorage, percentage-based level, and the
// standalone /api/knowledge/graph request — LearningCompanion now reads from the
// singleton graphData that KnowledgePanel populates.
const kgProgress = computed(() => kg.progress.value)

// D-02 (Rule 2 deviation): defensive fetch on mount if graphData is null.
// In production, KnowledgePanel mounts first and populates graphData via its own
// watch(isOpen) hook; this guard only fires when LearningCompanion mounts
// standalone (e.g., in tests or before KnowledgePanel has opened). Avoids the
// duplicate /api/knowledge/graph request that D-02 explicitly removed.
onMounted(() => {
  if (!kg.graphData.value) {
    void kg.fetchGraph()
  }
})

function handleOpen(): void {
  emit('open')
}

function handleTrackerUnpin(): void {
  unpinTask()
}

function handleTrackerNavigate(topicId: string): void {
  emit('navigate', topicId)
}
</script>

<style scoped>
.learning-companion__wrapper {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 35;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.learning-companion {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: white;
  border: 2px solid #e2e8f0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s, box-shadow 0.2s;
  flex-shrink: 0;
}

.learning-companion:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 16px rgba(0,0,0,0.18);
}

.companion-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  border-radius: 999px;
  background: #ef4444;
  color: white;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  z-index: 1;
}

.companion-ring-bg {
  font-size: 18px;
  line-height: 1;
}

.companion-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.1;
}

.companion-count {
  font-size: 10px;
  font-weight: 700;
  color: #334155;
}

.companion-level {
  font-size: 8px;
  color: #64748b;
}
</style>
