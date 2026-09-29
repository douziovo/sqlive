import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ref } from 'vue'
import { nextTick, ref } from 'vue'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import { useMonacoEditor } from '@/composables/useMonacoEditor'

// Mock monaco-editor completely before importing the composable
const mockEditor = {
    getValue: vi.fn(() => 'SELECT 1;'),
    setValue: vi.fn(),
    onDidChangeModelContent: vi.fn(),
    dispose: vi.fn(),
    updateOptions: vi.fn(),
    createDecorationsCollection: vi.fn(() => ({
        set: vi.fn(),
        clear: vi.fn()
    })),
    addAction: vi.fn(),
    getModel: vi.fn(() => ({
        getValue: vi.fn(() => 'SELECT 1;'),
        getValueInRange: vi.fn(() => 'SELECT'),
        getPositionAt: vi.fn(() => ({ lineNumber: 1, column: 1 })),
        getLineCount: vi.fn(() => 1),
        getLineMaxColumn: vi.fn(() => 10)
    })),
    getSelection: vi.fn(() => null),
    getSelections: vi.fn(() => null),
    setSelections: vi.fn(),
    revealLineInCenter: vi.fn()
}

vi.mock('monaco-editor/esm/vs/editor/editor.api', () => ({
    editor: {
        create: vi.fn(() => mockEditor),
        createModel: vi.fn(),
        setTheme: vi.fn(),
        setModelMarkers: vi.fn()
    },
    languages: {
        register: vi.fn(),
        setMonarchTokensProvider: vi.fn()
    },
    Range: vi.fn(function (sl: number, sc: number, el: number, ec: number) {
        return { sl, sc, el, ec }
    }),
    Selection: vi.fn(function (sl: number, sc: number, el: number, ec: number) {
        return { sl, sc, el, ec }
    }),
    KeyMod: { CtrlCmd: 1, Shift: 2, Alt: 4 },
    KeyCode: { KeyT: 1, KeyL: 2 },
    MarkerSeverity: { Error: 1 }
}))

vi.mock('monaco-editor/esm/vs/editor/editor.worker', () => ({
    default: class MockWorker {}
}))

vi.mock('monaco-editor/esm/vs/basic-languages/sql/sql.contribution', () => ({}))

const mockFormat = vi.fn((sql: string) => `formatted: ${sql}`)
vi.mock('sql-formatter', () => ({
    format: (sql: string) => mockFormat(sql)
}))

describe('useMonacoEditor', () => {
    let container: Ref<HTMLElement | null>
    let emit: (event: string, ...args: any[]) => void

    beforeEach(() => {
        container = ref(document.createElement('div'))
        emit = vi.fn<(event: string, ...args: any[]) => void>()
        vi.clearAllMocks()
        // Re-setup default return for getValue
        mockEditor.getValue.mockReturnValue('SELECT 1;')
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('create initializes editor with initial code', () => {
        const { create } = useMonacoEditor(container, emit, {
            highlightChunk: ref(null),
            error: ref(null),
            ai: undefined
        })

        create('SELECT * FROM users;')

        expect(monaco.editor.create).toHaveBeenCalledWith(
            container.value,
            expect.objectContaining({
                value: 'SELECT * FROM users;',
                language: 'sql'
            })
        )
    })

    it('create does nothing when container is null', () => {
        container.value = null
        const { create } = useMonacoEditor(container, emit, {
            highlightChunk: ref(null),
            error: ref(null),
            ai: undefined
        })

        create('SELECT 1;')

        expect(monaco.editor.create).not.toHaveBeenCalled()
    })

    it('syncCode updates editor value when different', () => {
        mockEditor.getValue.mockReturnValue('SELECT 1;')
        const { create, syncCode } = useMonacoEditor(container, emit, {
            highlightChunk: ref(null),
            error: ref(null),
            ai: undefined
        })

        create('SELECT 1;')
        syncCode('SELECT 2;')

        expect(mockEditor.setValue).toHaveBeenCalledWith('SELECT 2;')
    })

    it('syncCode does nothing when value is same', () => {
        mockEditor.getValue.mockReturnValue('SELECT 1;')
        const { create, syncCode } = useMonacoEditor(container, emit, {
            highlightChunk: ref(null),
            error: ref(null),
            ai: undefined
        })

        create('SELECT 1;')
        mockEditor.setValue.mockClear()
        syncCode('SELECT 1;')

        expect(mockEditor.setValue).not.toHaveBeenCalled()
    })

    it('syncCode does nothing when editor is not created', () => {
        const { syncCode } = useMonacoEditor(container, emit, {
            highlightChunk: ref(null),
            error: ref(null),
            ai: undefined
        })

        // Should not throw
        syncCode('SELECT 1;')
    })

    it('dispose cleans up editor', () => {
        const { create, dispose } = useMonacoEditor(container, emit, {
            highlightChunk: ref(null),
            error: ref(null),
            ai: undefined
        })

        create('SELECT 1;')
        dispose()

        expect(mockEditor.dispose).toHaveBeenCalled()
    })

    it('restarts highlight expiry and cancels it on dispose', async () => {
        vi.useFakeTimers()
        const highlightChunk = ref<string | null>(null)
        const editor = useMonacoEditor(container, emit, {
            highlightChunk,
            error: ref(null),
            ai: undefined
        })
        try {
            editor.create('SELECT 1;')
            const decorations = mockEditor.createDecorationsCollection.mock.results.at(-1)!.value
            decorations.clear.mockClear()
            highlightChunk.value = 'SELECT'
            await nextTick()
            vi.advanceTimersByTime(500)
            highlightChunk.value = '1'
            await nextTick()
            vi.advanceTimersByTime(999)
            expect(decorations.clear).not.toHaveBeenCalled()
            vi.advanceTimersByTime(1)
            expect(decorations.clear).toHaveBeenCalledOnce()
            highlightChunk.value = 'SELECT'
            await nextTick()
            editor.dispose()
            const count = decorations.clear.mock.calls.length
            vi.advanceTimersByTime(1000)
            expect(decorations.clear).toHaveBeenCalledTimes(count)
        } finally {
            editor.dispose()
            vi.useRealTimers()
        }
    })

    it('dispose does nothing when editor not created', () => {
        const { dispose } = useMonacoEditor(container, emit, {
            highlightChunk: ref(null),
            error: ref(null),
            ai: undefined
        })

        // Should not throw
        dispose()
    })

    it('formatSql calls sql-formatter and updates editor', () => {
        const { create, formatSql } = useMonacoEditor(container, emit, {
            highlightChunk: ref(null),
            error: ref(null),
            ai: undefined
        })

        create('SELECT 1;')
        formatSql()

        expect(mockFormat).toHaveBeenCalled()
        expect(mockEditor.setValue).toHaveBeenCalledWith('formatted: SELECT 1;')
    })

    it('formatSql does nothing when editor not created', () => {
        const { formatSql } = useMonacoEditor(container, emit, {
            highlightChunk: ref(null),
            error: ref(null),
            ai: undefined
        })

        // Should not throw
        formatSql()
    })

    it('create registers editor actions', () => {
        const { create } = useMonacoEditor(container, emit, {
            highlightChunk: ref(null),
            error: ref(null),
            ai: undefined
        })

        create('SELECT 1;')

        // Should register submit, format, import, export-tab, export-all actions
        expect(mockEditor.addAction).toHaveBeenCalledTimes(5)
        const actionIds = mockEditor.addAction.mock.calls.map((c: any) => c[0].id)
        expect(actionIds).toContain('submit-sql')
        expect(actionIds).toContain('format-sql')
        expect(actionIds).toContain('import-sql')
        expect(actionIds).toContain('export-tab')
        expect(actionIds).toContain('export-all')
    })

    it('create registers AI actions when ai dependency is provided', () => {
        const mockAi = {
            sendToAi: vi.fn(),
            onOpenChat: vi.fn()
        }
        const { create } = useMonacoEditor(container, emit, {
            highlightChunk: ref(null),
            error: ref(null),
            ai: mockAi
        })

        create('SELECT 1;')

        const actionIds = mockEditor.addAction.mock.calls.map((c: any) => c[0].id)
        expect(actionIds).toContain('ai-send-selection')
        expect(actionIds).toContain('ai-generate-sql')
        expect(actionIds).toContain('ai-open-chat')
    })

    it('does not register AI actions when ai dependency is undefined', () => {
        const { create } = useMonacoEditor(container, emit, {
            highlightChunk: ref(null),
            error: ref(null),
            ai: undefined
        })

        create('SELECT 1;')

        const actionIds = mockEditor.addAction.mock.calls.map((c: any) => c[0].id)
        expect(actionIds).not.toContain('ai-send-selection')
        expect(actionIds).not.toContain('ai-generate-sql')
        expect(actionIds).not.toContain('ai-open-chat')
    })

    it('runs submit, import, export, and format actions', () => {
        const onImportClick = vi.fn()
        const { create } = useMonacoEditor(
            container,
            emit,
            { highlightChunk: ref(null), error: ref(null), ai: undefined },
            onImportClick
        )
        create('SELECT 1;')
        const action = (id: string) =>
            mockEditor.addAction.mock.calls.find((c: any) => c[0].id === id)![0] as {
                run: () => void
            }

        action('submit-sql').run()
        action('import-sql').run()
        action('export-tab').run()
        action('export-all').run()
        action('format-sql').run()

        expect(emit).toHaveBeenCalledWith('submit')
        expect(onImportClick).toHaveBeenCalledOnce()
        expect(emit).toHaveBeenCalledWith('export-tab')
        expect(emit).toHaveBeenCalledWith('export-all')
        expect(mockEditor.setValue).toHaveBeenCalledWith('formatted: SELECT 1;')
    })

    it('emits user edits but suppresses updates while syncing external code', () => {
        const { create, syncCode } = useMonacoEditor(container, emit, {
            highlightChunk: ref(null),
            error: ref(null),
            ai: undefined
        })
        create('SELECT 1;')
        const onChange = mockEditor.onDidChangeModelContent.mock.calls[0][0] as () => void
        onChange()
        expect(emit).toHaveBeenCalledWith('update:code', 'SELECT 1;')

        vi.mocked(emit).mockClear()
        mockEditor.setValue.mockImplementationOnce(() => onChange())
        syncCode('SELECT 2;')
        expect(emit).not.toHaveBeenCalled()
    })

    it('restores selections within the new model bounds after syncing', () => {
        mockEditor.getSelections.mockReturnValueOnce([
            { selectionStartLineNumber: 10, selectionStartColumn: 50 }
        ] as any)
        const { create, syncCode } = useMonacoEditor(container, emit, {
            highlightChunk: ref(null),
            error: ref(null),
            ai: undefined
        })
        create('SELECT 1;')

        syncCode('SELECT 2;')

        expect(mockEditor.setSelections).toHaveBeenCalledWith([
            { sl: 1, sc: 10, el: 1, ec: 10 }
        ])
    })

    it('updates and clears error markers when the error changes', async () => {
        const error = ref<{ line: number; message: string } | null>(null)
        const { create } = useMonacoEditor(container, emit, {
            highlightChunk: ref(null),
            error,
            ai: undefined
        })
        create('SELECT 1;')

        error.value = { line: 3, message: 'syntax error' }
        await nextTick()
        expect(monaco.editor.setModelMarkers).toHaveBeenCalledWith(
            expect.anything(),
            'sql-error',
            [expect.objectContaining({ startLineNumber: 3, message: 'syntax error' })]
        )
        expect(mockEditor.revealLineInCenter).toHaveBeenCalledWith(3)

        error.value = null
        await nextTick()
        expect(monaco.editor.setModelMarkers).toHaveBeenLastCalledWith(
            expect.anything(),
            'sql-error',
            []
        )
    })

    it('highlights only text present in the editor', async () => {
        const highlightChunk = ref<string | null>('SELECT')
        const { create } = useMonacoEditor(container, emit, {
            highlightChunk,
            error: ref(null),
            ai: undefined
        })
        create('SELECT 1;')
        const decorations = mockEditor.createDecorationsCollection.mock.results.at(-1)!.value
        expect(decorations.set).toHaveBeenCalledWith([
            expect.objectContaining({ options: { inlineClassName: 'flash-highlight' } })
        ])

        decorations.set.mockClear()
        highlightChunk.value = 'missing'
        await nextTick()
        expect(decorations.set).not.toHaveBeenCalled()

        highlightChunk.value = null
        await nextTick()
        expect(decorations.clear).toHaveBeenCalled()
    })

    it('sends selected SQL to AI and opens chat from editor actions', () => {
        const ai = { sendToAi: vi.fn(), onOpenChat: vi.fn() }
        const { create } = useMonacoEditor(container, emit, {
            highlightChunk: ref(null),
            error: ref(null),
            ai
        })
        create('SELECT 1;')
        const action = (id: string) =>
            mockEditor.addAction.mock.calls.find((c: any) => c[0].id === id)![0] as {
                run: () => void
            }

        action('ai-send-selection').run()
        action('ai-generate-sql').run()
        action('ai-open-chat').run()

        expect(ai.sendToAi).toHaveBeenCalledWith(expect.stringContaining('SELECT'))
        expect(ai.sendToAi).toHaveBeenCalledWith('请帮我写一段 SQL 查询。')
        expect(ai.onOpenChat).toHaveBeenCalledOnce()

        ai.sendToAi.mockClear()
        const model = mockEditor.getModel()
        model.getValueInRange.mockReturnValueOnce('   ')
        mockEditor.getModel.mockReturnValueOnce(model)
        action('ai-send-selection').run()
        expect(ai.sendToAi).not.toHaveBeenCalled()
    })

    it('leaves editor unchanged when formatting fails', () => {
        const { create, formatSql } = useMonacoEditor(container, emit, {
            highlightChunk: ref(null),
            error: ref(null),
            ai: undefined
        })
        create('SELECT 1;')
        mockFormat.mockImplementationOnce(() => {
            throw new Error('invalid SQL')
        })

        expect(() => formatSql()).not.toThrow()
        expect(mockEditor.setValue).not.toHaveBeenCalled()
    })
})
