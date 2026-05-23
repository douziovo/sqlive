import { describe, it, expect, vi } from 'vitest';

vi.mock('monaco-editor', () => {
    const noop = () => {};
    return {
        default: {},
        MarkerSeverity: { Error: 8, Warning: 4, Hint: 2 },
        languages: {
            registerCodeActionProvider: vi.fn(() => ({ dispose: noop })),
            CodeAction: {},
        },
        editor: {
            getModelMarkers: vi.fn(() => []),
            IStandaloneCodeEditor: {},
            IDisposable: {},
            ITextModel: {},
            addAction: vi.fn(() => ({ dispose: noop })),
        },
        Position: class {
            lineNumber: number;
            column: number;
            constructor(lineNumber: number, column: number) {
                this.lineNumber = lineNumber;
                this.column = column;
            }
        },
        Range: class {
            startLineNumber: number;
            startColumn: number;
            endLineNumber: number;
            endColumn: number;
            constructor(
                startLineNumber: number,
                startColumn: number,
                endLineNumber: number,
                endColumn: number,
            ) {
                this.startLineNumber = startLineNumber;
                this.startColumn = startColumn;
                this.endLineNumber = endLineNumber;
                this.endColumn = endColumn;
            }
            getStartPosition() {
                return new (0 as any)(1, 1);
            }
        },
        IDisposable: {},
    };
});

import { TOPIC_LABELS, TOPIC_DIFFICULTY, DIFF_LABELS, NEXT_TOPICS } from '@/utils/aiQuickFix';

describe('aiQuickFix re-exports', () => {
    it('exports TOPIC_LABELS with known entries', () => {
        expect(TOPIC_LABELS['sql-basics']).toBeDefined();
        expect(TOPIC_LABELS['joins']).toBeDefined();
        expect(TOPIC_LABELS['aggregation']).toBeDefined();
    });

    it('exports TOPIC_DIFFICULTY with values 1-3', () => {
        const diffs = Object.values(TOPIC_DIFFICULTY);
        expect(diffs.length).toBeGreaterThan(0);
        for (const diff of diffs) {
            expect(diff).toBeGreaterThanOrEqual(1);
            expect(diff).toBeLessThanOrEqual(3);
        }
    });

    it('exports DIFF_LABELS mapping difficulties to Chinese labels', () => {
        expect(DIFF_LABELS[1]).toBeDefined();
        expect(DIFF_LABELS[2]).toBeDefined();
        expect(DIFF_LABELS[3]).toBeDefined();
    });

    it('exports NEXT_TOPICS with valid topic references', () => {
        const allTopics = new Set([
            ...Object.keys(TOPIC_LABELS),
            ...Object.keys(TOPIC_DIFFICULTY),
        ]);
        for (const nextList of Object.values(NEXT_TOPICS)) {
            for (const nextTopic of nextList) {
                expect(allTopics.has(nextTopic)).toBe(true);
            }
        }
    });
});
