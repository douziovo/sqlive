package com.douzi.sqlive.service.knowledge;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class KnowledgeGraphServiceTest {

	private final ObjectMapper realMapper = new ObjectMapper();

	@Test
	void shouldLoadNodesFromValidJson() {
		var service = new KnowledgeGraphService(realMapper);
		service.load();
		var nodes = service.getAllNodes();
		assertFalse(nodes.isEmpty(), "Should load nodes from knowledge-graph.json");
		var selectNode = nodes.stream().filter(n -> "select".equals(n.getId())).findFirst();
		assertTrue(selectNode.isPresent());
		assertEquals("SELECT", selectNode.get().getLabel());
		assertEquals(1, selectNode.get().getDifficulty());
		assertFalse(selectNode.get().getKeywords().isEmpty());
		assertFalse(selectNode.get().getPrerequisites().isEmpty());
	}

	@Test
	void shouldReturnEmptyListWhenLoadNotCalled() {
		var service = new KnowledgeGraphService(realMapper);
		var nodes = service.getAllNodes();
		assertTrue(nodes.isEmpty(), "Should return empty list before load() is called");
	}

	@Test
	void shouldHandleMalformedJsonGracefully() throws Exception {
		var mockMapper = mock(ObjectMapper.class);
		when(mockMapper.readTree(any(java.io.InputStream.class)))
				.thenThrow(new JacksonException("bad json") {
				});

		var service = new KnowledgeGraphService(mockMapper);
		service.load();
		assertTrue(service.getAllNodes().isEmpty(), "Should return empty nodes on parse error");
	}

	@Test
	void shouldHandleEmptyNodesArray() throws Exception {
		// Load service with the real resource (has 2 nodes), then verify we can also handle empty
		var service = new KnowledgeGraphService(realMapper);
		service.load();
		// The real resource has 2 nodes, so this verifies normal load works
		assertEquals(2, service.getAllNodes().size());

		// For empty array: create a service with a mock that returns empty nodes
		var mockMapper = mock(ObjectMapper.class);
		var emptyRoot = new ObjectMapper().readTree("{\"nodes\": []}");
		when(mockMapper.readTree(any(java.io.InputStream.class))).thenReturn(emptyRoot);

		var emptyService = new KnowledgeGraphService(mockMapper);
		emptyService.load();
		assertTrue(emptyService.getAllNodes().isEmpty());
	}
}
