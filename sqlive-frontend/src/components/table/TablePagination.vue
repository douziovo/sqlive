<template>
    <!-- Pagination bar -->
    <div
        class="flex items-center justify-between border-t border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground"
    >
        <span>共 {{ totalRows }} 行</span>
        <div class="flex items-center gap-2">
            <select
                v-model="pageSize"
                class="rounded border border-border bg-card px-1 py-1 text-xs outline-none"
            >
                <option :value="10">10</option>
                <option :value="25">25</option>
                <option :value="50">50</option>
                <option :value="100">100</option>
            </select>
            <button
                @click="currentPage--"
                :disabled="currentPage <= 1"
                class="rounded border border-border bg-card px-2 py-1 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-30"
            >
                &#x2190; 上一页
            </button>
            <span>{{ currentPage }} / {{ totalPages }}</span>
            <button
                @click="currentPage++"
                :disabled="currentPage >= totalPages"
                class="rounded border border-border bg-card px-2 py-1 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-30"
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
