<template>
    <div class="mb-3 rounded-md border border-dashed border-border bg-card">
        <div class="flex items-center gap-2 border-b border-border px-3 py-2">
            <span class="text-xs text-muted-foreground/70">&#x1F50D;</span>
            <input
                :value="filter"
                @input="$emit('update:filter', ($event.target as HTMLInputElement).value)"
                type="text"
                :placeholder="placeholder"
                class="flex-1 bg-transparent text-sm text-muted-foreground placeholder-muted-foreground/50 outline-none"
            />
            <button
                v-if="filter"
                @click="$emit('update:filter', '')"
                class="text-xs text-muted-foreground/50 hover:text-muted-foreground"
            >
                &#x2715;
            </button>
        </div>
        <div class="flex items-center gap-1 px-3 py-2">
            <span class="mr-1 text-xs text-muted-foreground/70">排序：</span>
            <button
                v-for="sf in fields"
                :key="sf.key"
                @click="$emit('toggle-sort', sf.key)"
                class="rounded border-b-2 px-2 py-1 text-xs transition-colors"
                :class="
                    sortKey === sf.key
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground/70 hover:text-muted-foreground'
                "
            >
                {{ sf.label }}
                <span v-if="sortKey === sf.key && sortDir === 'asc'">&#x25B2;</span>
                <span v-if="sortKey === sf.key && sortDir === 'desc'">&#x25BC;</span>
            </button>
        </div>
    </div>
    <div class="mb-2 px-1 text-xs text-muted-foreground/70">
        共 {{ filteredCount }} 个{{ itemLabel }}
        <span v-if="filteredCount !== totalCount"> | 过滤前 {{ totalCount }} 个</span>
    </div>
</template>

<script setup lang="ts">
export interface SortFieldDef {
    key: string
    label: string
}

defineProps<{
    filter: string
    placeholder: string
    fields: SortFieldDef[]
    sortKey: string | null
    sortDir: 'asc' | 'desc' | null
    itemLabel: string
    totalCount: number
    filteredCount: number
}>()

defineEmits<{
    'update:filter': [value: string]
    'toggle-sort': [key: string]
}>()
</script>
