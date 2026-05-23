<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  startTime: number;
  firstTokenTime?: number;
  endTime?: number;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}>();

const totalTime = computed(() => {
  if (!props.endTime) return null;
  return ((props.endTime - props.startTime) / 1000).toFixed(1);
});

const tps = computed(() => {
  if (!props.usage || !props.firstTokenTime || !props.endTime) return null;
  const genTime = (props.endTime - props.firstTokenTime) / 1000;
  if (genTime <= 0) return null;
  return (props.usage.completionTokens / genTime).toFixed(1);
});
</script>

<template>
  <div v-if="totalTime" class="flex items-center gap-2 text-xs mt-1 flex-wrap">
    <span class="inline-flex items-center gap-1 bg-secondary rounded-full px-2 py-1 text-muted-foreground">
      {{ tps ? tps + ' token/s' : '— token/s' }}
    </span>
    <span class="inline-flex items-center gap-1 bg-secondary rounded-full px-2 py-1 text-muted-foreground">
      {{ usage ? usage.totalTokens + ' tokens' : '— tokens' }}
    </span>
    <span class="inline-flex items-center gap-1 bg-secondary rounded-full px-2 py-1 text-muted-foreground">
      {{ totalTime }}s
    </span>
  </div>
</template>
