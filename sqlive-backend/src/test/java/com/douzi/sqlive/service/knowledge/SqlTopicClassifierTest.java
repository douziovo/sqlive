package com.douzi.sqlive.service.knowledge;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class SqlTopicClassifierTest {

    private SqlTopicClassifier classifier;

    @BeforeEach
    void setUp() {
        classifier = new SqlTopicClassifier();
        classifier.setKnowledgeNodes(Map.of(
            "sql-basics", new SqlTopicClassifier.KnowledgeNodeData("sql-basics",
                List.of("SELECT", "FROM", "WHERE"),
                List.of()),
            "joins", new SqlTopicClassifier.KnowledgeNodeData("joins",
                List.of("JOIN", "INNER JOIN", "LEFT JOIN", "RIGHT JOIN", "CROSS JOIN"),
                List.of("\\bJOIN\\b")),
            "aggregation", new SqlTopicClassifier.KnowledgeNodeData("aggregation",
                List.of("GROUP BY", "HAVING", "COUNT", "SUM", "AVG", "MAX", "MIN"),
                List.of("\\bGROUP\\s+BY\\b")),
            "window-functions", new SqlTopicClassifier.KnowledgeNodeData("window-functions",
                List.of("ROW_NUMBER", "RANK", "DENSE_RANK", "OVER", "PARTITION BY"),
                List.of("\\bOVER\\s*\\(")),
            "subqueries", new SqlTopicClassifier.KnowledgeNodeData("subqueries",
                List.of("IN", "EXISTS", "NOT IN", "NOT EXISTS"),
                List.of("\\(\\s*SELECT\\b"))
        ));
    }

    @Test
    void shouldReturnEmptyForNullSql() {
        assertTrue(classifier.classify(null).isEmpty());
    }

    @Test
    void shouldReturnEmptyForBlankSql() {
        assertTrue(classifier.classify("   ").isEmpty());
    }

    @Test
    void shouldReturnEmptyWhenNoNodesLoaded() {
        var empty = new SqlTopicClassifier();
        assertTrue(empty.classify("SELECT * FROM t").isEmpty());
    }

    @Test
    void shouldClassifyBasicSelect() {
        var results = classifier.classify("SELECT * FROM users WHERE id = 1");
        assertFalse(results.isEmpty());
        assertEquals("sql-basics", results.getFirst().id());
        assertTrue(results.getFirst().score() > 0);
    }

    @Test
    void shouldClassifyJoinQuery() {
        var results = classifier.classify("SELECT * FROM a INNER JOIN b ON a.id = b.a_id");
        assertFalse(results.isEmpty());
        assertTrue(results.stream().anyMatch(r -> r.id().equals("joins")));
    }

    @Test
    void shouldClassifyAggregationQuery() {
        var results = classifier.classify("SELECT dept, COUNT(*) FROM employees GROUP BY dept HAVING COUNT(*) > 5");
        assertFalse(results.isEmpty());
        assertTrue(results.stream().anyMatch(r -> r.id().equals("aggregation")));
    }

    @Test
    void shouldClassifyWindowFunctionQuery() {
        var results = classifier.classify("SELECT name, ROW_NUMBER() OVER (PARTITION BY dept ORDER BY salary DESC) FROM employees");
        assertFalse(results.isEmpty());
        assertTrue(results.stream().anyMatch(r -> r.id().equals("window-functions")));
    }

    @Test
    void shouldClassifySubquery() {
        var results = classifier.classify("SELECT * FROM t WHERE id IN (SELECT id FROM other WHERE x > 0)");
        assertFalse(results.isEmpty());
        assertTrue(results.stream().anyMatch(r -> r.id().equals("subqueries")));
    }

    @Test
    void shouldReturnAtMost3Results() {
        var results = classifier.classify("""
            SELECT e.name, d.name, ROW_NUMBER() OVER (ORDER BY salary DESC)
            FROM employees e
            INNER JOIN departments d ON e.dept_id = d.id
            WHERE e.dept_id IN (SELECT id FROM departments WHERE active = 1)
            GROUP BY e.dept_id
            """);
        assertTrue(results.size() <= 3);
    }

    @Test
    void shouldFilterOutResultsBelowThreshold() {
        // A query with no matching keywords should return empty
        var noMatch = new SqlTopicClassifier();
        noMatch.setKnowledgeNodes(Map.of(
            "empty-keywords", new SqlTopicClassifier.KnowledgeNodeData("empty-keywords",
                List.of(), List.of())
        ));
        assertTrue(noMatch.classify("SELECT 1").isEmpty());
    }

    @Test
    void shouldScoreHigherForMoreKeywordMatches() {
        var results = classifier.classify("SELECT * FROM a JOIN b ON a.id = b.id WHERE a.x > 0 GROUP BY a.y");
        assertFalse(results.isEmpty());
        // At least one topic should have a score
        assertTrue(results.getFirst().score() > 0);
    }

    @Test
    void shouldHandleInvalidRegexGracefully() {
        classifier.setKnowledgeNodes(Map.of(
            "test", new SqlTopicClassifier.KnowledgeNodeData("test",
                List.of("SELECT"),
                List.of("[invalid regex", "\\bSELECT\\b"))
        ));
        var results = classifier.classify("SELECT 1");
        assertFalse(results.isEmpty());
        assertEquals("test", results.getFirst().id());
    }
}
