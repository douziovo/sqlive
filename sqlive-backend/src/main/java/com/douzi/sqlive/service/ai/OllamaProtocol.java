package com.douzi.sqlive.service.ai;

import com.douzi.sqlive.dto.ai.StreamChunk;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import reactor.core.publisher.Flux;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
public class OllamaProtocol implements Protocol {

	private final ObjectMapper objectMapper;

	public OllamaProtocol(ObjectMapper objectMapper) {
		this.objectMapper = objectMapper;
	}

	@Override
	public Map<String, Object> buildRequest(RequestContext ctx) {
		Map<String, Object> body = new HashMap<>();
		body.put("model", ctx.model());
		body.put("messages", ctx.messages());
		body.put("stream", ctx.stream());

		if (ctx.reasoningEffort() != null && !ctx.reasoningEffort().isBlank()) {
			String effort = ctx.reasoningEffort().trim();
			if ("true".equals(effort)) {
				body.put("think", true);
			} else {
				body.put("think", effort);
			}
		}

		Map<String, Object> options = new HashMap<>();
		options.put("temperature", ctx.temperature());
		options.put("num_predict", ctx.maxTokens());
		if (ctx.maxContextTokens() > 0) {
			options.put("num_ctx", ctx.maxContextTokens());
		}
		body.put("options", options);
		return body;
	}

	@Override
	public Flux<StreamChunk> processStream(Flux<String> rawLines) {
		return rawLines
				.map(String::trim)
				.filter(line -> !line.isEmpty())
				.concatMap(this::parseChunk);
	}

	@Override
	public Flux<StreamChunk> parseChunk(String line) {
		try {
			JsonNode root = objectMapper.readTree(line);
			List<StreamChunk> chunks = new ArrayList<>();

			JsonNode message = root.path("message");

			String thinking = message.path("thinking").asText("");
			if (!thinking.isEmpty()) {
				chunks.add(StreamChunk.reasoning(thinking));
			}

			String content = message.path("content").asText("");
			if (!content.isEmpty()) {
				chunks.add(StreamChunk.text(content));
			}

			if (root.path("done").asBoolean(false)) {
				int promptTokens = root.path("prompt_eval_count").asInt(0);
				int completionTokens = root.path("eval_count").asInt(0);
				if (promptTokens > 0 || completionTokens > 0) {
					chunks.add(StreamChunk.usage(promptTokens, completionTokens, promptTokens + completionTokens));
				}
			}

			return Flux.fromIterable(chunks);
		} catch (Exception e) {
			log.trace("Failed to parse stream chunk", e);
			return Flux.empty();
		}
	}

	@Override
	public String extractContent(String responseJson) {
		try {
			JsonNode root = objectMapper.readTree(responseJson);
			return root.path("message").path("content").asText();
		} catch (Exception e) {
			throw new RuntimeException("Ollama response parse failed: " + e.getMessage());
		}
	}
}
