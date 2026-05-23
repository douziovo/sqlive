import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { KEYWORD_TOPIC_MAP, TOPIC_LABELS, TOPIC_DIFFICULTY, DIFF_LABELS, NEXT_TOPICS } from './sqlTopics';

export interface SchemaTableInfo {
  name: string;
  type: 'table' | 'view';
  columns: string[];
}

export interface QuickFixCallbacks {
  onAnalyzeError: (error: { line: number; message: string }) => void;
  onFixCode: () => void;
  onExplain: (code: string) => void;
  onOptimize: (code: string) => void;
  onOpenChat: (context?: string) => void;
  onGenerateSql: () => void;
  onShowKnowledgeCard?: (topicId: string) => void;
  onShowTableSchema?: (tableName: string) => void;
  onNavigateToTable?: (tableName: string) => void;
  getSchemaTables: () => SchemaTableInfo[];
}

/**
 * Register the AI QuickFix CodeActionProvider for SQL language in Monaco.
 * Call this in CodeEditor.vue's onMounted with the monaco instance.
 */
export function registerAiQuickFix(
  _m: typeof monaco,
  _editor: monaco.editor.IStandaloneCodeEditor,
  callbacks: QuickFixCallbacks,
): monaco.IDisposable {

  const SQL_KEYWORDS = Object.keys(KEYWORD_TOPIC_MAP);

  return _m.languages.registerCodeActionProvider('sql', {
    provideCodeActions(model, range, context) {
      const actions: monaco.languages.CodeAction[] = [];
      const markers = context.markers.filter(m => m.severity === _m.MarkerSeverity.Error);
      const selection = model.getValueInRange(range);
      const pos = range.getStartPosition();

      // ──── Scene 1: execution error markers ────
      if (markers.length > 0) {
        const marker = markers[0];
        actions.push({
          title: '💡 AI 分析此错误',
          kind: 'quickfix',
          diagnostics: [marker],
          command: {
            id: 'ai.analyzeError',
            title: 'AI 分析此错误',
            arguments: [{ line: marker.startLineNumber, message: marker.message }],
          },
          isAI: true,
        } as monaco.languages.CodeAction);
        actions.push({
          title: '🔧 AI 修复代码',
          kind: 'quickfix',
          diagnostics: [marker],
          command: { id: 'ai.fixCode', title: 'AI 修复代码' },
          isAI: true,
        } as monaco.languages.CodeAction);

        // Related knowledge topics from the SQL context
        const fullSql = model.getValue();
        const matchedTopics = matchTopicsFromSql(fullSql, 2);
        if (matchedTopics.length > 0) {
          for (const topic of matchedTopics) {
            const label = TOPIC_LABELS[topic] || topic;
            const diff = DIFF_LABELS[TOPIC_DIFFICULTY[topic]] || '基础';
            actions.push({
              title: `📚 ${label} (${diff})`,
              kind: 'quickfix',
              command: { id: 'ai.showKnowledgeCard', title: `学习：${label}`, arguments: [topic] },
              isAI: true,
            } as monaco.languages.CodeAction);
          }
        }
      }

      // ──── Scene 2: text selected ────
      if (selection.trim().length > 0 && markers.length === 0) {
        actions.push({
          title: '📖 AI 解释这段 SQL',
          kind: 'refactor',
          command: { id: 'ai.explainSelection', title: 'AI 解释这段 SQL' },
          isAI: true,
        } as monaco.languages.CodeAction);
        actions.push({
          title: '⚡ AI 优化这段 SQL',
          kind: 'refactor',
          command: { id: 'ai.optimizeSelection', title: 'AI 优化这段 SQL' },
          isAI: true,
        } as monaco.languages.CodeAction);
        actions.push({
          title: '💬 发送到 AI 对话',
          kind: 'quickfix',
          command: { id: 'ai.openChatWithSelection', title: '发送到 AI 对话' },
          isAI: true,
        } as monaco.languages.CodeAction);
      }

      // ──── Scene 3: cursor on table/column name ────
      const word = model.getWordAtPosition(pos);
      if (word?.word) {
        const tables = callbacks.getSchemaTables();
        const match = tables.find(t => t.name.toLowerCase() === word.word.toLowerCase());
        if (match) {
          actions.push({
            title: `📋 查看 "${match.name}" 的结构`,
            kind: 'quickfix',
            command: { id: 'ai.showTableSchema', title: `查看 ${match.name} 结构`, arguments: [match.name] },
            isAI: true,
          } as monaco.languages.CodeAction);
          if (match.type === 'table') {
            actions.push({
              title: '🔗 在数据面板中打开',
              kind: 'quickfix',
              command: { id: 'ai.navigateToTable', title: '在数据面板中打开', arguments: [match.name] },
              isAI: true,
            } as monaco.languages.CodeAction);
          }
        }
      }

      // ──── Scene 4: cursor on SQL keyword ────
      if (actions.length <= 3) { // Don't overwhelm if already have error/scene3 actions
        const keywordAtCursor = detectKeywordAtCursor(model, pos, SQL_KEYWORDS);
        if (keywordAtCursor) {
          const topicId = KEYWORD_TOPIC_MAP[keywordAtCursor.toUpperCase()];
          if (topicId) {
            const topicLabel = TOPIC_LABELS[topicId] || topicId;
            actions.push({
              title: `📖 AI 解释 ${keywordAtCursor} 用法`,
              kind: 'quickfix',
              command: { id: 'ai.explainKeyword', title: `解释 ${keywordAtCursor}`, arguments: [keywordAtCursor] },
              isAI: true,
            } as monaco.languages.CodeAction);
            actions.push({
              title: `📚 学习：${topicLabel}`,
              kind: 'quickfix',
              command: { id: 'ai.showKnowledgeCard', title: `学习：${topicLabel}`, arguments: [topicId] },
              isAI: true,
            } as monaco.languages.CodeAction);

            const nextTopics = NEXT_TOPICS[topicId] || [];
            for (const nt of nextTopics.slice(0, 2)) {
              const ntLabel = TOPIC_LABELS[nt] || nt;
              actions.push({
                title: `➡️ 推荐下一步：${ntLabel}`,
                kind: 'quickfix',
                command: { id: 'ai.showKnowledgeCard', title: `推荐：${ntLabel}`, arguments: [nt] },
                isAI: true,
              } as monaco.languages.CodeAction);
            }
          }
        }
      }

      // ──── Scene 5: fallback / always visible ────
      if (actions.length === 0) {
        actions.push({
          title: '✨ AI 帮我写 SQL',
          kind: 'quickfix',
          command: { id: 'ai.generateSql', title: 'AI 帮我写 SQL' },
          isAI: true,
        } as monaco.languages.CodeAction);
      }
      actions.push({
        title: '💬 打开 AI 对话',
        kind: 'quickfix',
        command: { id: 'ai.openChat', title: '打开 AI 对话' },
        isAI: true,
      } as monaco.languages.CodeAction);

      return { actions, dispose: () => {} };
    },
  });
}

/**
 * Register command handlers for all AI QuickFix actions.
 */
export function registerAiCommands(
  _editor: monaco.editor.IStandaloneCodeEditor,
  callbacks: QuickFixCallbacks,
): monaco.IDisposable[] {
  const disposables: monaco.IDisposable[] = [];

  // Handler map for code action command execution via CommandsRegistry
  const commandHandlers = new Map<string, (...args: any[]) => void>();

  const addCmd = (id: string, handler: (...args: any[]) => void) => {
    commandHandlers.set(id, handler);
    // Also register as editor action for keybinding/context-menu support
    disposables.push(_editor.addAction({
      id,
      label: id,
      run: () => { handler(); },
    }));
  };

  addCmd('ai.analyzeError', (line?: number, message?: string) => {
    if (line && message) {
      callbacks.onAnalyzeError({ line, message });
    } else {
      const markers = monaco.editor.getModelMarkers({}).filter(m => m.severity === 8);
      if (markers.length > 0) {
        callbacks.onAnalyzeError({ line: markers[0].startLineNumber, message: markers[0].message });
      }
    }
  });
  addCmd('ai.fixCode', () => callbacks.onFixCode());
  addCmd('ai.explainSelection', () => {
    const sel = _editor.getModel()?.getValueInRange(_editor.getSelection()!);
    if (sel) callbacks.onExplain(sel);
  });
  addCmd('ai.optimizeSelection', () => {
    const sel = _editor.getModel()?.getValueInRange(_editor.getSelection()!);
    if (sel) callbacks.onOptimize(sel);
  });
  addCmd('ai.openChat', () => callbacks.onOpenChat());
  addCmd('ai.openChatWithSelection', () => {
    const sel = _editor.getModel()?.getValueInRange(_editor.getSelection()!);
    callbacks.onOpenChat(sel || undefined);
  });
  addCmd('ai.generateSql', () => callbacks.onGenerateSql());
  addCmd('ai.showKnowledgeCard', (_topicId?: string) => { /* handled via arguments */ });
  addCmd('ai.showTableSchema', (_tableName?: string) => { /* handled via arguments */ });
  addCmd('ai.navigateToTable', (_tableName?: string) => { /* handled via arguments */ });
  addCmd('ai.explainKeyword', (_keyword?: string) => { /* handled via arguments */ });

  // Register commands with Monaco's CommandsRegistry so code action command
  // execution can find them by exact ID (editor.addAction uses prefixed IDs
  // which commandService.executeCommand can't resolve).
  try {
    // @ts-expect-error require is available in Monaco's bundled context
    const { CommandsRegistry } = require('monaco-editor/esm/vs/platform/commands/common/commands');
    for (const [id, handler] of commandHandlers) {
      if (!CommandsRegistry.getCommand(id)) {
        CommandsRegistry.registerCommand({ id, handler: (_accessor: unknown, ...args: any[]) => handler(...args) });
      }
    }
  } catch {
    // Fallback: monkey-patch commandService if CommandsRegistry is not accessible
    const cmdService = (_editor as any)._commandService;
    if (cmdService) {
      const originalExecute = cmdService.executeCommand?.bind(cmdService);
      if (originalExecute) {
        cmdService.executeCommand = (id: string, ...args: any[]) => {
          const h = commandHandlers.get(id);
          if (h) return h(...args);
          return originalExecute(id, ...args);
        };
      }
    }
  }

  return disposables;
}

// ── Helper functions ────────────────────────────────────────────

function matchTopicsFromSql(sql: string, limit: number): string[] {
  const upper = sql.toUpperCase();
  const results: string[] = [];
  for (const [keyword, topicId] of Object.entries(KEYWORD_TOPIC_MAP)) {
    if (upper.includes(keyword.toUpperCase())) {
      if (!results.includes(topicId)) {
        results.push(topicId);
        if (results.length >= limit) break;
      }
    }
  }
  return results;
}

function detectKeywordAtCursor(
  model: monaco.editor.ITextModel,
  pos: monaco.Position,
  keywords: string[],
): string | null {
  // Check multi-word keywords first (e.g., "GROUP BY", "LEFT JOIN")
  for (const kw of keywords.sort((a, b) => b.length - a.length)) {
    if (!kw.includes(' ')) continue;
    const line = model.getLineContent(pos.lineNumber);
    const lineUpper = line.toUpperCase();
    let idx = 0;
    while ((idx = lineUpper.indexOf(kw, idx)) !== -1) {
      const startCol = idx + 1;
      const endCol = idx + kw.length + 1;
      if (pos.column >= startCol && pos.column <= endCol) return kw;
      idx += kw.length;
    }
  }
  // Single word
  const word = model.getWordAtPosition(pos);
  if (word && keywords.includes(word.word.toUpperCase())) {
    return word.word.toUpperCase();
  }
  return null;
}

// Re-export for component use
export { TOPIC_LABELS, TOPIC_DIFFICULTY, DIFF_LABELS, NEXT_TOPICS };
