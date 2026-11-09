<template>
    <!-- Ghost row -->
    <tr
        data-testid="ghost-row"
        class="group/ghost border-t border-dashed border-border bg-muted/50 opacity-0 transition-opacity duration-200 focus-within:opacity-100 hover:opacity-100"
        :class="{ 'ghost-failure': ghostFailureVisible }"
    >
        <td
            v-for="col in table.columns"
            :key="'ghost-' + col"
            class="border-r border-border/50 px-4 py-2 align-top"
        >
            <div class="relative grid w-full place-items-start">
                <div
                    data-ghost
                    class="invisible min-h-[1.5em] border border-transparent px-1 py-1 break-all whitespace-pre-wrap"
                    style="grid-area: 1/1/2/2"
                >
                    {{ getGhostValue(col) || ' ' }}
                </div>
                <textarea
                    :value="getGhostValue(col)"
                    @input="
                        (e) => {
                            autoResizeGhost(e)
                            updateGhostState(col, (e.target as HTMLTextAreaElement).value)
                        }
                    "
                    @keydown.enter.prevent="onGhostSubmit()"
                    placeholder="+"
                    class="absolute inset-0 z-10 h-full w-full resize-none overflow-hidden border-b border-transparent bg-transparent px-1 py-1 break-all whitespace-pre-wrap text-secondary-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary focus:bg-background"
                    style="grid-area: 1/1/2/2"
                    spellcheck="false"
                ></textarea>
            </div>
        </td>
        <td class="px-2 text-center align-middle">
            <button
                v-if="hasGhostInput()"
                @click="onGhostSubmit()"
                class="rounded-full p-1 text-primary transition-colors transition-transform hover:scale-110 hover:bg-primary/10"
                title="确认添加"
            >
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M5 13l4 4L19 7"
                    ></path>
                </svg>
            </button>
        </td>
    </tr>
    <!-- Ghost row error -->
    <tr v-if="ghostFailureVisible" class="ghost-error-row">
        <td :colspan="table.columns.length + 1" class="px-4 py-2">
            <p class="mt-1 text-xs text-destructive">{{ ghostErrorText }}</p>
        </td>
    </tr>
</template>

<script setup lang="ts">
import { inject, onUnmounted, reactive, ref, watch } from 'vue'

import { useInlineEdit } from '@/composables/useInlineEdit'
import type { Row, RowInsertEvent, TableSchema } from '@/model/DatabaseTypes'
import { SQL_CONTEXT_KEY } from '@/model/injectionKeys'

const props = defineProps<{
    table: TableSchema
}>()

const emit = defineEmits<{
    'insert-row': [event: RowInsertEvent]
}>()

const { insertResult } = inject(SQL_CONTEXT_KEY)!

// The ghost row never emits update-cell, so autoResizeGhost is used with a no-op emitter
const { autoResizeGhost } = useInlineEdit(props.table.name, props.table.columnTypes, () => {})

const ghostFailureVisible = ref(false)
const ghostErrorText = ref('')
let ghostFailureTimer: ReturnType<typeof setTimeout> | null = null

// Ghost row insert result handling
watch(
    () => insertResult?.value,
    (result) => {
        if (!result) return
        // Only act on results for THIS table (prevents cross-table race condition per Pitfall 3)
        if (result.tableName !== props.table.name) return

        if (result.success) {
            // Clear ghost row on success
            Object.keys(ghostRow).forEach((k) => delete ghostRow[k])
        } else {
            // Show failure styling on the ghost row
            ghostFailureVisible.value = true
            ghostErrorText.value = result.error
                ? `插入失败: ${result.error}`
                : '插入失败，请修正数据后重试'

            // Auto-dismiss after 3 seconds (unless user starts typing)
            if (ghostFailureTimer) clearTimeout(ghostFailureTimer)
            ghostFailureTimer = setTimeout(() => {
                ghostFailureVisible.value = false
            }, 3000)
        }

        // Reset insertResult so the same result isn't consumed twice
        insertResult.value = null
    }
)

const ghostRow = reactive<Row>({})

const getGhostValue = (col: string): string => String(ghostRow[col] ?? '')
const onGhostInputDismiss = () => {
    if (ghostFailureVisible.value) {
        ghostFailureVisible.value = false
        if (ghostFailureTimer) clearTimeout(ghostFailureTimer)
    }
}

const updateGhostState = (col: string, val: string) => {
    onGhostInputDismiss()
    ghostRow[col] = val
}
const hasGhostInput = () => {
    return Object.values(ghostRow).some((v) => v && String(v).trim() !== '')
}
const onGhostSubmit = () => {
    if (hasGhostInput()) {
        emit('insert-row', { tableName: props.table.name, newRow: { ...ghostRow } })
        // Do NOT clear ghostRow here — watch insertResult to decide
    }
}

onUnmounted(() => {
    if (ghostFailureTimer) clearTimeout(ghostFailureTimer)
})
</script>

<style scoped>
.ghost-failure {
    position: relative;
    border: 2px solid var(--destructive) !important;
    /* border-opacity 不是标准 CSS 属性（浏览器会忽略），删除以消除 CssUnknownProperty；边框渲染不变 */
}
.ghost-failure::after {
    content: '';
    position: absolute;
    inset: 0;
    background-color: var(--destructive);
    z-index: 5;
    animation: ghost-fade-out 1.2s ease-out forwards;
    pointer-events: none;
}
@keyframes ghost-fade-out {
    0% {
        opacity: 0.7;
    }
    100% {
        opacity: 0;
    }
}
</style>
