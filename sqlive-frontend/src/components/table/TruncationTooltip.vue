<template>
    <!-- Truncation tooltip -->
    <Teleport to="body">
        <div
            v-show="truncTooltip.visible"
            ref="tooltipRef"
            class="fixed z-50 bg-amber-50 border border-amber-200 rounded-lg shadow-lg text-sm overflow-hidden"
            :style="tooltipStyle"
        >
            <div class="px-3 py-2">
                <div class="text-sm font-semibold text-amber-900">值已截断</div>
                <div class="text-xs text-amber-800 mt-1">
                    原始长度 {{ truncTooltip.originalLen }} 字符，已截断为
                    {{ truncTooltip.truncatedLen }} 字符（列最大长度: {{ truncTooltip.maxLen }}）
                </div>
            </div>
        </div>
    </Teleport>
</template>

<script setup lang="ts">
import { inject, nextTick, onUnmounted, ref, watch } from 'vue'
import { SQL_CONTEXT_KEY } from '../../model/injectionKeys'

const { lastTruncations } = inject(SQL_CONTEXT_KEY)!

// --- Truncation tooltip ---
const truncTooltip = ref({
    visible: false,
    originalLen: 0,
    truncatedLen: 0,
    maxLen: 0
})
const tooltipRef = ref<HTMLElement | null>(null)
const tooltipStyle = ref<Record<string, string>>({})
let tooltipTimer: ReturnType<typeof setTimeout> | null = null

function positionTooltip(target: HTMLElement) {
    if (!tooltipRef.value) return
    const rect = target.getBoundingClientRect()
    const popupEl = tooltipRef.value
    const popupHeight = popupEl.offsetHeight || 60
    const popupWidth = Math.min(340, popupEl.offsetWidth || 260)
    const viewportH = window.innerHeight
    const viewportW = window.innerWidth
    const gap = 4

    let top: number
    const below = rect.bottom + gap
    const above = rect.top - popupHeight - gap

    if (below + popupHeight <= viewportH - 16 || above < 0) {
        top = below
    } else {
        top = above
    }

    let left = rect.left + rect.width / 2 - popupWidth / 2
    left = Math.max(8, Math.min(left, viewportW - popupWidth - 8))

    tooltipStyle.value = {
        top: `${top}px`,
        left: `${left}px`,
        minWidth: '280px',
        maxWidth: '340px'
    }
}

watch(
    () => lastTruncations?.value,
    (truncations) => {
        if (!truncations || truncations.length === 0) return
        const first = truncations[0]
        truncTooltip.value = {
            visible: true,
            originalLen: String(first.originalValue ?? '').length,
            truncatedLen: String(first.value).length,
            maxLen: first.maxLength ?? 0
        }
        if (tooltipTimer) clearTimeout(tooltipTimer)
        nextTick(() => {
            const cellEl = document.querySelector(`[data-column="${(first as any).column}"]`)
            if (cellEl instanceof HTMLElement) positionTooltip(cellEl)
        })
        tooltipTimer = setTimeout(() => {
            truncTooltip.value.visible = false
        }, 3000)
    },
    { deep: true }
)

onUnmounted(() => {
    if (tooltipTimer) clearTimeout(tooltipTimer)
})
</script>
