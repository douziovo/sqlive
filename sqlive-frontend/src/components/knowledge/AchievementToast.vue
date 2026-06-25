<template>
  <Teleport to="body">
    <Transition name="toast-pop">
      <div v-if="visible" class="achievement-toast" :class="toastClass" role="status" aria-live="polite">
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

const props = withDefaults(defineProps<{
  visible: boolean
  streak: number
  xp: number
  label: string
  isHighDifficulty: boolean
  variant?: 'mastery' | 'task'
}>(), {
  variant: 'mastery'
})

const emit = defineEmits<{
  (e: 'close'): void
}>()

const icon = computed(() => {
  if (props.variant === 'task') return '✅'
  if (props.streak >= 5) return '🔥'
  if (props.streak >= 3) return '⚡'
  if (props.isHighDifficulty) return '💎'
  return '🌟'
})

const title = computed(() => {
  if (props.variant === 'task') return '任务完成！'
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
  if (props.variant === 'task') return 'achievement-toast--task'
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
  background: var(--toast-gradient-default);
  color: white;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  pointer-events: none;
  white-space: nowrap;
}

.achievement-toast--high-diff {
  background: var(--toast-gradient-high-diff);
}
.achievement-toast--task {
  background: var(--toast-gradient-task);
}
.achievement-toast--electric {
  background: var(--toast-gradient-electric);
}
.achievement-toast--fire {
  background: var(--toast-gradient-fire);
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
