<template>
    <div class="flex h-full min-h-0">
        <!-- Desktop sidebar: CSS-driven visibility (W6 fix — visible ≥768px via
         md:flex, hidden below 768px via hidden; NOT v-if conditional render).
         AppHeader is NOT rendered here — RootLayout already provides it. -->
        <DocsSidebar class="hidden w-[240px] shrink-0 border-r border-border bg-sidebar md:flex" />

        <!-- Mobile drawer: Reka-ui Dialog (D-12). Trigger visible only below 768px
         via md:hidden. Drawer auto-closes on navigate (@navigate handler). -->
        <Dialog v-model:open="drawerOpen">
            <DialogTrigger as-child>
                <button
                    class="fixed right-4 bottom-4 z-40 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg md:hidden"
                    data-testid="mobile-menu-btn"
                    aria-label="打开文档导航"
                    :aria-expanded="drawerOpen"
                >
                    <Menu class="size-5" />
                </button>
            </DialogTrigger>
            <DialogContent
                class="fixed top-0 left-0 h-full w-[240px] max-w-none translate-x-0 translate-y-0 gap-0 rounded-none rounded-r-lg border-r bg-card p-0"
                :show-close-button="false"
            >
                <DocsSidebar @navigate="handleDrawerNavigate" />
            </DialogContent>
        </Dialog>

        <main class="min-w-0 flex-1 overflow-auto bg-background">
            <!-- router-view 是 Vue Router 的内置组件而非 HTML 标签，非错误 -->
            <!--suppress HtmlUnknownTag -->
            <router-view />
        </main>
    </div>
</template>

<script setup lang="ts">
import { Menu } from '@lucide/vue'
import { useMediaQuery } from '@vueuse/core'
import { ref, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'

import DocsSidebar from '@/components/docs/DocsSidebar.vue'
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog'

// D-12 responsive: isMobile is used ONLY for drawer auto-reset on resize
// (when viewport grows from mobile to desktop, close any stale drawer state).
// Desktop sidebar / hamburger button visibility is CSS-driven (md:flex / md:hidden).
const isMobile = useMediaQuery('(max-width: 767px)')
const drawerOpen = ref(false)

function handleDrawerNavigate() {
    drawerOpen.value = false
}

watch(isMobile, (m) => {
    if (!m) drawerOpen.value = false
})

const route = useRoute()

// D-12: document.title per route — '{H1} · sqlive docs' or 'sqlive docs' fallback.
// Reads H1 from rendered DOM (after nextTick so ArticlePage + MarkdownRenderer
// have flushed v-html). Falls back when no article H1 (e.g. ApiPage, NotFoundPage).
watch(
    () => route.path,
    async () => {
        await nextTick()
        const h1 = document.querySelector('article h1')?.textContent
        document.title = h1 ? `${h1} · sqlive docs` : 'sqlive docs'
    },
    { immediate: true }
)
</script>
