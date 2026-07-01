<!--
  NotFoundPage.vue — 404 page with recommended articles + back-to-playground.

  Per Claude's Discretion (CONTEXT.md): recommendations = navigation.ts top 5.
  Heading "文档不存在" + body + list + CTA per UI-SPEC contract.

  CLAUDE.md gotcha: handleOpen/handleBackHome are handler functions.
  NavigationFailure silenced per Pitfall 6 (aborted/duplicated/cancelled).
-->
<template>
  <div class="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
    <h1 class="text-2xl font-semibold mb-4">文档不存在</h1>
    <p class="text-muted-foreground mb-6">请检查 URL 或从以下推荐文章选择：</p>
    <ul class="space-y-2 mb-6" data-testid="recommendation-list">
      <li v-for="item in recommendations" :key="item.slug">
        <button
          @click="handleOpen(item.path)"
          class="text-primary hover:underline"
        >{{ item.title }}</button>
      </li>
    </ul>
    <button
      @click="handleBackHome"
      class="bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-semibold hover:bg-primary/90"
    >返回主玩法</button>
  </div>
</template>

<script setup lang="ts">
import {useRouter} from 'vue-router'
import {navigation} from '@/content/docs/navigation'

const router = useRouter()

// Claude's Discretion (CONTEXT.md): top 5 from navigation.ts
const recommendations = navigation.slice(0, 5)

// Handler functions (NOT inline @click="$emit" — per CLAUDE.md gotcha).
// NavigationFailure silenced per Pitfall 6.
function handleOpen(path: string) {
    router.push(path).catch(() => {
        // NavigationFailure (aborted/duplicated/cancelled) — silent per spec §4.6
    })
}

function handleBackHome() {
    router.push('/').catch(() => {
        // NavigationFailure silenced
    })
}
</script>
