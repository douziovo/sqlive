<template>
  <header class="h-12 flex items-center justify-between px-4 border-b border-border bg-sidebar">
    <button
      class="text-xl font-semibold text-foreground hover:text-primary transition-colors"
      @click="handleWordmarkClick"
    >
      sqlive
    </button>
    <div class="flex items-center gap-2">
      <button
        data-testid="docs-link-btn"
        @click="handleDocsClick"
        class="px-2 py-1 text-sm font-semibold rounded transition-colors"
        :class="isDocsRoute
          ? 'bg-primary/10 text-primary border border-primary/20'
          : 'bg-primary text-primary-foreground hover:bg-primary/90'"
      >
        文档
      </button>
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
        <span class="hidden md:inline">GitHub</span>
      </a>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

// D-05 active highlight: Docs button shows muted "you are here" on /docs/* routes.
const isDocsRoute = computed(() => route.path.startsWith('/docs'))

// Handler functions (NOT inline @click="$emit" — per CLAUDE.md <script setup> gotcha).
// router.push rejections are NavigationFailure (aborted/duplicated/cancelled) —
// silent per design spec §4.6.
function handleDocsClick() {
  router.push('/docs/intro').catch(() => {})
}

function handleWordmarkClick() {
  router.push('/').catch(() => {})
}
</script>
