package com.douzi.sqlive.controller;

import com.douzi.sqlive.service.knowledge.KnowledgeGraphService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/knowledge")
@RequiredArgsConstructor
@Slf4j
public class KnowledgeController {

    private final KnowledgeGraphService knowledgeGraphService;

    @GetMapping("/graph")
    public Map<String, Object> getGraph() {
        var nodes = knowledgeGraphService.getAllNodes();
        return Map.of("topics", nodes);
    }
}
