<script setup lang="ts">
import { ChevronDownIcon, LoaderIcon } from '@lucide/vue'
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'

import { CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

import { Shimmer } from '../shimmer'
import { useReasoningContext } from './context'

interface Props {
    class?: HTMLAttributes['class']
    /** Reasoning content for extracting the current thinking topic title */
    reasoning?: string
}

const props = defineProps<Props>()

const { isStreaming, isOpen, duration } = useReasoningContext()

const thinkingMessage = computed(() => {
    if (isStreaming.value || duration.value === 0) {
        return 'thinking'
    }
    if (duration.value === undefined) {
        return 'default_done'
    }
    return 'duration_done'
})

const thinkingTitle = computed(() => {
    if (!props.reasoning) return ''
    const clean = props.reasoning
    const lines = clean.split('\n').filter((l) => l.trim())
    if (lines.length === 0) return ''
    const meaningful = lines.filter((l) => l.replace(/^[\d*.•\- ]+/u, '').trim().length > 3)
    return (
        meaningful
            .pop()
            ?.replace(/^[\d*.•\- ]+/u, '')
            .trim()
            .slice(0, 80) || ''
    )
})
</script>

<template>
    <CollapsibleTrigger
        :class="
            cn(
                'flex w-full items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground',
                props.class
            )
        "
    >
        <slot>
            <template v-if="thinkingMessage === 'thinking'">
                <LoaderIcon class="size-3.5 shrink-0 animate-spin text-primary" />
                <Shimmer :duration="1" class="shrink-0"> Thinking... </Shimmer>
                <ChevronDownIcon
                    :class="
                        cn(
                            'size-4 shrink-0 transition-transform',
                            isOpen ? 'rotate-180' : 'rotate-0'
                        )
                    "
                />
                <span
                    v-if="thinkingTitle"
                    class="mr-2 max-w-[70%] truncate text-xs text-muted-foreground/50 italic"
                    :title="thinkingTitle"
                    >{{ thinkingTitle }}</span
                >
            </template>

            <template v-else-if="thinkingMessage === 'default_done'">
                <p>Thought for a few seconds</p>
                <ChevronDownIcon
                    :class="
                        cn(
                            'size-4 shrink-0 transition-transform',
                            isOpen ? 'rotate-180' : 'rotate-0'
                        )
                    "
                />
            </template>

            <template v-else>
                <p>Thought for {{ duration }}{{ duration === 1 ? ' second' : ' seconds' }}</p>
                <ChevronDownIcon
                    :class="
                        cn(
                            'size-4 shrink-0 transition-transform',
                            isOpen ? 'rotate-180' : 'rotate-0'
                        )
                    "
                />
            </template>
        </slot>
        <slot v-if="!isOpen" name="preview" />
    </CollapsibleTrigger>
</template>
