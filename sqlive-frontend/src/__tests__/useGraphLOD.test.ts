import {describe, expect, it} from 'vitest'
import {useGraphLOD} from '@/composables/useGraphLOD'

describe('useGraphLOD', () => {
    it('edgeOpacityForZoom returns 0 when zoom < 0.3', () => {
        const {edgeOpacityForZoom} = useGraphLOD()
        expect(edgeOpacityForZoom(0.2)).toBe(0)
    })

    it('edgeOpacityForZoom returns 0.12 when 0.5 <= zoom < 1.2', () => {
        const {edgeOpacityForZoom} = useGraphLOD()
        expect(edgeOpacityForZoom(0.8)).toBe(0.12)
    })

    it('edgeOpacityForZoom returns 0.18 when zoom >= 1.5', () => {
        const {edgeOpacityForZoom} = useGraphLOD()
        expect(edgeOpacityForZoom(1.6)).toBe(0.18)
    })

    it('edgeOpacityForZoom interpolates between 0.3 and 0.5', () => {
        const {edgeOpacityForZoom} = useGraphLOD()
        // At zoom=0.4: ((0.4 - 0.3) / 0.2) * 0.12 = 0.06
        expect(edgeOpacityForZoom(0.4)).toBeCloseTo(0.06, 5)
    })

    it('edgeOpacityForZoom interpolates between 1.2 and 1.5', () => {
        const {edgeOpacityForZoom} = useGraphLOD()
        // At zoom=1.35: 0.12 + ((1.35 - 1.2) / 0.3) * 0.06 = 0.12 + 0.03 = 0.15
        expect(edgeOpacityForZoom(1.35)).toBeCloseTo(0.15, 5)
    })
})
