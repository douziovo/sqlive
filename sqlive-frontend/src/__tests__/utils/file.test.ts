import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadFile } from '@/utils/file'

describe('downloadFile', () => {
  let createObjectURLSpy: ReturnType<typeof vi.fn>
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>
  let clickSpy: ReturnType<typeof vi.fn>

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('creates a blob and triggers download', () => {
    createObjectURLSpy = vi.fn(() => 'blob:test')
    revokeObjectURLSpy = vi.fn()
    clickSpy = vi.fn()

    vi.stubGlobal('URL', {
      createObjectURL: createObjectURLSpy,
      revokeObjectURL: revokeObjectURLSpy
    })

    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreateElement(tag)
      if (tag === 'a') {
        Object.defineProperty(el, 'click', { value: clickSpy })
      }
      return el
    })
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
    createObjectURLSpy = vi.fn(() => 'blob:test')
    revokeObjectURLSpy = vi.fn()
    clickSpy = vi.fn()

    vi.stubGlobal('URL', {
      createObjectURL: createObjectURLSpy,
      revokeObjectURL: revokeObjectURLSpy
    })

    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreateElement(tag)
      if (tag === 'a') {
        Object.defineProperty(el, 'click', { value: clickSpy })
      }
      return el
    })

    downloadFile('data.csv', 'a,b,c')

    const blob = createObjectURLSpy.mock.calls[0][0] as Blob
    expect(blob.type).toBe('text/sql;charset=utf-8')
  })

  it('accepts custom MIME type', () => {
    createObjectURLSpy = vi.fn(() => 'blob:test')
    revokeObjectURLSpy = vi.fn()
    clickSpy = vi.fn()

    vi.stubGlobal('URL', {
      createObjectURL: createObjectURLSpy,
      revokeObjectURL: revokeObjectURLSpy
    })

    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreateElement(tag)
      if (tag === 'a') {
        Object.defineProperty(el, 'click', { value: clickSpy })
      }
      return el
    })

    downloadFile('data.json', '{"a":1}', 'application/json')

    const blob = createObjectURLSpy.mock.calls[0][0] as Blob
    expect(blob.type).toBe('application/json')
  })

  it('cleans up the anchor element after download', () => {
    createObjectURLSpy = vi.fn(() => 'blob:test')
    revokeObjectURLSpy = vi.fn()
    clickSpy = vi.fn()
    const removedElements: HTMLElement[] = []

    vi.stubGlobal('URL', {
      createObjectURL: createObjectURLSpy,
      revokeObjectURL: revokeObjectURLSpy
    })

    const originalCreateElement = document.createElement.bind(document)
    let createdAnchor: HTMLElement | null = null
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreateElement(tag)
      if (tag === 'a') {
        createdAnchor = el
        Object.defineProperty(el, 'click', { value: clickSpy })
      }
      return el
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
