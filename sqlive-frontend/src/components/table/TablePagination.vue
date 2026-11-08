<template>
    <!-- Pagination bar -->
    <div
        class="px-3 py-2 border-t border-border bg-muted/50 flex items-center justify-between text-xs text-muted-foreground"
    >
        <span>共 {{ totalRows }} 行</span>
        <div class="flex items-center gap-2">
            <select v-model="pageSize" class="text-xs border border-border rounded px-1 py-1 bg-card outline-none">
                <option :value="10">10</option>
                <option :value="25">25</option>
                <option :value="50">50</option>
                <option :value="100">100</option>
            </select>
            <button
                @click="currentPage--"
                :disabled="currentPage <= 1"
                class="px-2 py-1 rounded border border-border bg-card disabled:opacity-30 disabled:cursor-not-allowed hover:bg-secondary"
            >
                &#x2190; 上一页
            </button>
            <span>{{ currentPage }} / {{ totalPages }}</span>
            <button
                @click="currentPage++"
                :disabled="currentPage >= totalPages"
                class="px-2 py-1 rounded border border-border bg-card disabled:opacity-30 disabled:cursor-not-allowed hover:bg-secondary"
            >
                下一页 &#x2192;
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
defineProps<{
    totalRows: number
    totalPages: number
}>()

const currentPage = defineModel<number>('currentPage', { required: true })
const pageSize = defineModel<number>('pageSize', { required: true })
</script>
