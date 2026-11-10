<template>
    <!-- D-13: Ctrl+K global + `/` docs-scoped + Esc closes dropdown -->
    <div class="relative">
        <Search
            class="pointer-events-none absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
            data-testid="docs-search-input"
            type="text"
            v-model="query"
            ref="inputRef"
            :disabled="indexError"
            @input="onInput"
            @focus="onInputFocus"
            :data-index-ready="indexReady ? 'true' : 'building'"
            :placeholder="indexError ? '搜索暂不可用' : '搜索文档... (Ctrl+K)'"
            :aria-label="'搜索文档'"
            class="w-full rounded-md border border-border bg-background py-2 pr-3 pl-8 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <!-- Dropdown results: shown when query produces matches -->
        <div
            v-if="results.length > 0"
            data-testid="search-results"
            class="absolute top-full right-0 left-0 z-40 mt-1 max-h-80 overflow-y-auto rounded-md border border-border bg-card shadow-lg"
        >
            <button
                v-for="result in results"
                :key="result.slug"
                @click="handleOpen(result.slug)"
                class="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-primary/10"
            >
                <span>{{ result.title }}</span>
                <span class="text-xs text-muted-foreground">{{ result.category }}</span>
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { Search } from '@lucide/vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useDocsSearch } from '@/composables/useDocsSearch'

const route = useRoute()
const router = useRouter()
const { ensureIndex, search, indexReady, indexError } = useDocsSearch()

const query = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

// Reactive results — no manual debounce needed for ~6 articles (per plan Step 2).
const results = computed(() => (query.value.trim() ? search(query.value) : []))

function onInput() {
    // results is computed reactively; no-op handler for clarity (CLAUDE.md gotcha —
    // use handler functions, not inline ref assignment in template).
}

// D-07: first focus triggers ensureIndex (lazy index build). Also triggered by
// Ctrl+K and `/` shortcuts, but @focus covers direct click/Tab focus too.
function onInputFocus() {
    void ensureIndex()
}

// Click result → navigate. NavigationFailure silenced per Pitfall 6.
function handleOpen(slug: string) {
    router.push('/docs/' + slug).catch(() => {
        // vue-router 的 NavigationFailureType 中该值官方拼写即为 cancelled，此处指代该 API 值，保留原词
        //noinspection GrazieStyle
        // NavigationFailure (aborted/duplicated/cancelled) — silent per spec §4.6
    })
    query.value = ''
    inputRef.value?.blur()
}

/**
 * Global keydown handler (D-13).
 *
 * Ctrl+K / Cmd+K: focus search input on any route (global).
 * `/`: focus search input only when route.path.startsWith('/docs') AND
 *      target is not INPUT/TEXTAREA/contenteditable (Pitfall 10 — avoids
 *      conflict with editor input).
 * Escape: blur input (closes dropdown).
 */
function handleKeydown(e: KeyboardEvent) {
    // Ctrl+K / Cmd+K — global
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        void ensureIndex()
        inputRef.value?.focus()
        return
    }

    // `/` — docs subtree only, not in inputs (Pitfall 10, T-14-12)
    if (e.key === '/' && route.path.startsWith('/docs')) {
        const target = e.target as HTMLElement
        if (!['INPUT', 'TEXTAREA'].includes(target.tagName) && !target.isContentEditable) {
            e.preventDefault()
            void ensureIndex()
            inputRef.value?.focus()
        }
        return
    }

    // Escape — blur (closes dropdown)
    if (e.key === 'Escape') {
        inputRef.value?.blur()
    }
}

onMounted(() => {
    window.addEventListener('keydown', handleKeydown)
})
onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
})
</script>
