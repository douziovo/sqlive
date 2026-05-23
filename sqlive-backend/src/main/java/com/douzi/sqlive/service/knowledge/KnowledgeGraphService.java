package com.douzi.sqlive.service.knowledge;

import com.douzi.sqlive.dto.ai.SuggestRequest;
import com.douzi.sqlive.dto.ai.SuggestResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

@Service
@Slf4j
public class KnowledgeGraphService {

    private final Map<String, KnowledgeNode> nodes = new LinkedHashMap<>();
    private final SqlTopicClassifier classifier;
    private final ObjectMapper objectMapper;

    public KnowledgeGraphService(SqlTopicClassifier classifier, ObjectMapper objectMapper) {
        this.classifier = classifier;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    public void load() {
        try {
            InputStream is = getClass().getClassLoader().getResourceAsStream("knowledge-graph.json");
            if (is == null) {
                log.warn("knowledge-graph.json not found, knowledge graph disabled");
                return;
            }
            JsonNode root = objectMapper.readTree(is);
            for (var node : root.path("nodes")) {
                var kn = new KnowledgeNode();
                kn.setId(node.path("id").asText());
                kn.setLabel(node.path("label").asText());
                kn.setDescription(node.path("description").asText());
                kn.setDifficulty(node.path("difficulty").asInt(1));
                kn.setCategory(node.path("category").asText());

                kn.setKeywords(readStringList(node, "keywords"));
                kn.setPatterns(readStringList(node, "patterns"));
                kn.setPrerequisites(readStringList(node, "prerequisites"));
                kn.setNextTopics(readStringList(node, "nextTopics"));

                nodes.put(kn.getId(), kn);
            }
            log.info("Knowledge graph loaded: {} nodes", nodes.size());

            // Wire nodes into the classifier for topic detection
            Map<String, SqlTopicClassifier.KnowledgeNodeData> classifierData = new LinkedHashMap<>();
            for (var entry : nodes.entrySet()) {
                classifierData.put(entry.getKey(), new SqlTopicClassifier.KnowledgeNodeData(
                        entry.getValue().getId(),
                        entry.getValue().getKeywords(),
                        entry.getValue().getPatterns()
                ));
            }
            classifier.setKnowledgeNodes(classifierData);
        } catch (Exception e) {
            log.error("Failed to load knowledge graph", e);
        }
    }

    public SuggestResponse generateSuggestions(SuggestRequest request) {
        var resp = new SuggestResponse();
        resp.setSuccess(true);
        var data = new SuggestResponse.DataPayload();

        // Classify current topics from SQL
        List<SqlTopicClassifier.ScoredTopic> currentTopics;
        if (request.getCurrentSql() != null && !request.getCurrentSql().isBlank()) {
            currentTopics = classifier.classify(request.getCurrentSql());
        } else {
            currentTopics = List.of();
        }

        // Map to TopicInfo
        data.setCurrentTopics(currentTopics.stream()
                .map(t -> {
                    var info = new SuggestResponse.DataPayload.TopicInfo();
                    var node = nodes.get(t.id());
                    info.setId(t.id());
                    info.setLabel(node != null ? node.getLabel() : t.id());
                    info.setConfidence(t.score());
                    return info;
                }).collect(Collectors.toList()));

        // Generate suggestions from nextTopics
        Set<String> masteredSet = new HashSet<>();
        if (request.getMasteredTopics() != null) {
            masteredSet.addAll(request.getMasteredTopics());
        }

        Set<String> suggestedIds = new LinkedHashSet<>();
        for (var ct : currentTopics) {
            var node = nodes.get(ct.id());
            if (node != null && node.getNextTopics() != null) {
                for (var nextId : node.getNextTopics()) {
                    if (!masteredSet.contains(nextId)) {
                        suggestedIds.add(nextId);
                    }
                }
            }
        }

        // If no current topics found, suggest basics
        if (suggestedIds.isEmpty()) {
            for (var node : nodes.values()) {
                if (node.getDifficulty() <= 2 && !masteredSet.contains(node.getId())) {
                    suggestedIds.add(node.getId());
                    if (suggestedIds.size() >= 3) break;
                }
            }
        }

        var suggestions = suggestedIds.stream()
                .map(id -> {
                    var node = nodes.get(id);
                    var s = new SuggestResponse.DataPayload.Suggestion();
                    s.setId(id);
                    if (node != null) {
                        s.setLabel(node.getLabel());
                        s.setDifficulty(node.getDifficulty());
                        s.setPrerequisites(node.getPrerequisites());
                        s.setReason("在掌握当前内容后，" + node.getLabel() + "是自然的下一步学习内容");
                    } else {
                        s.setLabel(id);
                        s.setDifficulty(1);
                        s.setPrerequisites(List.of());
                        s.setReason("推荐学习此知识点");
                    }
                    return s;
                })
                .sorted(Comparator.comparingInt(SuggestResponse.DataPayload.Suggestion::getDifficulty))
                .limit(3)
                .collect(Collectors.toList());

        data.setSuggestions(suggestions);
        resp.setData(data);
        return resp;
    }

    private List<String> readStringList(JsonNode parent, String field) {
        return StreamSupport.stream(parent.path(field).spliterator(), false)
                .map(JsonNode::asText).collect(Collectors.toList());
    }

    /** Data class representing a node in the knowledge graph */
    @lombok.Data
    public static class KnowledgeNode {
        private String id;
        private String label;
        private String description;
        private List<String> keywords;
        private List<String> patterns;
        private int difficulty;
        private List<String> prerequisites;
        private List<String> nextTopics;
        private String category;
    }
}
