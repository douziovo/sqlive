import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { useAiPanelGeometry } from '@/components/ai/useAiPanelGeometry'

function fireMouse(type: string, x: number, y: number) {
    document.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }))
}

describe('useAiPanelGeometry', () => {
    afterEach(() => {
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
    })

    it('initPosition centers the panel once and is idempotent', () => {
        const g = useAiPanelGeometry()
        g.initPosition()
        const styleAfterInit = { ...g.panelStyle.value }

        g.initPosition() // second call must be a no-op
        expect(g.panelStyle.value).toEqual(styleAfterInit)
        expect(styleAfterInit.left).toBe(`${Math.round(window.innerWidth * 0.38)}px`)
        expect(styleAfterInit.top).toBe('40px')
        expect(styleAfterInit.width).toBe('500px')
        expect(styleAfterInit.height).toBe('580px')
    })

    it('minimized style pins the panel to the bottom edge', async () => {
        const g = useAiPanelGeometry()
        g.initPosition()

        g.onHeaderDblClick() // toggle minimize on
        await nextTick()
        const minimized = g.panelStyle.value as Record<string, string>
        expect(minimized.height).toBe('44px')
        expect(minimized.bottom).toBe('0px')
        expect(minimized.top).toBe('auto')
        expect(minimized.borderRadius).toBe('16px 16px 0 0')
        expect(minimized.left).toBe(`${Math.round((window.innerWidth - 500) / 2)}px`)

        g.onHeaderDblClick() // toggle minimize off
        await nextTick()
        // savedPosition was zeroed when un-minimizing, so style falls back to panelState
        expect((g.panelStyle.value as Record<string, string>).height).toBe('580px')
    })

    it('drag moves the panel and clamps to the viewport', async () => {
        const g = useAiPanelGeometry()
        g.initPosition()

        g.onDragStart(new MouseEvent('mousedown', { clientX: 100, clientY: 100 }))
        expect(document.body.style.cursor).toBe('move')
        await nextTick()
        expect((g.panelStyle.value as Record<string, string>).transition).toBe('none')

        // Move right/down within bounds
        fireMouse('mousemove', 150, 140)
        expect((g.panelStyle.value as Record<string, string>).left).toBe(
            `${Math.round(window.innerWidth * 0.38) + 50}px`
        )
        expect((g.panelStyle.value as Record<string, string>).top).toBe('80px')

        // Drag far past every edge: clamped to 0 / viewport bounds
        fireMouse('mousemove', -10000, -10000)
        expect((g.panelStyle.value as Record<string, string>).left).toBe('0px')
        expect((g.panelStyle.value as Record<string, string>).top).toBe('0px')

        fireMouse('mouseup', 0, 0)
        expect(document.body.style.cursor).toBe('')
        await nextTick()
        expect((g.panelStyle.value as Record<string, string>).transition).not.toBe('none')
    })

    it('dragStart is ignored while minimized', () => {
        const g = useAiPanelGeometry()
        g.onHeaderDblClick() // minimize
        g.onDragStart(new MouseEvent('mousedown', { clientX: 0, clientY: 0 }))
        expect(document.body.style.cursor).toBe('')
    })

    it('mousemove without an active drag is a no-op', () => {
        const g = useAiPanelGeometry()
        g.initPosition()
        fireMouse('mousemove', 400, 400)
        expect((g.panelStyle.value as Record<string, string>).top).toBe('40px')
    })

    it('resize grows the panel and enforces MIN_W/MIN_H clamps', () => {
        const g = useAiPanelGeometry()
        g.initPosition()

        g.onResizeStart(new MouseEvent('mousedown', { clientX: 200, clientY: 200 }))
        expect(document.body.style.cursor).toBe('nwse-resize')

        fireMouse('mousemove', 300, 300) // +100/+100
        expect((g.panelStyle.value as Record<string, string>).width).toBe('600px')
        expect((g.panelStyle.value as Record<string, string>).height).toBe('680px')

        // Shrink far below minimums: clamped to MIN_W=340 / MIN_H=320
        fireMouse('mousemove', -10000, -10000)
        expect((g.panelStyle.value as Record<string, string>).width).toBe('340px')
        expect((g.panelStyle.value as Record<string, string>).height).toBe('320px')

        fireMouse('mouseup', 0, 0)
        expect(document.body.style.cursor).toBe('')
        expect(document.body.style.userSelect).toBe('')
    })

    it('resize move without an active resize is a no-op', () => {
        const g = useAiPanelGeometry()
        g.initPosition()
        fireMouse('mousemove', 999, 999)
        expect((g.panelStyle.value as Record<string, string>).width).toBe('500px')
    })

    it('un-minimize after drag restores the dragged position', async () => {
        const g = useAiPanelGeometry()
        g.initPosition()

        g.onDragStart(new MouseEvent('mousedown', { clientX: 0, clientY: 0 }))
        fireMouse('mousemove', 60, 50)
        fireMouse('mouseup', 60, 50)
        // panel moved to x=panelX+60, y=90
        const draggedTop = (g.panelStyle.value as Record<string, string>).top

        g.onHeaderDblClick() // minimize (saves position)
        g.onHeaderDblClick() // restore
        await nextTick()
        expect((g.panelStyle.value as Record<string, string>).top).toBe(draggedTop)
        expect((g.panelStyle.value as Record<string, string>).height).toBe('580px')
    })
})
