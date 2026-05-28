<template>
  <div class="flex flex-col items-center justify-center h-40 border-2 border-dashed border-border rounded-lg text-muted-foreground/70 bg-card">
    <div class="text-3xl mb-1 w-14 h-14 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center shadow-sm">{{ icon }}</div>
    <p class="text-sm">{{ title }}</p>
    <p v-if="subtitle" class="text-xs text-muted-foreground/50 mt-1">{{ subtitle }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  icon: string
  title: string
  subtitle?: string
}>()
</script>
