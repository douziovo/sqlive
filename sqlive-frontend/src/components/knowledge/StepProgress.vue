<template>
  <div class="step-progress">
    <div
      v-for="(substep, index) in substeps"
      :key="substep.id"
      class="step-progress__item"
    >
      <!-- Node + connector column -->
      <div class="step-progress__track">
        <div
          class="step-progress__node"
          :class="{
            'step-progress__node--done': substep.status === 'done',
            'step-progress__node--active': substep.status === 'active',
            'step-progress__node--locked': substep.status === 'locked'
          }"
          @click="handleStepClick(substep.id)"
        >
          <!-- Done checkmark -->
          <svg
            v-if="substep.status === 'done'"
            class="step-progress__check"
            viewBox="0 0 12 12"
          >
            <polyline
              points="2,6 5,9 10,3"
              fill="none"
              stroke="white"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
        <!-- Connector line (skip last step) -->
        <div
          v-if="index < substeps.length - 1"
          class="step-progress__connector"
          :class="{
            'step-progress__connector--done': substep.status === 'done'
          }"
        />
      </div>

      <!-- Label -->
      <span
        class="step-progress__label"
        :class="{
          'step-progress__label--done': substep.status === 'done',
          'step-progress__label--active': substep.status === 'active',
          'step-progress__label--locked': substep.status === 'locked'
        }"
      >
        {{ substep.label }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
// StepProgress — vertical step timeline with per-status visual states
import type { TaskSubstep } from '@/composables/useKnowledgeTasks'

const props = withDefaults(defineProps<{
  substeps: TaskSubstep[]
  editable?: boolean
}>(), {
  editable: false
})

const emit = defineEmits<{
  (e: 'toggleStep', substepId: string): void
}>()

function handleStepClick(substepId: string): void {
  if (!props.editable) return
  const substep = props.substeps.find((s) => s.id === substepId)
  if (!substep || substep.status === 'locked') return
  emit('toggleStep', substepId)
}
</script>

<style scoped>
.step-progress {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.step-progress__item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

/* ── Track (node + connector) ──────── */

.step-progress__track {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  width: 12px;
}

.step-progress__node {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, box-shadow 0.2s;
}

/* Done: solid green with checkmark */
.step-progress__node--done {
  background: #52C41A;
  border: none;
}

/* Active: primary color with pulse animation */
.step-progress__node--active {
  background: var(--primary);
  border: none;
  animation: step-pulse 2s infinite;
}

/* Locked: hollow gray circle */
.step-progress__node--locked {
  background: transparent;
  border: 2px solid var(--border);
}

.step-progress__check {
  width: 8px;
  height: 8px;
}

/* ── Connector line ────────────────── */

.step-progress__connector {
  width: 1px;
  height: 20px;
  background: var(--border);
  flex-shrink: 0;
}

.step-progress__connector--done {
  background: #52C41A;
}

/* ── Label ─────────────────────────── */

.step-progress__label {
  font-size: 13px;
  line-height: 1.4;
  transition: color 0.2s, text-decoration 0.2s;
}

.step-progress__label--done {
  color: var(--muted-foreground);
  opacity: 0.6;
  text-decoration: line-through;
}

.step-progress__label--active {
  color: var(--foreground);
  font-weight: 600;
}

.step-progress__label--locked {
  color: var(--muted-foreground);
}

/* ── Pulse animation ───────────────── */

@keyframes step-pulse {
  0% {
    box-shadow: 0 0 0 0 oklch(0.488 0.243 264.376 / 0.4);
  }
  70% {
    box-shadow: 0 0 0 6px oklch(0.488 0.243 264.376 / 0);
  }
  100% {
    box-shadow: 0 0 0 0 oklch(0.488 0.243 264.376 / 0);
  }
}
</style>
