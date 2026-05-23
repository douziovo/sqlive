<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SuggestionProps {
  suggestion: string
  class?: HTMLAttributes['class']
  variant?: 'outline' | 'default' | 'destructive' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

const props = withDefaults(defineProps<SuggestionProps>(), {
  variant: 'outline',
  size: 'sm',
})

const emit = defineEmits<{
  (e: 'click', suggestion: string): void
}>()

function handleClick() {
  emit('click', props.suggestion)
}
</script>

<template>
  <Button
    :class="cn('cursor-pointer rounded-full px-4 min-w-0', props.class)"
    :size="props.size"
    type="button"
    :variant="props.variant"
    v-bind="$attrs"
    @click="handleClick"
  >
    <span class="truncate"><slot>{{ props.suggestion }}</slot></span>
  </Button>
</template>
