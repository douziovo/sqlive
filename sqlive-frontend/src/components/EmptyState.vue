<template>
    <div
        class="flex h-40 flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-card text-muted-foreground/70"
    >
        <div
            class="mb-1 flex h-14 w-14 items-center justify-center rounded-xl bg-linear-to-br from-primary/10 to-primary/5 text-3xl shadow-sm"
        >
            {{ icon }}
        </div>
        <p class="text-sm">{{ title }}</p>
        <p v-if="subtitle" class="mt-1 text-xs text-muted-foreground/50">{{ subtitle }}</p>
    </div>
</template>

<script setup lang="ts">
defineProps<{
    icon: string
    title: string
    subtitle?: string
}>()
</script>
