import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import { type Ref, watch } from 'vue'
import 'monaco-editor/esm/vs/basic-languages/sql/sql.contribution'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import { format } from 'sql-formatter'
import type { AiActions } from './useAiChat'

self.MonacoEnvironment = {
  getWorker() {
    return new editorWorker()
  }
}

export function useMonacoEditor(
  container: Ref<HTMLElement | null>,
  emit: (e: string, ...args: any[]) => void,
  deps: {
    highlightChunk: Ref<string | null>
    error: Ref<{ line: number; message: string } | null>
    ai: AiActions | undefined
  },
  onImportClick?: () => void
) {
  let editor: monaco.editor.IStandaloneCodeEditor | null = null
  let highlightDeco: monaco.editor.IEditorDecorationsCollection | null = null
  let ignoreChanges = false

  function formatSql() {
    if (!editor) return
    try {
      const formatted = format(editor.getValue(), { language: 'sqlite', tabWidth: 4 })
      editor.setValue(formatted)
    } catch {
      // Silently ignore format errors
    }
  }

  function applyHighlight(chunk: string | null) {
    if (!editor || !chunk) {
      highlightDeco?.clear()
      return
    }
    const model = editor.getModel()
    if (!model) return
    const fullText = model.getValue()
    const idx = fullText.indexOf(chunk)
    if (idx === -1) return
    const startPos = model.getPositionAt(idx)
    const endPos = model.getPositionAt(idx + chunk.length)
    highlightDeco?.set([
      {
        range: new monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column),
        options: { inlineClassName: 'flash-highlight' }
      }
    ])
  }

  function applyErrorMarkers(errorVal: { line: number; message: string } | null) {
    if (!editor) return
    const model = editor.getModel()
    if (!model) return
    if (errorVal) {
      monaco.editor.setModelMarkers(model, 'sql-error', [
        {
          severity: monaco.MarkerSeverity.Error,
          message: errorVal.message,
          startLineNumber: errorVal.line,
          startColumn: 1,
          endLineNumber: errorVal.line,
          endColumn: Number.MAX_SAFE_INTEGER
        }
      ])
      editor.revealLineInCenter(errorVal.line)
    } else {
      monaco.editor.setModelMarkers(model, 'sql-error', [])
    }
  }

  function create(initialCode: string) {
    if (!container.value) return

    // Expose monaco on window for E2E tests — Playwright keyboard.type()
    // cannot reliably type spaces/special chars into Monaco.
    if (typeof window !== 'undefined' && window.location.search.includes('e2e=1')) {
      ;(window as any).monaco = monaco
    }

    editor = monaco.editor.create(container.value, {
      value: initialCode,
      language: 'sql',
      theme: 'vs',
      // Monaco 0.55+ defaults editContext=true, which uses the experimental
      // EditContext API. This breaks space-key input because EditContext
      // bypasses traditional keyboard events. Fall back to textarea mode.
      editContext: false,
      fontSize: 14,
      fontFamily:
        '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      lineNumbers: 'on',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      hover: { above: false },
      automaticLayout: true,
      tabSize: 4,
      renderWhitespace: 'selection',
      wordWrap: 'bounded',
      wordWrapColumn: 160,
      wrappingIndent: 'indent',
      wrappingStrategy: 'advanced',
      padding: { top: 16, bottom: 16 },
      overviewRulerBorder: false,
      hideCursorInOverviewRuler: true,
      scrollbar: {
        verticalScrollbarSize: 6,
        horizontalScrollbarSize: 6,
        verticalSliderSize: 6,
        horizontalSliderSize: 6,
        alwaysConsumeMouseWheel: false
      }
    })

    highlightDeco = editor.createDecorationsCollection()

    editor.onDidChangeModelContent(() => {
      if (ignoreChanges) return
      emit('update:code', editor?.getValue())
    })

    // Submit: Ctrl+Shift+T
    editor.addAction({
      id: 'submit-sql',
      label: '提交到数据库',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyT],
      contextMenuGroupId: '9_sql',
      contextMenuOrder: 0,
      run: () => emit('submit')
    })

    // Format: Ctrl+Shift+L
    editor.addAction({
      id: 'format-sql',
      label: '格式化 SQL',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyL],
      contextMenuGroupId: '9_sql',
      contextMenuOrder: 1,
      run: () => formatSql()
    })

    // Import
    editor.addAction({
      id: 'import-sql',
      label: '导入 .sql 文件',
      contextMenuGroupId: '9_sql',
      contextMenuOrder: 2,
      run: () => onImportClick?.()
    })

    // Export current tab
    editor.addAction({
      id: 'export-tab',
      label: '导出当前标签页',
      contextMenuGroupId: '9_sql',
      contextMenuOrder: 3,
      run: () => emit('export-tab')
    })

    // Export all tabs
    editor.addAction({
      id: 'export-all',
      label: '导出全部标签页',
      contextMenuGroupId: '9_sql',
      contextMenuOrder: 4,
      run: () => emit('export-all')
    })

    // AI context menu actions
    if (deps.ai) {
      editor.addAction({
        id: 'ai-send-selection',
        label: '💬 发送选中代码到 AI 对话',
        contextMenuGroupId: '9_sql',
        contextMenuOrder: 10,
        run: () => {
          const sel = editor?.getModel()?.getValueInRange(editor.getSelection()!)
          if (sel?.trim()) {
            deps.ai?.sendToAi(`请帮我看看这段 SQL：\n\n\`\`\`sql\n${sel.trim()}\n\`\`\``)
          }
        }
      })

      editor.addAction({
        id: 'ai-generate-sql',
        label: '✨ AI 帮我写 SQL',
        contextMenuGroupId: '9_sql',
        contextMenuOrder: 11,
        run: () => deps.ai?.sendToAi('请帮我写一段 SQL 查询。')
      })

      editor.addAction({
        id: 'ai-open-chat',
        label: '🤖 打开 AI 对话',
        contextMenuGroupId: '9_sql',
        contextMenuOrder: 12,
        run: () => deps.ai?.onOpenChat()
      })
    }

    applyHighlight(deps.highlightChunk.value)
    applyErrorMarkers(deps.error.value)
  }

  function syncCode(newVal: string) {
    if (!editor) return
    const currentVal = editor.getValue()
    if (currentVal === newVal) return
    ignoreChanges = true
    const selections = editor.getSelections()
    editor.setValue(newVal)
    if (selections) {
      const model = editor.getModel()!
      const lineCount = model.getLineCount()
      const restored = selections.map((s) => {
        const line = Math.min(s.selectionStartLineNumber, lineCount)
        const col = Math.min(s.selectionStartColumn, model.getLineMaxColumn(line))
        return new monaco.Selection(line, col, line, col)
      })
      editor.setSelections(restored)
    }
    ignoreChanges = false
  }

  let flashTimeout: ReturnType<typeof setTimeout> | null = null

  function onHighlightChunkChange(chunk: string | null) {
    if (flashTimeout) {
      clearTimeout(flashTimeout)
      flashTimeout = null
    }
    applyHighlight(chunk)
    if (chunk) {
      flashTimeout = setTimeout(() => {
        highlightDeco?.clear()
        flashTimeout = null
      }, 1000)
    }
  }

  function dispose() {
    if (flashTimeout) clearTimeout(flashTimeout)
    highlightDeco?.clear()
    editor?.dispose()
    editor = null
    highlightDeco = null
  }

  // Watchers
  watch(() => deps.highlightChunk.value, onHighlightChunkChange)
  watch(() => deps.error.value, applyErrorMarkers)

  return { create, formatSql, syncCode, dispose }
}
