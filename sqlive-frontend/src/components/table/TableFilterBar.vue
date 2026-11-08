<template>
    <!-- Filter bar -->
    <div class="px-3 py-2 border-b border-border bg-muted/50 flex items-center gap-2">
        <span class="text-xs text-muted-foreground/70">&#x1F50D;</span>
        <input
            v-model="filterText"
            type="text"
            placeholder="过滤..."
            class="text-sm bg-transparent outline-none flex-1 text-muted-foreground placeholder-muted-foreground/50"
        />
        <button
            v-if="filterText"
            @click="filterText = ''"
            class="text-muted-foreground/50 hover:text-muted-foreground text-xs leading-none"
        >
            &#x2715;
        </button>
    </div>
</template>

<script setup lang="ts">
const filterText = defineModel<string>({ required: true })
</script>
