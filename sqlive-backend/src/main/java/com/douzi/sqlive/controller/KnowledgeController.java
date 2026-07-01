package com.douzi.sqlive.controller;

import com.douzi.sqlive.service.knowledge.KnowledgeGraphService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/knowledge")
@RequiredArgsConstructor
@Tag(name = "Knowledge", description = "知识图谱")
@Slf4j
public class KnowledgeController {

	private final KnowledgeGraphService knowledgeGraphService;

	@GetMapping("/graph")
	@Operation(summary = "获取知识图谱", description = "返回当前知识图谱的全部节点")
	public Map<String, Object> getGraph() {
		var nodes = knowledgeGraphService.getAllNodes();
		return Map.of("topics", nodes);
	}
}
