package com.douzi.sqlive.service.ai;

import com.douzi.sqlive.dto.ai.StreamChunk;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import reactor.core.publisher.Flux;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

@Slf4j
public class LmStudioProtocol implements Protocol {

	private final ObjectMapper objectMapper;

	public LmStudioProtocol(ObjectMapper objectMapper) {
		this.objectMapper = objectMapper;
	}

	@Override
	public Map<String, Object> buildRequest(RequestContext ctx) {
		Map<String, Object> body = new HashMap<>();
		body.put("model", ctx.model());
		// LM Studio uses "input" instead of "messages"
		body.put("input", buildChatInput(ctx.messages()));
		body.put("stream", ctx.stream());
		body.put("store", false);
		body.put("temperature", ctx.temperature());
		body.put("max_output_tokens", ctx.maxTokens());

		// system prompt is set separately
		String systemPrompt = extractSystemPrompt(ctx.messages());
		if (systemPrompt != null && !systemPrompt.isBlank()) {
			body.put("system_prompt", systemPrompt);
		}
		if (ctx.reasoningEffort() != null && !ctx.reasoningEffort().isBlank()) {
			body.put("reasoning", ctx.reasoningEffort().trim());
		}
		if (ctx.maxContextTokens() > 0) {
			body.put("context_length", ctx.maxContextTokens());
		}
		return body;
	}

	private String extractSystemPrompt(List<Map<String, String>> messages) {
		if (messages == null || messages.isEmpty()) return null;
		for (var msg : messages) {
			if ("system".equals(msg.get("role"))) {
				return msg.get("content");
			}
		}
		return null;
	}

	private String buildChatInput(List<Map<String, String>> messages) {
		if (messages == null || messages.isEmpty()) return "";
		StringBuilder sb = new StringBuilder();
		boolean first = true;
		for (var msg : messages) {
			String role = msg.get("role");
			if ("system".equals(role)) continue; // handled separately
			if (!first) sb.append("\n\n");
			first = false;
			String label = "assistant".equals(role) ? "Assistant" : "User";
			sb.append(label).append(": ").append(msg.get("content"));
		}
		return sb.toString();
	}

	@Override
	public Flux<StreamChunk> processStream(Flux<String> rawLines) {
		return rawLines
				.map(String::trim)
				.filter(line -> !line.isEmpty())
				.concatMap(new LmStudioSseLineAdapter(objectMapper));
	}

	@Override
	public Flux<StreamChunk> parseChunk(String jsonStr) {
		try {
			JsonNode root = objectMapper.readTree(jsonStr);
			String event = root.path("event").asText("");
			JsonNode data = root.path("data");

			return switch (event) {
				case "message.delta" -> {
					String content = data.path("content").asText("");
					yield content.isEmpty() ? Flux.empty() : Flux.just(StreamChunk.text(content));
				}
				case "reasoning.delta" -> {
					String content = data.path("content").asText("");
					yield content.isEmpty() ? Flux.empty() : Flux.just(StreamChunk.reasoning(content));
				}
				case "chat.end" -> {
					JsonNode stats = data.path("result").path("stats");
					int inputTokens = stats.path("input_tokens").asInt(0);
					int outputTokens = stats.path("total_output_tokens").asInt(0);
					int total = inputTokens + outputTokens;
					yield total > 0 ? Flux.just(StreamChunk.usage(inputTokens, outputTokens, total)) : Flux.empty();
				}
				case "error" -> {
					String msg = data.path("error").path("message").asText("LM Studio streaming error");
					yield Flux.just(StreamChunk.error(msg));
				}
				default -> Flux.empty();
			};
		} catch (Exception e) {
			log.trace("Failed to parse stream chunk", e);
			return Flux.empty();
		}
	}

	@Override
	public String extractContent(String responseJson) {
		try {
			JsonNode root = objectMapper.readTree(responseJson);
			JsonNode output = root.path("output");
			StringBuilder sb = new StringBuilder();
			if (output.isArray()) {
				for (JsonNode item : output) {
					String type = item.path("type").asText("");
					if ("message".equals(type)) {
						String content = item.path("content").asText("");
						if (!content.isEmpty()) {
							if (!sb.isEmpty()) sb.append("\n");
							sb.append(content);
						}
					}
				}
			}
			return sb.toString();
		} catch (Exception e) {
			throw new RuntimeException("LM Studio response parse failed: " + e.getMessage());
		}
	}

	/**
	 * Line-buffering adapter: buffers event: lines and merges them with data: lines
	 * into single JSON objects like {"event":"message.delta", "data":{...}}.
	 */
	class LmStudioSseLineAdapter implements Function<String, Flux<StreamChunk>> {

		private final ObjectMapper objectMapper;
		private String lastEvent = "";

		LmStudioSseLineAdapter(ObjectMapper objectMapper) {
			this.objectMapper = objectMapper;
		}

		@Override
		public Flux<StreamChunk> apply(String line) {
			if (line.startsWith("event:")) {
				lastEvent = line.substring(6).trim();
				return Flux.empty();
			}

			if (line.startsWith("data:")) {
				String event = lastEvent;
				String dataStr = line.substring(5).trim();
				lastEvent = "";

				if (event.isEmpty()) return Flux.empty();

				try {
					JsonNode data = objectMapper.readTree(dataStr);
					Map<String, Object> merged = new LinkedHashMap<>();
					merged.put("event", event);
					merged.put("data", data);
					String json = objectMapper.writeValueAsString(merged);
					return parseChunk(json);
				} catch (Exception e) {
					log.trace("Failed to parse stream chunk", e);
					return Flux.empty();
				}
			}

			lastEvent = "";
			return Flux.empty();
		}
	}
}
