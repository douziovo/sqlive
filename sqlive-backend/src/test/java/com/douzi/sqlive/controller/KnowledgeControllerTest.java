package com.douzi.sqlive.controller;

import com.douzi.sqlive.service.knowledge.KnowledgeGraphService;
import com.douzi.sqlive.service.knowledge.KnowledgeGraphService.KnowledgeNode;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class KnowledgeControllerTest {

    @Value("${local.server.port}")
    private int port;

    private final RestTemplate restTemplate = new RestTemplate();

    @TestConfiguration
    static class MockConfig {
        @Bean
        @Primary
        KnowledgeGraphService mockKnowledgeGraphService() {
            return mock(KnowledgeGraphService.class);
        }
    }

    @Autowired
    private KnowledgeGraphService knowledgeGraphService;

    @Test
    @SuppressWarnings("unchecked")
    void shouldReturnTopics() {
        var node = new KnowledgeNode();
        node.setId("select");
        node.setLabel("SELECT");
        node.setDifficulty(1);
        when(knowledgeGraphService.getAllNodes()).thenReturn(List.of(node));

        ResponseEntity<Map<String, Object>> resp = (ResponseEntity<Map<String, Object>>) (ResponseEntity<?>) restTemplate.getForEntity(
                "http://localhost:" + port + "/api/knowledge/graph", Map.class);

        assertEquals(HttpStatus.OK, resp.getStatusCode());
        assertNotNull(resp.getBody());
        assertTrue(resp.getBody().containsKey("topics"));
        List<Map<String, Object>> topics = (List<Map<String, Object>>) resp.getBody().get("topics");
        assertEquals(1, topics.size());
        assertEquals("select", topics.get(0).get("id"));
        assertEquals("SELECT", topics.get(0).get("label"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void shouldReturnEmptyTopicsWhenNoNodes() {
        when(knowledgeGraphService.getAllNodes()).thenReturn(List.of());

        ResponseEntity<Map<String, Object>> resp = (ResponseEntity<Map<String, Object>>) (ResponseEntity<?>) restTemplate.getForEntity(
                "http://localhost:" + port + "/api/knowledge/graph", Map.class);

        assertEquals(HttpStatus.OK, resp.getStatusCode());
        assertNotNull(resp.getBody());
        List<Map<String, Object>> topics = (List<Map<String, Object>>) resp.getBody().get("topics");
        assertNotNull(topics);
        assertTrue(topics.isEmpty());
    }
}
