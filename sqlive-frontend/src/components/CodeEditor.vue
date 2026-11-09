<template>
    <div
        class="relative flex h-full flex-col bg-muted px-3 pt-6 pb-3"
        @dragover.prevent="dragOver = true"
        @dragleave="dragOver = false"
        @drop.prevent="onDrop"
    >
        <div class="mb-3 flex items-center justify-between">
            <h2 class="flex items-center gap-2 text-xl font-bold text-foreground">
                <span> </span> SQL 编辑器
            </h2>
            <div class="flex items-center gap-2">
                <!-- DB selector -->
                <div class="flex items-center gap-1">
                    <select
                        :value="activeDbName"
                        @change="
                            emit(
                                'set-db-name',
                                activeTabId,
                                ($event.target as HTMLSelectElement).value
                            )
                        "
                        class="cursor-pointer rounded border border-border bg-card px-2 py-1 text-xs font-medium text-black outline-none hover:border-primary/60"
                    >
                        <option value="">实时模式</option>
                        <option v-for="name in dbList" :key="name" :value="name">{{ name }}</option>
                    </select>
                    <button
                        v-if="activeDbName"
                        @click="confirmDeleteDb"
                        class="px-1 text-sm text-muted-foreground/70 transition-colors hover:text-destructive"
                        title="删除数据库"
                    >
                        &#x1F5D1;
                    </button>
                </div>
                <!-- Submit button -->
                <button
                    @click="handleSubmit"
                    class="flex items-center gap-1 rounded bg-primary px-3 py-1 text-xs font-medium text-white shadow-sm transition-colors hover:bg-primary/90"
                    title="提交到数据库 (Ctrl+Shift+T)"
                >
                    提交
                </button>
                <!-- AI toggle button -->
                <button
                    v-if="ai"
                    data-testid="ai-toggle-btn"
                    @click="ai.onTogglePanel()"
                    class="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium shadow-sm transition-colors"
                    :class="
                        ai.isLoading.value
                            ? 'animate-pulse bg-primary text-primary-foreground'
                            : 'border border-primary/20 bg-linear-to-r from-primary/10 to-primary/5 text-primary hover:bg-primary/10'
                    "
                    title="AI 助手 (Alt+Enter QuickFix)"
                >
                    <span
                        v-if="ai.isLoading.value"
                        class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent"
                    ></span>
                    <span v-else>AI助手</span>
                </button>
            </div>
        </div>

        <!-- Hidden file input for import (triggered via context menu) -->
        <input
            ref="fileInput"
            type="file"
            accept=".sql,.txt"
            class="hidden"
            @change="onFileInput"
        />

        <!-- Tab bar -->
        <div class="mb-1 flex items-center gap-1">
            <!-- Tab search button -->
            <div class="relative shrink-0">
                <button
                    @click.stop="showTabSearch = !showTabSearch"
                    class="rounded px-2 py-2 text-xs text-muted-foreground/70 transition-colors hover:bg-secondary hover:text-primary"
                    title="搜索标签页"
                >
                    &#x25BC;
                </button>
                <!-- Search dropdown -->
                <div
                    v-if="showTabSearch"
                    class="absolute top-full left-0 z-40 mt-1 w-64 rounded-md border border-border bg-card shadow-lg"
                >
                    <div class="border-b border-border p-2">
                        <input
                            ref="tabSearchInput"
                            v-model="tabSearchText"
                            type="text"
                            placeholder="搜索标签页..."
                            class="w-full rounded-lg border border-border px-2 py-1 text-xs outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                            @keydown.esc="showTabSearch = false"
                            @keydown.enter="switchToFirstMatch"
                        />
                    </div>
                    <div class="max-h-48 overflow-y-auto">
                        <div
                            v-for="tab in filteredTabs"
                            :key="tab.id"
                            @click="switchToTab(tab.id)"
                            class="flex cursor-pointer items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-primary/10"
                            :class="{ 'bg-primary/10 text-primary': tab.id === activeTabId }"
                        >
                            <span class="truncate">
                                <span v-html="highlightTabName(tab.name)"></span>
                                <span
                                    v-if="tab.dbName"
                                    class="ml-1 text-[10px] text-muted-foreground/70"
                                    >· {{ tab.dbName }}</span
                                >
                            </span>
                            <button
                                v-if="tabs.length > 1"
                                @click.stop="emit('close-tab', tab.id)"
                                class="ml-2 shrink-0 text-sm leading-none text-muted-foreground/50 hover:text-muted-foreground"
                            >
                                &#x2715;
                            </button>
                        </div>
                        <div
                            v-if="filteredTabs.length === 0"
                            class="px-3 py-3 text-center text-xs text-muted-foreground/70"
                        >
                            无匹配标签页
                        </div>
                    </div>
                </div>
            </div>

            <!-- Tabs -->
            <div class="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
                <div
                    v-for="tab in tabs"
                    :key="tab.id"
                    @click.stop="emit('switch-tab', tab.id)"
                    class="group flex shrink cursor-pointer items-center gap-1 rounded-t-md border-b-[3px] px-2 py-2 text-xs transition-colors"
                    style="min-width: 52px; max-width: 180px"
                    :class="
                        tab.id === activeTabId
                            ? 'shrink-0 border-primary bg-card font-medium text-primary'
                            : 'border-transparent text-muted-foreground hover:bg-secondary hover:text-secondary-foreground'
                    "
                    :title="tab.name + (tab.dbName ? ' · ' + tab.dbName : '')"
                >
                    <span class="min-w-[1ch] truncate leading-none">{{ tab.name }}</span>
                    <span
                        v-if="tab.dbName"
                        class="hidden shrink-0 rounded-full bg-secondary px-1 text-[9px] text-muted-foreground/50 sm:inline"
                        >{{ tab.dbName }}</span
                    >
                    <button
                        v-if="tabs.length > 1"
                        data-testid="tab-close-btn"
                        @click.stop="emit('close-tab', tab.id)"
                        :class="
                            tab.id === activeTabId
                                ? 'text-muted-foreground hover:text-secondary-foreground'
                                : 'text-muted-foreground/70 opacity-0 group-hover:opacity-100 hover:text-muted-foreground'
                        "
                        class="shrink-0 px-1 text-sm leading-none font-bold transition-opacity"
                    >
                        &#x2715;
                    </button>
                </div>
                <button
                    @click="emit('add-tab')"
                    class="shrink-0 rounded px-2 py-1 text-xs text-muted-foreground/70 transition-colors hover:bg-secondary hover:text-primary"
                    title="新建标签页"
                >
                    &#x2795;
                </button>
            </div>
        </div>

        <!-- Click-outside overlay for tab search -->
        <div v-if="showTabSearch" class="fixed inset-0 z-30" @click="showTabSearch = false"></div>

        <div class="relative flex w-full flex-1 flex-col">
            <div ref="editorContainer" class="min-h-0 flex-1"></div>
        </div>

        <!-- Drop overlay -->
        <div
            v-if="dragOver"
            class="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-lg border-2 border-dashed border-primary/60 bg-primary/10"
        >
            <div class="rounded-lg bg-card px-6 py-4 text-center shadow-lg">
                <div class="mb-2 text-3xl">&#x1F4E5;</div>
                <p class="text-sm text-muted-foreground">释放以导入 .sql 文件</p>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useMonacoEditor } from '../composables/useMonacoEditor'
import { AI_ACTIONS_KEY, SQL_CONTEXT_KEY } from '../model/injectionKeys'
import { highlightMatch } from '../utils/html'

const props = defineProps<{
    code: string
}>()

const emit = defineEmits<{
    'update:code': [value: string]
    'switch-tab': [id: string]
    'add-tab': []
    'close-tab': [id: string]
    'set-db-name': [id: string, dbName: string]
    'delete-db': [dbName: string]
    submit: []
    'import-file': [file: File]
    'export-tab': []
    'export-all': []
}>()

const ctx = inject(SQL_CONTEXT_KEY)!
const { tabs, activeTabId, activeDbName, dbList, highlightChunk, error } = ctx
const ai = inject(AI_ACTIONS_KEY)!

const editorContainer = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const dragOver = ref(false)
const showTabSearch = ref(false)
const tabSearchText = ref('')
const tabSearchInput = ref<HTMLInputElement | null>(null)

const { create, syncCode, dispose } = useMonacoEditor(
    editorContainer,
    emit,
    { highlightChunk, error, ai },
    () => fileInput.value?.click()
)

onMounted(() => {
    create(props.code)
    watch(
        () => props.code,
        (newVal) => syncCode(newVal)
    )
})

onBeforeUnmount(() => {
    dispose()
})

// --- File import ---
function onFileInput(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (file) emit('import-file', file)
    input.value = ''
}

function onDrop(e: DragEvent) {
    dragOver.value = false
    const file = e.dataTransfer?.files?.[0]
    if (file && (file.name.endsWith('.sql') || file.name.endsWith('.txt'))) {
        emit('import-file', file)
    }
}

// --- Tab search ---
const filteredTabs = computed(() => {
    const q = tabSearchText.value.trim().toLowerCase()
    if (!q) return tabs.value
    return tabs.value.filter((t) => t.name.toLowerCase().includes(q))
})

function switchToTab(id: string) {
    emit('switch-tab', id)
    showTabSearch.value = false
    tabSearchText.value = ''
}

function switchToFirstMatch() {
    if (filteredTabs.value.length > 0) {
        switchToTab(filteredTabs.value[0].id)
    }
}

function highlightTabName(name: string): string {
    return highlightMatch(name, tabSearchText.value.trim())
}

watch(showTabSearch, (val) => {
    if (val) {
        tabSearchText.value = ''
        nextTick(() => tabSearchInput.value?.focus())
    }
})

// --- Rename ---

function handleSubmit() {
    let dbName: string | null = activeDbName.value
    if (!dbName) {
        dbName = prompt('输入数据库名称以保存当前状态:')
        if (!dbName?.trim()) return
        dbName = dbName.trim()
        if (!/^[a-zA-Z0-9_-]{1,64}$/.test(dbName)) {
            alert('数据库名称只能包含字母、数字、下划线和连字符，长度 1-64 个字符')
            return
        }
        emit('set-db-name', activeTabId.value, dbName)
    }
    emit('submit')
}

function confirmDeleteDb() {
    const name = activeDbName.value
    if (!name) return
    if (confirm(`确定删除数据库 "${name}"？\n所有关联标签页将切换回实时模式。`)) {
        emit('delete-db', name)
    }
}
</script>

<style scoped>
/* Referenced at runtime via Monaco decoration inlineClassName (useMonacoEditor.ts). */
/* noinspection CssUnusedSymbol */
:deep(.flash-highlight) {
    background-color: rgba(202, 138, 4, 0.6);
    border-radius: 2px;
}
</style>
