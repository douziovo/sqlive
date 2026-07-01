<!--
  ApiPage.vue — @scalar/api-reference dynamic import + fetch /v3/api-docs (D-04).

  W7 fix (RESEARCH.md A10): `dist/style.css` confirmed present post-install —
  CSS imported at top of script block. Resolves the "Scalar CSS path" assumption.

  Error Handling:
  - 4.2: fetch fails → retry once after 500ms → error state + retry button
  - 4.7: Scalar dynamic import failure → fallback <pre> raw JSON

  UI-SPEC FLAG 1: retry button text is "重新加载 API 文档" (verb+noun, not "重试").

  CLAUDE.md gotcha: handleRetry is a handler function, not inline @click.
-->
<template>
  <div class="p-4 min-h-full">
    <!-- Loading state (Error Handling 4.2) -->
    <div v-if="loading" class="text-muted-foreground text-sm animate-pulse">
      加载 API 文档...
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="text-destructive">
      <p>API 文档暂时不可用</p>
      <p class="text-xs mt-1">无法加载 OpenAPI 规范（{{ error }}）</p>
      <button
        @click="handleRetry"
        class="mt-2 px-3 py-1 bg-primary text-primary-foreground hover:bg-primary/90 rounded text-sm"
        aria-label="重新加载 API 文档"
      >
        重新加载 API 文档
      </button>
    </div>

    <!-- Success: Scalar renders OpenAPI spec -->
    <component
      v-else-if="ScalarApiReference && openApiJson"
      :is="ScalarApiReference"
      :configuration="{ spec: { content: openApiJson } }"
    />

    <!-- Fallback: Scalar load failed, show raw JSON (Error Handling 4.7) -->
    <pre v-else-if="openApiJson" class="bg-secondary text-secondary-foreground p-4 rounded-md overflow-x-auto text-sm font-mono">{{ JSON.stringify(openApiJson, null, 2) }}</pre>
  </div>
</template>

<script setup lang="ts">
// W7 fix: dist/style.css confirmed present (Step 1a verified post-install).
import '@scalar/api-reference/style.css'

import {onMounted, ref, shallowRef} from 'vue'

// shallowRef avoids deep reactivity on the Scalar component ref (per plan Step 1).
const ScalarApiReference = shallowRef<any>(null)
const openApiJson = ref<any>(null)
const loading = ref(true)
const error = ref<string | null>(null)

/**
 * Dynamically import @scalar/api-reference (D-04 — ~150KB gzip lazy load).
 * A2 assumption verified: `ApiReference` is a named export (confirmed via
 * `grep index.d.ts` post-install).
 * On failure, falls back to <pre> JSON rendering (Error Handling 4.7).
 */
async function loadScalar() {
    try {
        const mod = await import('@scalar/api-reference')
        ScalarApiReference.value = mod.ApiReference ?? mod.default
    } catch (e) {
        // 4.7 Scalar load failure — fallback <pre> raw JSON renders when openApiJson is set
        console.error('Scalar component load failed:', e)
    }
}

/**
 * Fetch /v3/api-docs with retry-once after 500ms (D-04 Error Handling 4.2).
 * On both failures, sets error.value (does NOT throw).
 */
async function fetchOpenApi() {
    loading.value = true
    error.value = null
    try {
        const res = await fetch('/v3/api-docs')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        openApiJson.value = await res.json()
    } catch (e: any) {
        // Retry once after 500ms
        await new Promise((r) => setTimeout(r, 500))
        try {
            const res = await fetch('/v3/api-docs')
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            openApiJson.value = await res.json()
        } catch (e2: any) {
            error.value = e2.message
        }
    } finally {
        loading.value = false
    }
}

// CLAUDE.md gotcha: handler function, not inline @click="fetchOpenApi"
function handleRetry() {
    void fetchOpenApi()
}

onMounted(() => {
    void loadScalar()
    void fetchOpenApi()
})
</script>
