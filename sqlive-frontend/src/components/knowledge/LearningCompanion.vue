<template>
  <div class="learning-companion" @click="$emit('open')">
    <div class="companion-ring-bg">📚</div>
    <div class="companion-info">
      <span class="companion-count">{{ count }}/{{ total }}</span>
      <span class="companion-level">{{ level }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useLocalStorage } from '@vueuse/core';
import { KNOWLEDGE_API_BASE } from '@/config';

defineEmits<{
  (e: 'open'): void;
}>();

const total = ref(0);
const masteredTopics = useLocalStorage<string[]>('ai-mastered-topics', []);

const count = computed(() => (masteredTopics.value || []).length);

const percentage = computed(() => total.value > 0 ? (count.value / total.value) * 100 : 0);

const level = computed(() => {
  if (percentage.value < 30) return '初级';
  if (percentage.value < 70) return '进阶';
  return '大师';
});

async function fetchTotal(): Promise<void> {
  try {
    const resp = await fetch(`${KNOWLEDGE_API_BASE}/graph`);
    if (!resp.ok) return;
    const data = await resp.json();
    total.value = (data.topics || []).length;
  } catch { /* non-critical */ }
}

onMounted(() => {
  void fetchTotal();
});
</script>

<style scoped>
.learning-companion {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 35;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: white;
  border: 2px solid #e2e8f0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s, box-shadow 0.2s;
}

.learning-companion:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 16px rgba(0,0,0,0.18);
}

.companion-ring-bg {
  font-size: 18px;
  line-height: 1;
}

.companion-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.1;
}

.companion-count {
  font-size: 10px;
  font-weight: 700;
  color: #334155;
}

.companion-level {
  font-size: 8px;
  color: #64748b;
}
</style>
