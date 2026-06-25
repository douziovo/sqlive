<template>
  <template v-if="z >= 0.3">
    <div
      class="kg-node"
      :style="{ opacity: labelOpacity, pointerEvents: labelOpacity < 0.3 ? 'none' : 'auto' }"
      :class="[
        `kg-node--d${data.difficulty}`,
        `kg-node--${data.status}`,
        {
          'kg-node--focused': data.isFocused,
          'kg-node--highlighted': data.isHighlighted,
          'kg-node--search-match': data.isSearchMatch,
          'kg-node--active-match': data.isActiveMatch,
          'kg-node--unlock-glow': showUnlockGlow,
          'kg-node--dimmed': data.isDimmed
        }
      ]"
      tabindex="0"
    >
      <span class="kg-node__label" :title="data.label">{{ data.label }}</span>
      <div v-if="showSparkBurst" class="kg-spark-layer">
        <span
          v-for="(p, i) in particles"
          :key="i"
          class="kg-spark"
          :style="{ '--sx': p.tx + 'px', '--sy': p.ty + 'px', background: p.color }"
        />
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import { computed, inject, ref, unref, watch } from 'vue'
import type { KnowledgeNodeData } from '@/composables/useKnowledgeGraph'

const SPARK_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#f59e0b', '#22c55e', '#3b82f6', '#ec4899']
const SPARK_COUNT = 18

interface Particle {
  tx: number
  ty: number
  color: string
}

const props = defineProps<{
  id: string
  data: KnowledgeNodeData
  selected?: boolean
}>()

const zoomLevel = inject<number>('zoomLevel', 1)
const z = computed(() => unref(zoomLevel))

const labelOpacity = computed(() => {
  const zz = z.value
  if (zz < 0.3) return 0
  if (zz < 0.5) return (zz - 0.3) / 0.2
  return 1
})

const showSparkBurst = ref(false)
const showUnlockGlow = ref(false)
const particles = ref<Particle[]>([])

watch(() => props.data.triggerSparkBurst, (val) => {
  if (val) {
    const items: Particle[] = []
    for (let i = 0; i < SPARK_COUNT; i++) {
      const angle = (Math.PI * 2 * i) / SPARK_COUNT
      const dist = 40 + Math.random() * 60
      items.push({
        tx: Math.cos(angle) * dist,
        ty: Math.sin(angle) * dist,
        color: SPARK_COLORS[i % SPARK_COLORS.length]
      })
    }
    particles.value = items
    showSparkBurst.value = true
    setTimeout(() => { showSparkBurst.value = false }, 750)
  }
})

watch(() => props.data.triggerUnlockGlow, (val) => {
  if (val) {
    showUnlockGlow.value = true
    setTimeout(() => { showUnlockGlow.value = false }, 1200)
  }
})
</script>

<style scoped>
.kg-node {
  position: relative;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.12s linear;
  border: 2px solid transparent;
  white-space: nowrap;
  user-select: none;
  display: flex;
  align-items: center;
  will-change: transform;
}

.kg-node:hover {
  z-index: 30;
  filter: brightness(1.05);
}

/* D-12: keyboard focus equivalent — same visual cue as :hover plus outline */
.kg-node:focus-visible {
  z-index: 30;
  filter: brightness(1.05);
  outline: 2px solid var(--node-mastered-d1-border);
  outline-offset: 2px;
}

/* D-07: label truncate — long titles (e.g. "CTE 公共表表达式") clip with ellipsis;
   full title shown via native tooltip from :title attribute on the span. */
.kg-node__label {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
}

/* Status colours */
.kg-node--mastered.kg-node--d1 { background: var(--node-mastered-d1-bg); border-color: var(--node-mastered-d1-border); color: var(--node-mastered-d1-text); }
.kg-node--mastered.kg-node--d2 { background: var(--node-mastered-d2-bg); border-color: var(--node-mastered-d2-border); color: var(--node-mastered-d2-text); }
.kg-node--mastered.kg-node--d3 { background: var(--node-mastered-d3-bg); border-color: var(--node-mastered-d3-border); color: var(--node-mastered-d3-text); }

.kg-node--in-progress.kg-node--d1 { background: var(--node-progress-d1-bg); border-color: var(--node-progress-d1-border); color: var(--node-progress-d1-text); }
.kg-node--in-progress.kg-node--d2 { background: var(--node-progress-d2-bg); border-color: var(--node-progress-d2-border); color: var(--node-progress-d2-text); }
.kg-node--in-progress.kg-node--d3 { background: var(--node-progress-d3-bg); border-color: var(--node-progress-d3-border); color: var(--node-progress-d3-text); }

.kg-node--unlearned.kg-node--d1 { background: var(--node-unlearned-bg); border-color: var(--node-unlearned-border); color: var(--node-unlearned-text); }
.kg-node--unlearned.kg-node--d2 { background: var(--node-unlearned-bg); border-color: var(--node-unlearned-border); color: var(--node-unlearned-text); }
.kg-node--unlearned.kg-node--d3 { background: var(--node-unlearned-bg); border-color: var(--node-unlearned-border); color: var(--node-unlearned-text); }

.kg-node--locked {
  opacity: 0.45;
  filter: grayscale(0.5);
}

/* Focused */
.kg-node--focused {
  transform: scale(1.15) !important;
  z-index: 30 !important;
  border-color: #6366f1 !important;
  outline: 4px solid rgba(99, 102, 241, 0.25);
  outline-offset: 2px;
}

/* Highlighted */
.kg-node--highlighted {
  outline: 2px solid rgba(99, 102, 241, 0.15);
  outline-offset: 1px;
}

/* Dimmed */
.kg-node--dimmed {
  opacity: 0.12;
  pointer-events: none;
}

/* Search pulse */
.kg-node--search-match { animation: kg-pulse 1.5s ease-in-out infinite; }
.kg-node--active-match { animation: kg-pulse 0.8s ease-in-out infinite; }
@keyframes kg-pulse {
  0% { outline: 2px solid rgba(59, 130, 246, 0.7); outline-offset: 2px; }
  50% { outline: 4px solid rgba(59, 130, 246, 0); outline-offset: 6px; }
  100% { outline: 2px solid rgba(59, 130, 246, 0.7); outline-offset: 2px; }
}

/* Spark burst */
.kg-spark-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 50;
  overflow: visible;
}
.kg-spark {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  animation: sparkBurst 0.7s ease-out forwards;
  pointer-events: none;
}
@keyframes sparkBurst {
  0% { transform: translate(0, 0) scale(1); opacity: 1; }
  100% { transform: translate(var(--sx), var(--sy)) scale(0); opacity: 0; }
}

/* Unlock glow */
.kg-node--unlock-glow { animation: unlockGlow 1s ease-out 3; }
@keyframes unlockGlow {
  0% { outline: 3px solid rgba(99, 102, 241, 0.5); outline-offset: 0px; }
  50% { outline: 3px solid rgba(99, 102, 241, 0); outline-offset: 12px; }
  100% { outline: 3px solid rgba(99, 102, 241, 0); outline-offset: 0px; }
}
</style>
