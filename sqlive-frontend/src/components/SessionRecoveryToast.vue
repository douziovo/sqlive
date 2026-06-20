<template>
  <Teleport to="body">
    <Transition name="toast-pop">
      <div v-if="visible" class="session-recovery-toast">
        <span class="toast-icon">&#9888;</span>
        <span class="toast-message">会话已恢复</span>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { watch, onUnmounted } from 'vue'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

let timer: ReturnType<typeof setTimeout> | null = null

watch(
  () => props.visible,
  (isVisible) => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    if (isVisible) {
      timer = setTimeout(() => {
        emit('close')
      }, 3000)
    }
  }
)

onUnmounted(() => {
  if (timer !== null) {
    clearTimeout(timer)
  }
})
</script>

<style scoped>
.session-recovery-toast {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 160;
  display: flex;
  flex-direction: row;
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

.toast-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.toast-message {
  font-weight: 600;
  font-size: 13px;
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
