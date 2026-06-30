<template>
  <div class="h-full flex flex-col bg-muted pt-6 px-3 pb-3 relative"
       @dragover.prevent="dragOver = true"
       @dragleave="dragOver = false"
       @drop.prevent="onDrop">
    <div class="flex items-center justify-between mb-3">
      <h2 class="text-xl font-bold text-foreground flex items-center gap-2">
        <span>  </span> SQL 编辑器
      </h2>
      <div class="flex items-center gap-2">
        <!-- DB selector -->
        <div class="flex items-center gap-1">
          <select
            :value="activeDbName"
            @change="emit('set-db-name', activeTabId, ($event.target as HTMLSelectElement).value)"
            class="text-xs font-medium border border-border rounded px-2 py-1 bg-card text-black outline-none cursor-pointer hover:border-primary/60"
          >
            <option value="">实时模式</option>
            <option v-for="name in dbList" :key="name" :value="name">{{ name }}</option>
          </select>
          <button
            v-if="activeDbName"
            @click="confirmDeleteDb"
            class="text-muted-foreground/70 hover:text-destructive text-sm px-1 transition-colors"
            title="删除数据库"
          >&#x1F5D1;</button>
        </div>
        <!-- Submit button -->
        <button
          @click="handleSubmit"
          class="flex items-center gap-1 px-3 py-1 text-xs font-medium bg-primary text-white rounded hover:bg-primary/90 transition-colors shadow-sm"
          title="提交到数据库 (Ctrl+Shift+T)"
        >
          提交
        </button>
        <!-- AI toggle button -->
        <button
          v-if="ai"
          data-testid="ai-toggle-btn"
          @click="ai.onTogglePanel()"
          class="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors shadow-sm"
          :class="ai.isLoading.value ? 'bg-primary text-primary-foreground animate-pulse' : 'bg-gradient-to-r from-primary/10 to-primary/5 text-primary border border-primary/20 hover:bg-primary/10'"
          title="AI 助手 (Alt+Enter QuickFix)"
        >
          <span v-if="ai.isLoading.value" class="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          <span v-else>AI助手</span>
        </button>
        <!-- GitHub repo link -->
        <a
          href="https://github.com/douziovo/sqlive"
          target="_blank"
          rel="noopener noreferrer"
          data-testid="github-link"
          class="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors shadow-sm bg-card border border-border text-muted-foreground hover:text-primary hover:border-primary/40"
          title="GitHub 仓库"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 .5C5.37.5 0 5.78 0 12.292c0 5.211 3.438 9.63 8.205 11.187.6.111.82-.254.82-.567 0-.28-.013-1.026-.02-2.013-3.338.711-4.043-1.582-4.043-1.582-.546-1.361-1.335-1.725-1.335-1.725-1.091-.737.083-.722.083-.722 1.205.083 1.838 1.215 1.838 1.215 1.07 1.806 2.808 1.284 3.493.982.108-.763.419-1.285.762-1.581-2.665-.3-5.467-1.316-5.467-5.854 0-1.293.467-2.351 1.236-3.184-.124-.3-.535-1.509.118-3.144 0 0 1.008-.322 3.3 1.215a11.5 11.5 0 0 1 3-.399c1.02.005 2.045.135 3.003.399 2.291-1.537 3.297-1.215 3.297-1.215.654 1.635.243 2.844.12 3.144.77.833 1.234 1.891 1.234 3.184 0 4.555-2.806 5.55-5.48 5.844.43.366.823 1.096.823 2.212 0 1.598-.014 2.885-.014 3.275 0 .315.216.682.825.565C20.565 21.917 24 17.5 24 12.292 24 5.78 18.627.5 12 .5z"/>
          </svg>
          GitHub
        </a>
      </div>
    </div>

    <!-- Hidden file input for import (triggered via context menu) -->
    <input ref="fileInput" type="file" accept=".sql,.txt" class="hidden" @change="onFileInput" />

    <!-- Tab bar -->
    <div class="flex items-center gap-1 mb-1">
      <!-- Tab search button -->
      <div class="relative flex-shrink-0">
        <button
          @click.stop="showTabSearch = !showTabSearch"
          class="px-2 py-2 text-xs text-muted-foreground/70 hover:text-primary hover:bg-secondary rounded transition-colors"
          title="搜索标签页"
        >&#x25BC;</button>
        <!-- Search dropdown -->
        <div v-if="showTabSearch" class="absolute left-0 top-full mt-1 bg-card border border-border rounded-md shadow-lg z-40 w-64">
          <div class="p-2 border-b border-border">
            <input
              ref="tabSearchInput"
              v-model="tabSearchText"
              type="text"
              placeholder="搜索标签页..."
              class="w-full text-xs border border-border rounded-lg px-2 py-1 outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              @keydown.escape="showTabSearch = false"
              @keydown.enter="switchToFirstMatch"
            />
          </div>
          <div class="max-h-48 overflow-y-auto">
            <div
              v-for="tab in filteredTabs"
              :key="tab.id"
              @click="switchToTab(tab.id)"
              class="flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-primary/10 transition-colors"
              :class="{ 'bg-primary/10 text-primary': tab.id === activeTabId }"
            >
              <span class="truncate">
                <span v-html="highlightTabName(tab.name)"></span>
                <span v-if="tab.dbName" class="text-[10px] text-muted-foreground/70 ml-1">· {{ tab.dbName }}</span>
              </span>
              <button
                v-if="tabs.length > 1"
                @click.stop="emit('close-tab', tab.id)"
                class="text-muted-foreground/50 hover:text-muted-foreground text-sm leading-none ml-2 flex-shrink-0"
              >&#x2715;</button>
            </div>
            <div v-if="filteredTabs.length === 0" class="px-3 py-3 text-xs text-muted-foreground/70 text-center">
              无匹配标签页
            </div>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex items-center gap-1 overflow-x-auto flex-1 min-w-0">
        <div v-for="tab in tabs" :key="tab.id"
             @click.stop="emit('switch-tab', tab.id)"
             class="group flex items-center gap-1 px-2 py-2 text-xs rounded-t-md cursor-pointer transition-colors border-b-[3px] flex-shrink"
             style="min-width: 52px; max-width: 180px;"
             :class="tab.id === activeTabId
               ? 'bg-card text-primary border-primary font-medium flex-shrink-0'
               : 'text-muted-foreground border-transparent hover:bg-secondary hover:text-secondary-foreground'"
             :title="tab.name + (tab.dbName ? ' · ' + tab.dbName : '')">
          <span class="truncate leading-none min-w-[1ch]">{{ tab.name }}</span>
          <span
            v-if="tab.dbName"
            class="text-[9px] text-muted-foreground/50 bg-secondary rounded-full px-1 flex-shrink-0 hidden sm:inline"
          >{{ tab.dbName }}</span>
          <button
            v-if="tabs.length > 1"
            data-testid="tab-close-btn"
            @click.stop="emit('close-tab', tab.id)"
            :class="tab.id === activeTabId
              ? 'text-muted-foreground hover:text-secondary-foreground'
              : 'text-muted-foreground/70 hover:text-muted-foreground opacity-0 group-hover:opacity-100'"
            class="transition-opacity text-sm leading-none px-1 font-bold flex-shrink-0">
            &#x2715;
          </button>
        </div>
        <button @click="emit('add-tab')"
                class="px-2 py-1 text-xs text-muted-foreground/70 hover:text-primary hover:bg-secondary rounded transition-colors flex-shrink-0" title="新建标签页">
          &#x2795;
        </button>
      </div>
    </div>

    <!-- Click-outside overlay for tab search -->
    <div v-if="showTabSearch" class="fixed inset-0 z-30" @click="showTabSearch = false"></div>

    <div class="flex-1 relative w-full flex flex-col">
      <div ref="editorContainer" class="flex-1 min-h-0"></div>
    </div>

    <!-- Drop overlay -->
    <div v-if="dragOver"
         class="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary/60 rounded-lg z-20 flex items-center justify-center pointer-events-none">
      <div class="bg-card rounded-lg shadow-lg px-6 py-4 text-center">
        <div class="text-3xl mb-2">&#x1F4E5;</div>
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

const { create, formatSql, syncCode, dispose } = useMonacoEditor(
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
:deep(.flash-highlight) {
  background-color: rgba(202, 138, 4, 0.6);
  border-radius: 2px;
}
</style>
