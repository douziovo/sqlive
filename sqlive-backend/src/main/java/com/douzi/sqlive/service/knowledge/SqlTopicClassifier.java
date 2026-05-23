package com.douzi.sqlive.service.knowledge;

import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Pattern;

@Service
public class SqlTopicClassifier {

    // Injected by KnowledgeGraphService and populated from knowledge-graph.json
    private volatile Map<String, CompiledNodeData> compiledNodes = Map.of();

    public void setKnowledgeNodes(Map<String, KnowledgeNodeData> nodes) {
        Map<String, CompiledNodeData> compiled = new LinkedHashMap<>();
        for (var entry : nodes.entrySet()) {
            var node = entry.getValue();
            List<String> upperKeywords = node.keywords().stream()
                    .map(String::toUpperCase).toList();
            List<Pattern> compiledPatterns = new ArrayList<>();
            for (String pat : node.patterns()) {
                try {
                    compiledPatterns.add(Pattern.compile(pat, Pattern.CASE_INSENSITIVE));
                } catch (Exception ignored) {
                    // Invalid regex, skip
                }
            }
            compiled.put(entry.getKey(), new CompiledNodeData(upperKeywords, compiledPatterns));
        }
        this.compiledNodes = compiled;
    }

    public List<ScoredTopic> classify(String sql) {
        if (sql == null || sql.isBlank() || compiledNodes.isEmpty()) {
            return List.of();
        }

        String upperSql = sql.toUpperCase().strip();
        List<ScoredTopic> results = new ArrayList<>();

        for (var entry : compiledNodes.entrySet()) {
            var node = entry.getValue();
            double score = 0.0;

            // Keyword match (weight: 0.6)
            int keywordMatches = 0;
            for (String upperKw : node.upperKeywords()) {
                if (upperSql.contains(upperKw)) {
                    keywordMatches++;
                }
            }
            if (!node.upperKeywords().isEmpty()) {
                score += 0.6 * keywordMatches / node.upperKeywords().size();
            }

            // Pattern match (weight: 0.4)
            int patternMatches = 0;
            for (Pattern pattern : node.compiledPatterns()) {
                if (pattern.matcher(sql).find()) {
                    patternMatches++;
                }
            }
            if (!node.compiledPatterns().isEmpty()) {
                score += 0.4 * patternMatches / node.compiledPatterns().size();
            }

            if (score > 0.15) {
                results.add(new ScoredTopic(entry.getKey(), Math.min(score, 1.0)));
            }
        }

        results.sort((a, b) -> Double.compare(b.score, a.score));
        return results.size() > 3 ? results.subList(0, 3) : results;
    }

    /** Simple keyword-based classification for the knowledge graph */
    public record ScoredTopic(String id, double score) {}

    /** Data passed from KnowledgeGraphService */
    public record KnowledgeNodeData(String id, List<String> keywords, List<String> patterns) {}

    /** Pre-compiled patterns and pre-uppercased keywords for efficient classification */
    private record CompiledNodeData(List<String> upperKeywords, List<Pattern> compiledPatterns) {}
}
