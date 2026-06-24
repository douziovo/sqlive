<template>
  <select
    v-model="selectedTopicId"
    class="task-topic-selector"
    @change="handleChange"
  >
    <option value="" disabled>选择知识点...</option>
    <option
      v-for="topic in topics"
      :key="topic.id"
      :value="topic.id"
    >
      {{ topic.label }}
    </option>
  </select>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { KnowledgeTopic } from '@/composables/useKnowledgeGraph'

const props = defineProps<{
  topics: KnowledgeTopic[]
  modelValue?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', topicId: string): void
}>()

const selectedTopicId = ref(props.modelValue ?? '')

watch(() => props.modelValue, (val) => {
  selectedTopicId.value = val ?? ''
})

function handleChange(): void {
  emit('update:modelValue', selectedTopicId.value)
}
</script>

<style scoped>
.task-topic-selector {
  font-size: 13px;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px 8px;
  background: var(--muted);
  color: var(--foreground);
  width: 100%;
  min-width: 160px;
  cursor: pointer;
}

.task-topic-selector:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 1px var(--primary);
}
</style>
