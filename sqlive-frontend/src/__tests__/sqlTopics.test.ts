import { describe, it, expect } from 'vitest';
import {
    KEYWORD_TOPIC_MAP, TOPIC_LABELS, TOPIC_DIFFICULTY, NEXT_TOPICS,
} from '../utils/sqlTopics';

describe('sqlTopics data integrity', () => {
    it('KEYWORD_TOPIC_MAP maps common SQL keywords to topics', () => {
        expect(KEYWORD_TOPIC_MAP['SELECT']).toBe('sql-basics');
        expect(KEYWORD_TOPIC_MAP['LEFT JOIN']).toBe('joins');
        expect(KEYWORD_TOPIC_MAP['GROUP BY']).toBe('aggregation');
        expect(KEYWORD_TOPIC_MAP['COUNT']).toBe('aggregation');
        expect(KEYWORD_TOPIC_MAP['INSERT']).toBe('insert');
        expect(KEYWORD_TOPIC_MAP['CREATE TABLE']).toBe('create-table');
    });

    it('TOPIC_LABELS has labels for all topics in KEYWORD_TOPIC_MAP', () => {
        const topicIds = new Set(Object.values(KEYWORD_TOPIC_MAP));
        for (const topicId of topicIds) {
            expect(TOPIC_LABELS[topicId]).toBeDefined();
        }
    });

    it('TOPIC_DIFFICULTY has difficulties for all known topics', () => {
        const topicIds = new Set([
            ...Object.values(KEYWORD_TOPIC_MAP),
            ...Object.keys(NEXT_TOPICS),
        ]);
        for (const topicId of topicIds) {
            expect(TOPIC_DIFFICULTY[topicId]).toBeDefined();
        }
    });

    it('NEXT_TOPICS references only valid topics', () => {
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

    it('TOPIC_DIFFICULTY values are in range 1-3', () => {
        for (const diff of Object.values(TOPIC_DIFFICULTY)) {
            expect(diff).toBeGreaterThanOrEqual(1);
            expect(diff).toBeLessThanOrEqual(3);
        }
    });
});
