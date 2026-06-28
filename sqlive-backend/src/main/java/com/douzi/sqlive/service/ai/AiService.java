package com.douzi.sqlive.service.ai;

import com.douzi.sqlive.config.AiProperties;
import com.douzi.sqlive.dto.ai.AiChatRequest;
import com.douzi.sqlive.dto.ai.AiChatResponse;
import com.douzi.sqlive.dto.ai.StreamChunk;
import com.douzi.sqlive.exception.AiProviderException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

@Slf4j
@Service
public class AiService {

	private final AiProperties aiProperties;
	private final ObjectMapper objectMapper;
	volatile Map<String, AiProvider> providers = Map.of();

	public AiService(AiProperties aiProperties, ObjectMapper objectMapper) {
		this.aiProperties = aiProperties;
		this.objectMapper = objectMapper;
	}

	@PostConstruct
	public void init() {
		var configs = aiProperties.getProviders();
		if (configs == null || configs.isEmpty()) {
			log.warn("No AI providers configured");
			return;
		}

		Map<String, AiProvider> map = new LinkedHashMap<>();
		for (var entry : configs.entrySet()) {
			var cfg = entry.getValue();
			var provider = OpenAiCompatibleProvider.create(entry.getKey(), cfg, objectMapper,
					aiProperties.getTimeout().getConnect(),
					aiProperties.getTimeout().getRead(),
					aiProperties.getTimeout().getWrite());
			map.put(entry.getKey(), provider);
		}
		this.providers = map;
		log.info("AI providers initialized: {}", map.keySet());
	}

	/**
	 * Atomically rebuilds the provider map from the current aiProperties configuration.
	 * Safe to call at runtime — the volatile providers field ensures visibility across threads.
	 */
	public synchronized void refreshProviders() {
		var configs = aiProperties.getProviders();
		if (configs == null || configs.isEmpty()) {
			this.providers = Map.of();
			log.warn("AI providers refreshed — no providers configured");
			return;
		}

		Map<String, AiProvider> map = new LinkedHashMap<>();
		for (var entry : configs.entrySet()) {
			var cfg = entry.getValue();
			var provider = OpenAiCompatibleProvider.create(entry.getKey(), cfg, objectMapper,
					aiProperties.getTimeout().getConnect(),
					aiProperties.getTimeout().getRead(),
					aiProperties.getTimeout().getWrite());
			map.put(entry.getKey(), provider);
		}
		this.providers = map;
		log.info("AI providers refreshed: {}", map.keySet());
	}

	public AiChatResponse executeNonStreaming(AiChatRequest request) {
		return executeNonStreaming(request.getMode(), buildSystemPrompt(request), buildUserMessage(request));
	}

	AiChatResponse executeNonStreaming(String mode, String systemPrompt, String userMessage) {
		var provider = getProvider();
		log.debug("AI request: provider={}, mode={}, systemPromptLen={}, userMsgLen={}",
				provider.getProviderName(), mode, systemPrompt.length(), userMessage.length());
		long start = System.currentTimeMillis();
		try {
			String rawResponse = provider.complete(systemPrompt, userMessage);
			long elapsed = System.currentTimeMillis() - start;
			log.info("AI response: provider={}, mode={}, responseLen={}, elapsed={}ms",
					provider.getProviderName(), mode, rawResponse.length(), elapsed);
			return parseResponse(rawResponse);
		} catch (Exception e) {
			long elapsed = System.currentTimeMillis() - start;
			log.error("AI execution failed: provider={}, mode={}, elapsed={}ms", provider.getProviderName(), mode, elapsed, e);
			return AiChatResponse.error("AI service error, please try again later");
		}
	}

	public Flux<StreamChunk> streamChat(AiChatRequest request) {
		return streamChat(buildSystemPrompt(request), request.getHistory(), buildUserMessage(request));
	}

	Flux<StreamChunk> streamChat(String systemPrompt, List<AiChatRequest.ChatMessage> history, String userMessage) {
		var provider = getProvider();
		log.debug("AI stream request: provider={}, systemPromptLen={}", provider.getProviderName(), systemPrompt.length());
		long start = System.currentTimeMillis();
		var responseLength = new AtomicInteger();
		return provider.streamChat(systemPrompt, history, userMessage)
				.doOnNext(c -> {
					if (c.getContent() != null) responseLength.addAndGet(c.getContent().length());
				})
				.doOnComplete(() -> {
					long elapsed = System.currentTimeMillis() - start;
					log.info("AI stream complete: provider={}, elapsed={}ms, responseLen={}", provider.getProviderName(), elapsed, responseLength.get());
				})
				.onErrorResume(e -> {
					long elapsed = System.currentTimeMillis() - start;
					log.error("Stream chat failed: provider={}, elapsed={}ms", provider.getProviderName(), elapsed, e);
					return Flux.just(StreamChunk.error("AI 服务调用出错：" + e.getMessage()));
				});
	}

	AiProvider getProvider() {
		String name = aiProperties.getProvider();
		if (name == null || name.isBlank()) name = "deepseek";
		var provider = providers.get(name);
		if (provider == null) {
			throw new AiProviderException("未找到 AI 供应商: " + name + "，可用: " + providers.keySet());
		}
		if (!provider.isAvailable()) {
			throw new AiProviderException("AI 供应商未配置 API Key: " + name);
		}
		return provider;
	}

	// ─── Prompt Building ────────────────────────────────────────

	String buildSystemPrompt(AiChatRequest req) {
		return switch (req.getMode()) {
			case "analyze-error" -> PromptBuilder.buildErrorAnalysisPrompt(req);
			case "fix-code" -> PromptBuilder.buildFixCodePrompt(req);
			case "explain" -> PromptBuilder.buildExplainPrompt(req);
			case "optimize" -> PromptBuilder.buildOptimizePrompt(req);
			default -> PromptBuilder.buildChatPrompt(req);
		};
	}

	String buildUserMessage(AiChatRequest req) {
		return switch (req.getMode()) {
			case "analyze-error", "fix-code" -> "";
			case "explain" -> "请解释以下 SQL 代码：\n```sql\n" + req.getSelectedCode() + "\n```";
			case "optimize" -> "请优化以下 SQL 代码：\n```sql\n" + req.getSelectedCode() + "\n```";
			case "chat" -> req.getMessage();
			default -> req.getMessage() != null ? req.getMessage() : "";
		};
	}

	// ─── Response Parsing ───────────────────────────────────────

	private AiChatResponse parseResponse(String raw) {
		var resp = new AiChatResponse();
		resp.setSuccess(true);
		var data = new AiChatResponse.DataPayload();

		try {
			if (raw.trim().startsWith("{")) {
				JsonNode root = objectMapper.readTree(raw);
				data.setSummary(root.has("summary") ? root.get("summary").asText() : raw);
				data.setContent(root.has("detail") ? root.get("detail").asText() : raw);
				if (root.has("fixedCode")) {
					data.setFixedCode(root.get("fixedCode").asText());
				}
				if (root.has("prevention")) {
					data.setContent(data.getContent() + "\n\n## 如何避免\n" + root.get("prevention").asText());
				}
				if (root.has("stepByStep")) {
					data.setStepByStep(StreamSupport.stream(root.get("stepByStep").spliterator(), false)
							.map(s -> {
								var step = new AiChatResponse.DataPayload.ExplainStep();
								step.setStep(s.path("step").asInt());
								step.setWhat(s.path("what").asText());
								step.setWhy(s.path("why").asText());
								return step;
							}).collect(Collectors.toList()));
				}
				if (root.has("tips")) {
					data.setTips(StreamSupport.stream(root.get("tips").spliterator(), false)
							.map(JsonNode::asText).collect(Collectors.toList()));
				}
				if (root.has("explanation")) {
					data.setContent(data.getContent() + "\n\n" + root.get("explanation").asText());
				}
			} else {
				data.setContent(raw);
			}
		} catch (JsonProcessingException e) {
			log.warn("AI response not valid JSON, using raw text (len={})", raw.length());
			data.setContent(raw);
		}

		resp.setData(data);
		return resp;
	}
}
