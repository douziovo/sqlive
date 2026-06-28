package com.douzi.sqlive.service.ai;

import com.douzi.sqlive.dto.ai.StreamChunk;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import reactor.core.publisher.Flux;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
public class OpenAiProtocol implements Protocol {

	private final ObjectMapper objectMapper;

	public OpenAiProtocol(ObjectMapper objectMapper) {
		this.objectMapper = objectMapper;
	}

	@Override
	public Map<String, Object> buildRequest(RequestContext ctx) {
		Map<String, Object> body = new HashMap<>();
		body.put("model", ctx.model());
		body.put("messages", ctx.messages());
		body.put("max_tokens", ctx.maxTokens());
		body.put("temperature", ctx.temperature());
		body.put("stream", ctx.stream());
		if (ctx.reasoningEffort() != null && !ctx.reasoningEffort().isBlank()) {
			body.put("reasoning", Map.of("effort", ctx.reasoningEffort()));
		}
		return body;
	}

	@Override
	public Flux<StreamChunk> parseChunk(String jsonStr) {
		try {
			JsonNode root = objectMapper.readTree(jsonStr);
			List<StreamChunk> chunks = new ArrayList<>();

			var contentChunk = extractDeltaContent(root);
			if (contentChunk != null) chunks.add(contentChunk);

			var usageChunk = extractUsage(root);
			if (usageChunk != null) chunks.add(usageChunk);

			return Flux.fromIterable(chunks);
		} catch (Exception e) {
			log.trace("Failed to parse stream chunk", e);
			return Flux.empty();
		}
	}

	private StreamChunk extractDeltaContent(JsonNode root) {
		JsonNode choices = root.path("choices");
		if (choices.isArray() && !choices.isEmpty()) {
			JsonNode delta = choices.get(0).path("delta");
			JsonNode reasoning = delta.get("reasoning_content");
			if (reasoning != null && !reasoning.isNull() && !reasoning.asText("").isEmpty()) {
				return StreamChunk.reasoning(reasoning.asText());
			}
			String text = delta.path("content").asText("");
			return text.isEmpty() ? null : StreamChunk.text(text);
		}
		JsonNode output = root.path("output");
		if (output.isArray() && !output.isEmpty()) {
			JsonNode contentArr = output.get(0).path("content");
			if (contentArr.isArray() && !contentArr.isEmpty()) {
				String text = contentArr.get(0).path("text").asText("");
				return text.isEmpty() ? null : StreamChunk.text(text);
			}
		}
		return null;
	}

	private StreamChunk extractUsage(JsonNode root) {
		JsonNode usage = root.path("usage");
		if (usage.isMissingNode() || usage.isNull()) return null;

		int prompt = usage.path("prompt_tokens").asInt(0);
		int completion = usage.path("completion_tokens").asInt(0);
		int total = usage.path("total_tokens").asInt(0);

		if (prompt == 0) prompt = usage.path("input_tokens").asInt(0);
		if (completion == 0) completion = usage.path("output_tokens").asInt(0);
		if (total == 0) total = usage.path("total_tokens").asInt(0);

		if (total == 0) return null;
		return StreamChunk.usage(prompt, completion, total);
	}

	@Override
	public String extractContent(String responseJson) {
		try {
			JsonNode root = objectMapper.readTree(responseJson);

			JsonNode choices = root.path("choices");
			if (choices.isArray() && !choices.isEmpty()) {
				JsonNode message = choices.get(0).path("message");
				String content = message.path("content").asText("");
				if (content.isEmpty()) {
					String reasoning = message.path("reasoning_content").asText("");
					if (!reasoning.isEmpty()) return reasoning;
				}
				return content;
			}

			JsonNode output = root.path("output");
			if (output.isArray() && !output.isEmpty()) {
				JsonNode contentArr = output.get(0).path("content");
				if (contentArr.isArray() && !contentArr.isEmpty()) {
					return contentArr.get(0).path("text").asText("");
				}
			}

			return "";
		} catch (Exception e) {
			throw new RuntimeException("AI response parse failed: " + e.getMessage());
		}
	}
}
