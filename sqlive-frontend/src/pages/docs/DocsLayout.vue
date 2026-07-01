<template>
  <div class="flex h-full min-h-0">
    <!-- Desktop sidebar: CSS-driven visibility (W6 fix — visible ≥768px via
         md:flex, hidden below 768px via hidden; NOT v-if conditional render).
         AppHeader is NOT rendered here — RootLayout already provides it. -->
    <DocsSidebar class="hidden md:flex w-[240px] flex-shrink-0 border-r border-border bg-sidebar" />

    <!-- Mobile drawer: Reka-ui Dialog (D-12). Trigger visible only below 768px
         via md:hidden. Drawer auto-closes on navigate (@navigate handler). -->
    <Dialog v-model:open="drawerOpen">
      <DialogTrigger as-child>
        <button
          class="md:hidden fixed bottom-4 right-4 z-40 size-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center"
          data-testid="mobile-menu-btn"
          aria-label="打开文档导航"
          :aria-expanded="drawerOpen"
        >
          <Menu class="size-5" />
        </button>
      </DialogTrigger>
      <DialogContent
        class="fixed left-0 top-0 h-full w-[240px] max-w-none translate-x-0 translate-y-0 rounded-none rounded-r-lg p-0 gap-0 border-r bg-card"
        :show-close-button="false"
      >
        <DocsSidebar @navigate="handleDrawerNavigate" />
      </DialogContent>
    </Dialog>

    <main class="flex-1 min-w-0 overflow-auto bg-background">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import {ref, watch, nextTick} from 'vue'
import {useRoute} from 'vue-router'
import {useMediaQuery} from '@vueuse/core'
import {Menu} from 'lucide-vue-next'
import DocsSidebar from '@/components/docs/DocsSidebar.vue'
import {Dialog, DialogTrigger, DialogContent} from '@/components/ui/dialog'

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
  {immediate: true},
)
</script>
