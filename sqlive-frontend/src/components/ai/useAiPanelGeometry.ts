import { useEventListener } from '@vueuse/core'
import { computed, reactive, ref } from 'vue'

/**
 * Floating-panel geometry: position, size, drag, resize and minimize state.
 * Extracted verbatim from AiChatPanel.vue (behavior-preserving split).
 */
export function useAiPanelGeometry() {
    // ── Panel position & size ──────────────────────────────────────
    const panelState = reactive({ x: 0, y: 0, width: 500, height: 580, initialized: false })
    const savedPosition = reactive({ x: 0, y: 0 })
    const isDragging = ref(false)
    const isResizing = ref(false)
    function initPosition() {
        if (panelState.initialized) return
        panelState.x = Math.round(window.innerWidth * 0.38)
        panelState.y = 40
        panelState.initialized = true
    }

    const isMinimized = ref(false)

    function toggleMinimize() {
        if (isMinimized.value) {
            savedPosition.x = 0
            savedPosition.y = 0
        } else {
            savedPosition.x = panelState.x
            savedPosition.y = panelState.y
        }
        isMinimized.value = !isMinimized.value
    }
    function onHeaderDblClick() {
        toggleMinimize()
    }

    const panelStyle = computed(() => {
        const t =
            isDragging.value || isResizing.value ? 'none' : 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)'
        if (isMinimized.value) {
            return {
                left: `${Math.round((window.innerWidth - panelState.width) / 2)}px`,
                bottom: '0px',
                top: 'auto',
                width: `${panelState.width}px`,
                height: '44px',
                borderRadius: '16px 16px 0 0',
                transition: t
            }
        }
        if (savedPosition.x || savedPosition.y) {
            return {
                left: `${savedPosition.x}px`,
                top: `${savedPosition.y}px`,
                width: `${panelState.width}px`,
                height: `${panelState.height}px`,
                transition: t
            }
        }
        return {
            left: `${panelState.x}px`,
            top: `${panelState.y}px`,
            width: `${panelState.width}px`,
            height: `${panelState.height}px`,
            transition: t
        }
    })

    // ── Drag ───────────────────────────────────────────────────────
    const dragStartPos = reactive({ x: 0, y: 0, panelX: 0, panelY: 0 })
    function onDragStart(e: MouseEvent) {
        if (isMinimized.value) return
        e.preventDefault()
        isDragging.value = true
        dragStartPos.x = e.clientX
        dragStartPos.y = e.clientY
        dragStartPos.panelX = panelState.x
        dragStartPos.panelY = panelState.y
        document.body.style.cursor = 'move'
        document.body.style.userSelect = 'none'
    }
    function onDragMove(e: MouseEvent) {
        if (!isDragging.value) return
        const dx = e.clientX - dragStartPos.x,
            dy = e.clientY - dragStartPos.y
        panelState.x = Math.max(
            0,
            Math.min(window.innerWidth - panelState.width, dragStartPos.panelX + dx)
        )
        panelState.y = Math.max(0, Math.min(window.innerHeight - 40, dragStartPos.panelY + dy))
    }
    function onDragEnd() {
        isDragging.value = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
    }
    useEventListener(document, 'mousemove', onDragMove)
    useEventListener(document, 'mouseup', onDragEnd)

    // ── Resize ─────────────────────────────────────────────────────
    const MIN_H = 320,
        MIN_W = 340
    const resizeStartPos = reactive({ x: 0, y: 0, w: 0, h: 0 })
    function onResizeStart(e: MouseEvent) {
        e.preventDefault()
        isResizing.value = true
        resizeStartPos.x = e.clientX
        resizeStartPos.y = e.clientY
        resizeStartPos.w = panelState.width
        resizeStartPos.h = panelState.height
        document.body.style.cursor = 'nwse-resize'
        document.body.style.userSelect = 'none'
    }
    function onResizeMove(e: MouseEvent) {
        if (!isResizing.value) return
        const dx = e.clientX - resizeStartPos.x,
            dy = e.clientY - resizeStartPos.y
        panelState.width = Math.max(
            MIN_W,
            Math.min(window.innerWidth - panelState.x, resizeStartPos.w + dx)
        )
        panelState.height = Math.max(
            MIN_H,
            Math.min(window.innerHeight - panelState.y, resizeStartPos.h + dy)
        )
    }
    function onResizeEnd() {
        isResizing.value = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
    }
    useEventListener(document, 'mousemove', onResizeMove)
    useEventListener(document, 'mouseup', onResizeEnd)

    return {
        isMinimized,
        panelStyle,
        initPosition,
        onHeaderDblClick,
        onDragStart,
        onResizeStart
    }
}
