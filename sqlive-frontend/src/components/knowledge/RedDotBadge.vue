<template>
  <span v-if="show" class="red-dot-badge" role="status" aria-label="有新内容" />
</template>

<script setup lang="ts">
defineProps<{
  show: boolean
}>()
</script>

<style scoped>
.red-dot-badge {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  position: absolute;
  top: -2px;
  right: -6px;
  z-index: 2;
  pointer-events: none;
}
</style>
