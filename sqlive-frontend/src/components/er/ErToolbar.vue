<template>
  <div class="er-toolbar">
    <button
      class="er-toolbar-btn"
      title="自动布局"
      @click="$emit('auto-layout')"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
      </svg>
    </button>
    <button
      class="er-toolbar-btn"
      title="适应视图"
      @click="$emit('fit-view')"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
      </svg>
    </button>
    <button
      class="er-toolbar-btn"
      :class="{ 'er-toolbar-btn-active': showMinimap }"
      title="切换小地图"
      @click="$emit('toggle-minimap')"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  showMinimap: boolean;
}>();

defineEmits<{
  (e: 'auto-layout'): void;
  (e: 'fit-view'): void;
  (e: 'toggle-minimap'): void;
}>();
</script>

<style scoped>
.er-toolbar {
  position: absolute;
  bottom: 8px;
  left: 8px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--card);
  border-color: var(--border);
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}
.er-toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--muted-foreground);
  cursor: pointer;
  transition: color 0.15s, background-color 0.15s, border-color 0.15s;
}
.er-toolbar-btn:hover {
  background: var(--muted);
  color: var(--primary);
}
.er-toolbar-btn-active {
  background: var(--primary) / 0.1;
  color: var(--primary);
}
</style>
