import { afterEach, describe, expect, it, vi } from 'vitest'

import { downloadFile } from '@/utils/file'

type Spy = ReturnType<typeof vi.fn>

interface DownloadSpies {
    createObjectURLSpy: Spy
    revokeObjectURLSpy: Spy
    clickSpy: Spy
}

/** 安装 downloadFile 依赖的 URL 全局桩，返回各 spy 供断言使用 */
function stubDownloadEnvironment(): DownloadSpies {
    const createObjectURLSpy = vi.fn(() => 'blob:test')
    const revokeObjectURLSpy = vi.fn()
    const clickSpy = vi.fn()

    vi.stubGlobal('URL', {
        createObjectURL: createObjectURLSpy,
        revokeObjectURL: revokeObjectURLSpy
    })

    return { createObjectURLSpy, revokeObjectURLSpy, clickSpy }
}

/** 拦截 document.createElement，为生成的 <a> 挂上 click spy；onAnchor 供需要记录锚点元素的用例使用 */
function stubAnchorCreation(clickSpy: Spy, onAnchor?: (el: HTMLElement) => void) {
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = originalCreateElement(tag)
        if (tag === 'a') {
            onAnchor?.(el as HTMLElement)
            Object.defineProperty(el, 'click', { value: clickSpy })
        }
        return el
    })
}

describe('downloadFile', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    it('creates a blob and triggers download', () => {
        const { createObjectURLSpy, revokeObjectURLSpy, clickSpy } = stubDownloadEnvironment()
        stubAnchorCreation(clickSpy)
        vi.spyOn(document.body, 'appendChild').mockImplementation((node: Node) => node)
        vi.spyOn(document.body, 'removeChild').mockImplementation((child: Node) => child)

        downloadFile('query.sql', 'SELECT 1;')

        expect(createObjectURLSpy).toHaveBeenCalledTimes(1)
        const blob = createObjectURLSpy.mock.calls[0][0] as Blob
        expect(blob.type).toBe('text/sql;charset=utf-8')

        expect(clickSpy).toHaveBeenCalledTimes(1)
        expect(revokeObjectURLSpy).toHaveBeenCalledTimes(1)
        expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:test')
    })

    it('uses default MIME type', () => {
        const { createObjectURLSpy, clickSpy } = stubDownloadEnvironment()
        stubAnchorCreation(clickSpy)

        downloadFile('data.csv', 'a,b,c')

        const blob = createObjectURLSpy.mock.calls[0][0] as Blob
        expect(blob.type).toBe('text/sql;charset=utf-8')
    })

    it('accepts custom MIME type', () => {
        const { createObjectURLSpy, clickSpy } = stubDownloadEnvironment()
        stubAnchorCreation(clickSpy)

        downloadFile('data.json', '{"a":1}', 'application/json')

        const blob = createObjectURLSpy.mock.calls[0][0] as Blob
        expect(blob.type).toBe('application/json')
    })

    it('cleans up the anchor element after download', () => {
        const { clickSpy } = stubDownloadEnvironment()
        const removedElements: HTMLElement[] = []
        let createdAnchor: HTMLElement | null = null

        stubAnchorCreation(clickSpy, (el) => {
            createdAnchor = el
        })
        vi.spyOn(document.body, 'appendChild').mockImplementation((el: Node) => el)
        vi.spyOn(document.body, 'removeChild').mockImplementation((el: Node) => {
            removedElements.push(el as HTMLElement)
            return el
        })

        downloadFile('test.sql', 'SELECT 1;')

        expect(removedElements).toHaveLength(1)
        expect(removedElements[0]).toBe(createdAnchor)
    })
})
