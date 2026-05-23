<template>
  <div class="mb-3 border border-dashed border-border rounded-md bg-card">
    <div class="px-3 py-2 flex items-center gap-2 border-b border-border">
      <span class="text-xs text-muted-foreground/70">&#x1F50D;</span>
      <input :value="filter" @input="$emit('update:filter', ($event.target as HTMLInputElement).value)"
             type="text" :placeholder="placeholder"
             class="text-sm bg-transparent outline-none flex-1 text-muted-foreground placeholder-muted-foreground/50" />
      <button v-if="filter" @click="$emit('update:filter', '')" class="text-muted-foreground/50 hover:text-muted-foreground text-xs">&#x2715;</button>
    </div>
    <div class="px-3 py-2 flex items-center gap-1">
      <span class="text-xs text-muted-foreground/70 mr-1">排序：</span>
      <button v-for="sf in fields" :key="sf.key" @click="$emit('toggle-sort', sf.key)"
              class="px-2 py-1 text-xs rounded transition-colors border-b-2"
              :class="sortKey === sf.key ? 'text-primary border-primary' : 'text-muted-foreground/70 border-transparent hover:text-muted-foreground'">
        {{ sf.label }}
        <span v-if="sortKey === sf.key && sortDir === 'asc'">&#x25B2;</span>
        <span v-if="sortKey === sf.key && sortDir === 'desc'">&#x25BC;</span>
      </button>
    </div>
  </div>
  <div class="text-xs text-muted-foreground/70 mb-2 px-1">
    共 {{ filteredCount }} 个{{ itemLabel }}
    <span v-if="filteredCount !== totalCount"> | 过滤前 {{ totalCount }} 个</span>
  </div>
</template>

<script setup lang="ts">
export interface SortFieldDef {
  key: string;
  label: string;
}

defineProps<{
  filter: string;
  placeholder: string;
  fields: SortFieldDef[];
  sortKey: string | null;
  sortDir: 'asc' | 'desc' | null;
  itemLabel: string;
  totalCount: number;
  filteredCount: number;
}>();

defineEmits<{
  'update:filter': [value: string];
  'toggle-sort': [key: string];
}>();
</script>
