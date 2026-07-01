<template>
  <article class="p-6 max-w-3xl mx-auto">
    <MarkdownRenderer v-if="html" :html="html" />
    <div v-else class="text-muted-foreground">加载中...</div>
  </article>
</template>

<script setup lang="ts">
import {computed, watch} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import {useDocArticle} from '@/composables/useDocArticle'
import MarkdownRenderer from '@/components/docs/MarkdownRenderer.vue'

// D-05: ArticlePage accepts optional slug prop (static from router for
// /docs/intro and /docs/changelog; dynamic for /docs/usage/:article).
// Falls back to route.params.article when no prop is passed.
const props = defineProps<{ slug?: string }>()

const route = useRoute()
const router = useRouter()

const slugRef = computed(() => props.slug ?? (route.params.article as string) ?? '')

const {html} = useDocArticle(slugRef)

// Error Handling 4.1: slug not found → redirect to /docs/not-found.
// NavigationFailure silenced per Pitfall 6 (aborted/duplicated/cancelled).
watch(
  () => html.value,
  (val) => {
    if (val === null && slugRef.value !== '') {
      router.replace('/docs/not-found').catch(() => {})
    }
  },
  {immediate: true},
)
</script>
