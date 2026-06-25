<template>
  <Teleport to="body">
    <div v-if="active" class="confetti-overlay" aria-hidden="true">
      <div
        v-for="(p, i) in particles"
        :key="i"
        class="confetti-piece"
        :style="{
          left: p.x + 'px',
          top: p.y + 'px',
          width: p.w + 'px',
          height: p.h + 'px',
          background: p.color,
          borderRadius: p.radius,
          '--fall-dist': p.fallDist + 'px',
          '--fall-dur': p.fallDur + 's',
          '--spin': p.spin + 'deg'
        }"
      />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  active: boolean
  originX?: number
  originY?: number
  burst?: boolean
}>()

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6', '#06b6d4']

interface Piece {
  x: number
  y: number
  w: number
  h: number
  color: string
  radius: string
  fallDist: number
  fallDur: number
  spin: number
}

const particles = ref<Piece[]>([])

watch(() => props.active, (val) => {
  if (val) {
    const cx = props.originX ?? (window.innerWidth / 2)
    const cy = props.originY ?? (window.innerHeight / 3)
    const count = props.burst ? 80 : 40

    particles.value = Array.from({ length: count }, () => {
      const size = 4 + Math.random() * 8
      return {
        x: cx - 20 + Math.random() * 80,
        y: cy + Math.random() * 20,
        w: size,
        h: size,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        radius: Math.random() > 0.5 ? '50%' : '2px',
        fallDist: 200 + Math.random() * 300,
        fallDur: 1.5 + Math.random() * 2,
        spin: 360 + Math.random() * 720
      }
    })
  } else {
    // D-20: clear particles on deactivate. Previously old pieces remained
    // in the particles ref even after v-if removed the DOM container,
    // causing stale state on the next active=true cycle.
    particles.value = []
  }
}, { immediate: true })
</script>

<style scoped>
.confetti-overlay {
  position: fixed;
  inset: 0;
  z-index: 150;
  pointer-events: none;
  overflow: hidden;
}

.confetti-piece {
  position: absolute;
  animation: confettiFall var(--fall-dur) linear forwards;
  pointer-events: none;
}

@keyframes confettiFall {
  0% {
    transform: translateY(0) rotate(0deg) scale(1);
    opacity: 1;
  }
  80% {
    opacity: 1;
  }
  100% {
    transform: translateY(var(--fall-dist)) rotate(var(--spin)) scale(0.3);
    opacity: 0;
  }
}
</style>
