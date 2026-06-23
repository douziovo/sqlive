import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { Ref } from 'vue'
import { ref } from 'vue'

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
  Range: vi.fn((sl: number, sc: number, el: number, ec: number) => ({ sl, sc, el, ec })),
  Selection: vi.fn((sl: number, sc: number, el: number, ec: number) => ({ sl, sc, el, ec })),
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
  format: (...args: any[]) => mockFormat(...args)
}))

import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import { useMonacoEditor } from '@/composables/useMonacoEditor'

describe('useMonacoEditor', () => {
  let container: Ref<HTMLElement | null>
  let emit: ReturnType<typeof vi.fn>

  beforeEach(() => {
    container = ref(document.createElement('div'))
    emit = vi.fn()
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
})
