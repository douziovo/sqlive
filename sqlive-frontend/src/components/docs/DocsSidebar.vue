<template>
    <nav
        class="flex w-[240px] shrink-0 flex-col border-r border-border bg-sidebar"
        aria-label="文档导航"
    >
        <div class="border-b border-border p-2">
            <DocsSearchBox />
        </div>
        <div class="flex-1 space-y-4 overflow-auto p-2">
            <ul v-for="group in groupedNav" :key="group.category" class="space-y-0.5">
                <li
                    class="px-3 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                >
                    {{ group.label }}
                </li>
                <li v-for="item in group.items" :key="item.slug">
                    <button
                        :data-testid="`nav-${item.slug.replace('/', '-')}`"
                        @click="handleNavigate(item.path)"
                        :class="[
                            'w-full rounded-md px-3 py-2 text-left text-sm transition-colors',
                            route.path === item.path
                                ? 'bg-primary/10 font-semibold text-primary'
                                : 'text-foreground hover:bg-secondary'
                        ]"
                        :aria-current="route.path === item.path ? 'page' : undefined"
                    >
                        {{ item.title }}
                    </button>
                </li>
            </ul>
        </div>
    </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { navigation, type NavCategory } from '@/content/docs/navigation'

import DocsSearchBox from './DocsSearchBox.vue'

// D-05: data-driven sidebar. Adding an article = drop .md + add navigation.ts entry.
// Category labels for sidebar grouping (Chinese display).
const categoryLabels: Record<NavCategory, string> = {
    intro: '项目介绍',
    usage: '使用手册',
    api: 'API 文档',
    changelog: '变更日志'
}

// Stable display order; categories with no items are filtered out.
const categoryOrder: NavCategory[] = ['intro', 'usage', 'api', 'changelog']

const groupedNav = computed(() =>
    categoryOrder
        .map((cat) => ({
            category: cat,
            label: categoryLabels[cat],
            items: navigation.filter((item) => item.category === cat)
        }))
        .filter((group) => group.items.length > 0)
)

const route = useRoute()
const router = useRouter()

const emit = defineEmits<{ navigate: [path: string] }>()

// Handler function (NOT inline @click="$emit" — per CLAUDE.md <script setup> gotcha).
// vue-router 的 NavigationFailureType 中该值官方拼写即为 cancelled，此处指代该 API 值，保留原词
//noinspection GrazieStyle
// NavigationFailure silenced per Pitfall 6 (aborted/duplicated/cancelled are normal).
function handleNavigate(path: string) {
    router.push(path).catch(() => {})
    emit('navigate', path)
}
</script>
