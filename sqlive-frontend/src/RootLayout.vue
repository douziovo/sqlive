<template>
  <div class="h-screen flex flex-col">
    <AppHeader />
    <main class="flex-1 min-h-0 overflow-hidden">
      <router-view v-slot="{ Component }">
        <KeepAlive>
          <component :is="Component" />
        </KeepAlive>
      </router-view>
    </main>
  </div>
</template>

<script setup lang="ts">
import AppHeader from '@/components/AppHeader.vue'
</script>
