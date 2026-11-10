<template>
    <!-- Filter bar -->
    <div class="flex items-center gap-2 border-b border-border bg-muted/50 px-3 py-2">
        <span class="text-xs text-muted-foreground/70">&#x1F50D;</span>
        <input
            v-model="filterText"
            type="text"
            placeholder="过滤..."
            class="flex-1 bg-transparent text-sm text-muted-foreground placeholder-muted-foreground/50 outline-none"
        />
        <button
            v-if="filterText"
            @click="filterText = ''"
            class="text-xs leading-none text-muted-foreground/50 hover:text-muted-foreground"
        >
            &#x2715;
        </button>
    </div>
</template>

<script setup lang="ts">
const filterText = defineModel<string>({ required: true })
</script>
