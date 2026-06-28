package com.douzi.sqlive.service.knowledge;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

@Service
@Slf4j
public class KnowledgeGraphService {

	private final Map<String, KnowledgeNode> nodes = new LinkedHashMap<>();
	private final ObjectMapper objectMapper;

	public KnowledgeGraphService(ObjectMapper objectMapper) {
		this.objectMapper = objectMapper;
	}

	@PostConstruct
	public void load() {
		try {
			try (InputStream is = getClass().getClassLoader().getResourceAsStream("knowledge-graph.json")) {
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
			}
		} catch (Exception e) {
			log.error("Failed to load knowledge graph", e);
		}
	}

	public List<KnowledgeNode> getAllNodes() {
		return new ArrayList<>(nodes.values());
	}

	private List<String> readStringList(JsonNode parent, String field) {
		return StreamSupport.stream(parent.path(field).spliterator(), false)
				.map(JsonNode::asText).collect(Collectors.toList());
	}

	/**
	 * Data class representing a node in the knowledge graph
	 */
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
