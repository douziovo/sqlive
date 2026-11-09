<template>
    <div class="h-screen flex flex-col">
        <AppHeader />
        <main class="flex-1 min-h-0 overflow-hidden">
            <!-- router-view 是 Vue Router 的内置组件而非 HTML 标签，非错误 -->
            <!--suppress HtmlUnknownTag -->
            <router-view v-slot="{ Component }">
                <KeepAlive>
                    <component :is="Component" />
                </KeepAlive>
                <!-- 同上：router-view 闭合标签同样属于 Vue Router 内置组件 -->
                <!--suppress HtmlUnknownTag -->
            </router-view>
        </main>
    </div>
</template>

<script setup lang="ts">
import AppHeader from '@/components/AppHeader.vue'
</script>
