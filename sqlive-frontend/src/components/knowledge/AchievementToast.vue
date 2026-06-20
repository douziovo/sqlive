<template>
  <Teleport to="body">
    <Transition name="toast-pop">
      <div v-if="visible" class="achievement-toast" :class="toastClass">
        <span class="achievement-toast__icon">{{ icon }}</span>
        <div class="achievement-toast__body">
          <div class="achievement-toast__title">{{ title }}</div>
          <div v-if="subtitle" class="achievement-toast__sub">{{ subtitle }}</div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  visible: boolean
  streak: number
  xp: number
  label: string
  isHighDifficulty: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const icon = computed(() => {
  if (props.streak >= 5) return '🔥'
  if (props.streak >= 3) return '⚡'
  if (props.isHighDifficulty) return '💎'
  return '🌟'
})

const title = computed(() => {
  if (props.streak >= 5) return `${props.streak} 连击！势不可挡！`
  if (props.streak >= 3) return `${props.streak} 连击！保持势头！`
  if (props.isHighDifficulty) return '高阶知识点解锁！'
  return '新知识点掌握！'
})

const subtitle = computed(() => {
  if (!props.label) return ''
  return `${props.label} · +${props.xp} XP`
})

const toastClass = computed(() => {
  if (props.streak >= 5) return 'achievement-toast--fire'
  if (props.streak >= 3) return 'achievement-toast--electric'
  if (props.isHighDifficulty) return 'achievement-toast--high-diff'
  return ''
})
</script>

<style scoped>
.achievement-toast {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 160;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  border-radius: 14px;
  background: linear-gradient(135deg, #1e293b, #334155);
  color: white;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  pointer-events: none;
  white-space: nowrap;
}

.achievement-toast--high-diff {
  background: linear-gradient(135deg, #4c1d95, #7c3aed);
}
.achievement-toast--electric {
  background: linear-gradient(135deg, #92400e, #d97706);
}
.achievement-toast--fire {
  background: linear-gradient(135deg, #991b1b, #dc2626);
}

.achievement-toast__icon {
  font-size: 24px;
  flex-shrink: 0;
}

.achievement-toast__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.achievement-toast__title {
  font-weight: 700;
  font-size: 13px;
}

.achievement-toast__sub {
  font-size: 11px;
  color: #94a3b8;
}

.toast-pop-enter-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.toast-pop-leave-active {
  transition: all 0.2s ease-in;
}
.toast-pop-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-12px) scale(0.9);
}
.toast-pop-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-8px);
}
</style>
